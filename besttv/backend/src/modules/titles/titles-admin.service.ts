import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { slugify } from '../../common/slugify';
import { expandQuery } from '../../common/transliterate';
import { TitleMediaHelper } from './title-media.helper';
import {
  CreateEpisodeDto,
  CreateSeasonDto,
  CreateTitleDto,
  UpdateEpisodeDto,
  UpdateTitleDto,
} from './dto/title-admin.dto';

@Injectable()
export class TitlesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly media: TitleMediaHelper,
  ) {}

  // ─── Title CRUD ─────────────────────────────────────────────────────────────

  /** Контентын шүүлт — НЭГ цэгээс (жагсаалт ба тоолол ижил) */
  private buildWhere(params: {
    q?: string;
    type?: string;
    genre?: string;
    status?: string;
    access?: string;
    active?: string;
    year?: number;
  }): Prisma.TitleWhereInput {
    const where: Prisma.TitleWhereInput = {};

    // ⚠️ Галиг Латин↔Кирилл хөрвүүлэлт — "mongol" бичихэд "монгол" олдоно
    const terms = params.q ? expandQuery(params.q) : [];
    if (terms.length) {
      where.OR = terms.flatMap((t) => [
        { title: { contains: t, mode: 'insensitive' as const } },
        { titleEn: { contains: t, mode: 'insensitive' as const } },
        { slug: { contains: t, mode: 'insensitive' as const } },
      ]);
    }

    if (params.type && params.type !== 'ALL') where.type = params.type as never;
    if (params.status && params.status !== 'ALL') where.streamStatus = params.status as never;
    if (params.genre && params.genre !== 'ALL') {
      where.genres = { some: { genreId: params.genre } };
    }
    if (params.access === 'premium') where.isPremium = true;
    else if (params.access === 'free') where.isPremium = false;
    if (params.active === 'true') where.isActive = true;
    else if (params.active === 'false') where.isActive = false;
    if (params.year) where.year = Number(params.year);

    return where;
  }

  /** Шүүлтэд тохирсон тоолол — табын badge */
  async counts(params: { q?: string; genre?: string; year?: number }) {
    const base = this.buildWhere(params);
    const [all, movies, series, premium, free, inactive, noVideo] = await Promise.all([
      this.prisma.title.count({ where: base }),
      this.prisma.title.count({ where: { ...base, type: 'MOVIE' } }),
      this.prisma.title.count({ where: { ...base, type: 'SERIES' } }),
      this.prisma.title.count({ where: { ...base, isPremium: true } }),
      this.prisma.title.count({ where: { ...base, isPremium: false } }),
      this.prisma.title.count({ where: { ...base, isActive: false } }),
      this.prisma.title.count({ where: { ...base, type: 'MOVIE', streamStatus: 'NONE' } }),
    ]);
    return { ALL: all, movies, series, premium, free, inactive, noVideo };
  }

  async list(params: {
    q?: string;
    type?: string;
    genre?: string;
    status?: string;
    access?: string;
    active?: string;
    year?: number;
    sort?: string;
    dir?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(200, Number(params.limit) || 20);
    const where = this.buildWhere(params);
    const orderBy = {
      [params.sort ?? 'createdAt']: params.dir ?? 'desc',
    } as Prisma.TitleOrderByWithRelationInput;

    const [items, total] = await Promise.all([
      this.prisma.title.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          genres: { include: { genre: { select: { id: true, name: true } } } },
          _count: { select: { seasons: true } },
        },
      }),
      this.prisma.title.count({ where }),
    ]);

    return {
      items: await this.media.decorateMany(items),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async get(id: string) {
    const title = await this.prisma.title.findUnique({
      where: { id },
      include: {
        genres: { include: { genre: true }, orderBy: { order: 'asc' } },
        seasons: {
          orderBy: { number: 'asc' },
          include: { episodes: { orderBy: { number: 'asc' } } },
        },
      },
    });
    if (!title) throw new NotFoundException('Контент олдсонгүй');

    const decorated = await this.media.decorate(title);
    const castRaw = Array.isArray(title.cast)
      ? (title.cast as unknown as { name: string; character?: string; photoKey?: string }[])
      : [];
    const castPhotoUrls = await this.media.urlMany(castRaw.map((c) => c.photoKey));
    const galleryUrls = await this.media.urlMany(title.galleryKeys);

    return {
      ...decorated,
      trailerUrl: await this.media.url(title.trailerKey),
      cast: castRaw.map((c, i) => ({ ...c, photoUrl: castPhotoUrls[i] })),
      galleryUrls,
      seasons: await Promise.all(
        title.seasons.map(async (s) => ({
          ...s,
          episodes: await Promise.all(
            s.episodes.map(async (e) => ({
              ...e,
              posterUrl: await this.media.url(e.posterKey),
            })),
          ),
        })),
      ),
    };
  }

  async create(dto: CreateTitleDto) {
    const slug = await this.makeUniqueSlug(dto.title);
    const { genreIds, cast, ...data } = dto;

    return this.prisma.title.create({
      data: {
        ...data,
        slug,
        ...(cast ? { cast: cast as unknown as Prisma.InputJsonValue } : {}),
        ...(genreIds?.length
          ? {
              genres: {
                create: genreIds.map((genreId, i) => ({ genreId, order: i })),
              },
            }
          : {}),
      },
    });
  }

  async update(id: string, dto: UpdateTitleDto) {
    const existing = await this.prisma.title.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Контент олдсонгүй');

    const { genreIds, cast, ...data } = dto;
    const castData = cast ? { cast: cast as unknown as Prisma.InputJsonValue } : {};

    return this.prisma.$transaction(async (tx) => {
      if (genreIds) {
        await tx.titleGenre.deleteMany({ where: { titleId: id } });
        await tx.titleGenre.createMany({
          data: genreIds.map((genreId, i) => ({ titleId: id, genreId, order: i })),
        });
      }
      return tx.title.update({ where: { id }, data: { ...data, ...castData } });
    });
  }

  async remove(id: string) {
    const title = await this.prisma.title.findUnique({
      where: { id },
      include: { seasons: { include: { episodes: true } } },
    });
    if (!title) throw new NotFoundException('Контент олдсонгүй');

    // R2 цэвэрлэгээ — HLS хавтаснууд + зургууд
    const keys = [
      title.posterKey,
      title.backdropKey,
      title.videoRawKey,
    ].filter(Boolean) as string[];
    const prefixes: string[] = [];
    if (title.videoKey) prefixes.push(this.hlsPrefix(title.videoKey));
    if (title.trailerKey) prefixes.push(this.hlsPrefix(title.trailerKey));
    for (const s of title.seasons) {
      for (const e of s.episodes) {
        if (e.posterKey) keys.push(e.posterKey);
        if (e.videoRawKey) keys.push(e.videoRawKey);
        if (e.videoKey) prefixes.push(this.hlsPrefix(e.videoKey));
      }
    }

    await this.prisma.title.delete({ where: { id } });

    // Fire-and-forget цэвэрлэгээ (DB устгал амжилттай болсны ДАРАА)
    void Promise.all([
      ...keys.map((k) => this.storage.delete(k).catch(() => null)),
      ...prefixes.map((p) => this.storage.deletePrefix(p).catch(() => null)),
    ]);

    return { ok: true };
  }

  /** m3u8 key → HLS хавтасны prefix ('titles/uuid/video.m3u8' → 'titles/uuid/') */
  private hlsPrefix(m3u8Key: string): string {
    return m3u8Key.slice(0, m3u8Key.lastIndexOf('/') + 1);
  }

  private async makeUniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    const taken = await this.prisma.title.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    const set = new Set(taken.map((t) => t.slug));
    if (!set.has(base)) return base;
    let i = 2;
    while (set.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  }

  // ─── Season / Episode ──────────────────────────────────────────────────────

  async createSeason(titleId: string, dto: CreateSeasonDto) {
    return this.prisma.season.create({ data: { titleId, ...dto } });
  }

  async removeSeason(id: string) {
    const season = await this.prisma.season.findUnique({
      where: { id },
      include: { episodes: true },
    });
    if (!season) throw new NotFoundException('Улирал олдсонгүй');

    await this.prisma.season.delete({ where: { id } });
    void Promise.all(
      season.episodes.flatMap((e) => [
        e.videoKey ? this.storage.deletePrefix(this.hlsPrefix(e.videoKey)) : null,
        e.videoRawKey ? this.storage.delete(e.videoRawKey) : null,
        e.posterKey ? this.storage.delete(e.posterKey) : null,
      ]),
    ).catch(() => null);
    return { ok: true };
  }

  async createEpisode(seasonId: string, dto: CreateEpisodeDto) {
    return this.prisma.episode.create({ data: { seasonId, ...dto } });
  }

  async updateEpisode(id: string, dto: UpdateEpisodeDto) {
    return this.prisma.episode.update({ where: { id }, data: dto });
  }

  async removeEpisode(id: string) {
    const ep = await this.prisma.episode.findUnique({ where: { id } });
    if (!ep) throw new NotFoundException('Анги олдсонгүй');

    await this.prisma.episode.delete({ where: { id } });
    void Promise.all([
      ep.videoKey ? this.storage.deletePrefix(this.hlsPrefix(ep.videoKey)) : null,
      ep.videoRawKey ? this.storage.delete(ep.videoRawKey) : null,
      ep.posterKey ? this.storage.delete(ep.posterKey) : null,
    ]).catch(() => null);
    return { ok: true };
  }
}
