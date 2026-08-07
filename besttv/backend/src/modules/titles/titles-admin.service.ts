import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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

/**
 * `Title.cast` (Json) доторх зургийн key-үүдийг гаргана.
 *
 * ⚠️ Кино устгахад ЭДГЭЭРИЙГ ч устгах ёстой — өмнө нь орхигдож R2-д
 * үүрд үлддэг байв. TMDB импорт нэг кинонд 8 зураг mirror хийдэг тул
 * 77 кино = ~600 орхигдсон файл.
 */
function castPhotoKeys(cast: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(cast)) return [];
  return cast
    .map((c) =>
      c && typeof c === 'object' && 'photoKey' in c ? (c as { photoKey?: unknown }).photoKey : null,
    )
    .filter((k): k is string => typeof k === 'string' && k.length > 0);
}

@Injectable()
export class TitlesAdminService {
  private readonly logger = new Logger(TitlesAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly media: TitleMediaHelper,
  ) {}

  /**
   * R2 файл/хавтас цэвэрлэх — DB устгал амжилттай болсны ДАРАА, дэвсгэрт.
   *
   * ⚠️⚠️ АЛДААГ ЗААВАЛ БҮРТГЭНЭ. Өмнө нь 4 газарт `.catch(() => null)`
   * гэж ЧИМЭЭГҮЙ залгидаг байсан тул R2 дуудалт унавал файлууд бүрмөсөн
   * орхигдож, хаана байсныг мэдэх DB мөр ч үлдэхгүй байв. Лог байвал
   * админ дараа нь гараар цэвэрлэж чадна.
   *
   * ⚠️ Устгал нь `await` хийгддэггүй (fire-and-forget) — хэрэглэгчийг
   * R2-ын хариу хүлээлгэх шаардлагагүй, DB аль хэдийн цэвэрхэн.
   */
  private cleanupR2(keys: (string | null | undefined)[], prefixes: string[] = []): void {
    const files = keys.filter((k): k is string => !!k);
    void Promise.allSettled([
      ...files.map((k) => this.storage.delete(k)),
      ...prefixes.map((p) => this.storage.deletePrefix(p)),
    ]).then((results) => {
      const failed = results.filter((r) => r.status === 'rejected');
      if (!failed.length) return;
      /* ⚠️ Орхигдсон key-г бүртгэнэ — гараар цэвэрлэхэд хэрэгтэй */
      const all = [...files, ...prefixes];
      const lost = results
        .map((r, i) => (r.status === 'rejected' ? all[i] : null))
        .filter(Boolean);
      this.logger.error(
        `R2 цэвэрлэгээ ${failed.length}/${results.length} амжилтгүй — ОРХИГДСОН: ${lost.join(', ')}`,
      );
    });
  }

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
    // ⚠️ Админ slug гараар өгсөн бол ТҮҮНИЙГ, эс бөгөөс гарчигаас үүсгэнэ
    const { genreIds, cast, slug: rawSlug, ...data } = dto;
    const slug = await this.makeUniqueSlug(rawSlug?.trim() || dto.title);

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

    const { genreIds, cast, slug: rawSlug, ...data } = dto;
    const castData = cast ? { cast: cast as unknown as Prisma.InputJsonValue } : {};

    /**
     * ⚠️ Slug засах — ЗӨВХӨН админ гараар өөрчилсөн үед.
     * Гарчиг өөрчлөгдөхөд slug АВТОМАТААР солигдохгүй: хуучин линк
     * (Google index, сошиал хуваалцалт, чатбот) бүгд эвдэрнэ.
     */
    const slugData =
      rawSlug?.trim() && slugify(rawSlug) !== existing.slug
        ? { slug: await this.makeUniqueSlug(rawSlug, id) }
        : {};

    return this.prisma.$transaction(async (tx) => {
      if (genreIds) {
        await tx.titleGenre.deleteMany({ where: { titleId: id } });
        await tx.titleGenre.createMany({
          data: genreIds.map((genreId, i) => ({ titleId: id, genreId, order: i })),
        });
      }
      return tx.title.update({ where: { id }, data: { ...data, ...castData, ...slugData } });
    });
  }

  /**
   * @param force ⚠️ Идэвхтэй түрээстэй байсан ч устгах (админ баталсан)
   */
  async remove(id: string, force = false) {
    const title = await this.prisma.title.findUnique({
      where: { id },
      include: {
        seasons: { include: { episodes: true } },
        rentals: { where: { expiresAt: { gt: new Date() } }, select: { amount: true } },
      },
    });
    if (!title) throw new NotFoundException('Контент олдсонгүй');

    /**
     * ⚠️⚠️ ТӨЛБӨР ТӨЛСӨН ТҮРЭЭСИЙГ ХАМГААЛНА.
     *
     * `Rental` нь `onDelete: Cascade` тул кино устахад идэвхтэй түрээс
     * ЧИМЭЭГҮЙ устдаг — хэрэглэгч 4,900₮ төлсөн, кино алга, буцаалт
     * байхгүй, лог ч үлдэхгүй. `bulkDelete` энэ хамгаалалттай байсан
     * атлаа ганцаарчилсан устгал ямар ч шалгалтгүй байв.
     */
    if (title.rentals.length && !force) {
      const sum = title.rentals.reduce((s, r) => s + r.amount, 0);
      throw new BadRequestException({
        code: 'ACTIVE_RENTALS',
        message:
          `Энэ кинонд ${title.rentals.length} идэвхтэй түрээс байна ` +
          `(${sum.toLocaleString()}₮). Устгавал тэд эрхээ алдана. ` +
          `Хугацаа дуусахыг хүлээх эсвэл "хүчээр устгах"-ыг сонгоно уу.`,
        activeRentals: title.rentals.length,
        rentalAmount: sum,
      });
    }

    // R2 цэвэрлэгээ — HLS хавтаснууд + зургууд
    const keys = [
      title.posterKey,
      title.backdropKey,
      title.videoRawKey,
      /**
       * ⚠️ ГАЛЕРЕЙ + ЖҮЖИГЧДИЙН ЗУРАГ — өмнө нь цэвэрлэгээнд ОРООГҮЙ
       * тул кино устсаны дараа R2-д үүрд орхигдож, сарын хадгалалтын
       * төлбөр дэмий өсдөг байв (TMDB импорт 8 зураг mirror хийдэг).
       */
      ...title.galleryKeys,
      ...castPhotoKeys(title.cast),
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
    this.cleanupR2(keys, prefixes);

    return { ok: true };
  }

  // ── Bulk үйлдлүүд ───────────────────────────────────────────────────────────

  /** Нэг хүсэлтэд боловсруулах дээд тоо — санамсаргүй бүх каталогийг хамгаална */
  private static readonly BULK_MAX = 200;

  private assertBulk(ids: string[]) {
    if (!ids?.length) throw new BadRequestException('Нэг ч контент сонгоогүй байна');
    if (ids.length > TitlesAdminService.BULK_MAX) {
      throw new BadRequestException(
        `Нэг удаад дээд тал нь ${TitlesAdminService.BULK_MAX} контент (сонгосон: ${ids.length})`,
      );
    }
  }

  /**
   * Устгахын ӨМНӨХ нөлөөллийн тайлан.
   *
   * ⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: `Rental` нь `onDelete: Cascade` тул кино устахад
   * ТӨЛБӨР ТӨЛСӨН хэрэглэгчийн идэвхтэй түрээс ЧИМЭЭГҮЙ устдаг. Админ
   * үүнийг устгахаас өмнө мэдэж байх ёстой.
   */
  async bulkImpact(ids: string[]) {
    this.assertBulk(ids);
    const now = new Date();

    const titles = await this.prisma.title.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        views: true,
        _count: { select: { myList: true, reviews: true } },
        rentals: {
          where: { expiresAt: { gt: now } },
          select: { id: true, amount: true },
        },
      },
    });

    const items = titles.map((t) => ({
      id: t.id,
      title: t.title,
      views: t.views,
      inMyList: t._count.myList,
      reviews: t._count.reviews,
      activeRentals: t.rentals.length,
      rentalAmount: t.rentals.reduce((s, r) => s + r.amount, 0),
    }));

    return {
      total: items.length,
      /** ⚠️ Устгавал мөнгө төлсөн хэрэглэгч эрхээ алдана */
      withActiveRentals: items.filter((i) => i.activeRentals > 0),
      totalActiveRentals: items.reduce((s, i) => s + i.activeRentals, 0),
      totalRentalAmount: items.reduce((s, i) => s + i.rentalAmount, 0),
      items,
    };
  }

  /**
   * Бөөнөөр устгах.
   * @param force идэвхтэй түрээстэй байсан ч устгах (админ баталгаажуулсан)
   */
  async bulkDelete(ids: string[], force: boolean) {
    this.assertBulk(ids);
    const now = new Date();

    const titles = await this.prisma.title.findMany({
      where: { id: { in: ids } },
      include: {
        seasons: { include: { episodes: true } },
        rentals: { where: { expiresAt: { gt: now } }, select: { id: true } },
      },
    });
    if (!titles.length) throw new NotFoundException('Сонгосон контент олдсонгүй');

    // ⚠️ Идэвхтэй түрээстэй бол force-гүйгээр УСТГАХГҮЙ
    const blocked = titles.filter((t) => t.rentals.length > 0);
    if (blocked.length && !force) {
      throw new BadRequestException({
        code: 'ACTIVE_RENTALS',
        message:
          `${blocked.length} контентод идэвхтэй түрээс байна — устгавал төлбөр ` +
          `төлсөн хэрэглэгчид эрхээ алдана. Баталгаажуулна уу.`,
        titles: blocked.map((t) => ({ id: t.id, title: t.title, rentals: t.rentals.length })),
      });
    }

    // R2 цэвэрлэгээний түлхүүрүүдийг DB устгахаас ӨМНӨ цуглуулна
    const keys: string[] = [];
    const prefixes: string[] = [];
    for (const t of titles) {
      for (const k of [t.posterKey, t.backdropKey, t.videoRawKey]) if (k) keys.push(k);
      /* ⚠️ Галерей + жүжигчдийн зураг — өмнө нь орхигдож R2-д үлддэг байв */
      keys.push(...t.galleryKeys, ...castPhotoKeys(t.cast));
      if (t.videoKey) prefixes.push(this.hlsPrefix(t.videoKey));
      if (t.trailerKey) prefixes.push(this.hlsPrefix(t.trailerKey));
      for (const s of t.seasons) {
        for (const e of s.episodes) {
          if (e.posterKey) keys.push(e.posterKey);
          if (e.videoRawKey) keys.push(e.videoRawKey);
          if (e.videoKey) prefixes.push(this.hlsPrefix(e.videoKey));
        }
      }
    }

    const foundIds = titles.map((t) => t.id);
    const { count } = await this.prisma.title.deleteMany({ where: { id: { in: foundIds } } });

    // Fire-and-forget цэвэрлэгээ (DB устгал амжилттай болсны ДАРАА)
    this.cleanupR2(keys, prefixes);

    this.logger.log(
      `Bulk устгал: ${count} контент, ${keys.length} файл, ${prefixes.length} HLS хавтас`,
    );
    return { ok: true, deleted: count, files: keys.length, hlsFolders: prefixes.length };
  }

  /** Идэвх (нийтлэгдсэн эсэх) бөөнөөр солих */
  async bulkSetActive(ids: string[], isActive: boolean) {
    this.assertBulk(ids);
    const { count } = await this.prisma.title.updateMany({
      where: { id: { in: ids } },
      data: { isActive },
    });
    return { ok: true, updated: count };
  }

  /** Төлбөртэй/үнэгүй бөөнөөр солих */
  async bulkSetPremium(ids: string[], isPremium: boolean) {
    this.assertBulk(ids);
    const { count } = await this.prisma.title.updateMany({
      where: { id: { in: ids } },
      data: { isPremium },
    });
    return { ok: true, updated: count };
  }

  /** m3u8 key → HLS хавтасны prefix ('titles/uuid/video.m3u8' → 'titles/uuid/') */
  private hlsPrefix(m3u8Key: string): string {
    return m3u8Key.slice(0, m3u8Key.lastIndexOf('/') + 1);
  }

  /**
   * Давхардахгүй slug үүсгэнэ.
   *
   * @param source Гарчиг ЭСВЭЛ админы гараар өгсөн slug
   * @param excludeId Засах үед ӨӨРИЙНХӨӨ slug-ыг давхардал гэж үзэхгүй
   */
  private async makeUniqueSlug(source: string, excludeId?: string): Promise<string> {
    const base = slugify(source);
    // ⚠️ slugify нь кирилл/тэмдэгтийг бүрэн хасвал хоосон болзошгүй
    if (!base) throw new BadRequestException('Slug үүсгэх боломжгүй — латин үсэг оруулна уу');

    const taken = await this.prisma.title.findMany({
      where: {
        slug: { startsWith: base },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
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
    this.cleanupR2(
      season.episodes.flatMap((e) => [e.videoRawKey, e.posterKey]),
      season.episodes
        .filter((e) => e.videoKey)
        .map((e) => this.hlsPrefix(e.videoKey as string)),
    );
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
    this.cleanupR2(
      [ep.videoRawKey, ep.posterKey],
      ep.videoKey ? [this.hlsPrefix(ep.videoKey)] : [],
    );
    return { ok: true };
  }
}
