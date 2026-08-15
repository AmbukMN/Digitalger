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
  /**
   * Контентын CSV export — ХАРАГДАЖ БУЙ шүүлтийг ЯГ дагана.
   *
   * ⚠️⚠️ `buildWhere`-ийг ДАХИН ашиглана. Өөрийн гэсэн шүүлт бичвэл
   * жагсаалт болон CSV зөрж, админ 40 мөр хүлээгээд 500 мөр авна
   * (захиалагчийн CSV дээр яг ийм алдаа гарсан).
   *
   * ⚠️ Хамгийн том хүснэгт тул `take` ЗААВАЛ — хязгааргүй бол
   * каталог өсөхөд сервер унана.
   */
  async exportCsv(params: {
    q?: string;
    type?: string;
    genre?: string;
    status?: string;
    access?: string;
    active?: string;
    year?: number;
    sort?: string;
    dir?: 'asc' | 'desc';
  }) {
    const where = this.buildWhere(params);
    const orderBy = {
      [params.sort ?? 'createdAt']: params.dir ?? 'desc',
    } as Prisma.TitleOrderByWithRelationInput;

    const rows = await this.prisma.title.findMany({
      where,
      orderBy,
      take: 20_000,
      select: {
        title: true,
        titleEn: true,
        slug: true,
        type: true,
        year: true,
        country: true,
        isActive: true,
        isPremium: true,
        comingSoon: true,
        views: true,
        rating: true,
        streamStatus: true,
        durationSec: true,
        createdAt: true,
        genres: { select: { genre: { select: { name: true } } } },
        _count: { select: { seasons: true, rentals: true } },
      },
    });

    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = [
      'Нэр,Англи нэр,Slug,Төрөл,Он,Улс,Жанр,Идэвхтэй,Төлбөртэй,Удахгүй,Үзэлт,Үнэлгээ,Видео,Үргэлжлэх(мин),Улирал,Түрээс,Үүсгэсэн',
      ...rows.map((r) =>
        [
          r.title,
          r.titleEn ?? '',
          r.slug,
          r.type,
          r.year ?? '',
          r.country ?? '',
          r.genres.map((g) => g.genre.name).join(' / '),
          r.isActive ? 'Тийм' : 'Үгүй',
          r.isPremium ? 'Тийм' : 'Үгүй',
          r.comingSoon ? 'Тийм' : 'Үгүй',
          r.views,
          r.rating ?? '',
          r.streamStatus,
          r.durationSec ? Math.round(r.durationSec / 60) : '',
          r._count.seasons,
          r._count.rentals,
          r.createdAt.toISOString().slice(0, 10),
        ]
          .map(esc)
          .join(','),
      ),
    ];

    /* ⚠️ BOM — Excel дээр кирилл зөв харагдана */
    return { csv: '﻿' + lines.join('\n'), count: rows.length };
  }

  async counts(params: { q?: string; genre?: string; year?: number }) {
    const base = this.buildWhere(params);
    const [all, movies, series, premium, free, inactive, noVideo] = await Promise.all([
      this.prisma.title.count({ where: base }),
      this.prisma.title.count({ where: { ...base, type: 'MOVIE' } }),
      this.prisma.title.count({ where: { ...base, type: 'SERIES' } }),
      this.prisma.title.count({ where: { ...base, isPremium: true } }),
      this.prisma.title.count({ where: { ...base, isPremium: false } }),
      this.prisma.title.count({ where: { ...base, isActive: false } }),
      /**
       * ⚠️⚠️ "Видео ороогүй" — MOVIE ба SERIES-д ӨӨР шалгуур.
       *
       *   MOVIE  → `streamStatus = NONE` (видео нь Title дээр)
       *   SERIES → анги ОГТ БАЙХГҮЙ, эсвэл БҮХ анги `NONE`
       *            (`Title.streamStatus` нь SERIES-д хэзээ ч
       *             өөрчлөгддөггүй тул түүгээр шүүвэл БҮХ цуврал
       *             "видеогүй" гэж ХУДЛАА тоологдоно)
       */
      this.prisma.title.count({
        where: {
          ...base,
          OR: [
            { type: 'MOVIE', streamStatus: 'NONE' },
            { type: 'SERIES', seasons: { none: {} } },
            {
              type: 'SERIES',
              seasons: { every: { episodes: { every: { streamStatus: 'NONE' } } } },
            },
          ],
        },
      }),
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
        /**
         * ⚠️⚠️ `include` БИШ `select` — `include` нь Title-ийн БҮХ баганыг
         * татдаг: `description`, `descriptionEn`, `cast` (JSON, олон KB),
         * `galleryKeys[]`, `actors[]`, `metaDescription`, бүх `*Key`.
         * Админ хүснэгтэд эдгээрийн НЭГ Ч харагддаггүй.
         * `limit` нь 200 хүртэл тул 200 × cast JSON = хэдэн MB дэмий.
         * ⚠️ Шинэ багана хүснэгтэд нэмэх бол ЭНД ч нэмнэ.
         */
        select: {
          id: true, title: true, slug: true, type: true, year: true,
          isActive: true, isPremium: true, language: true, views: true,
          streamStatus: true, posterKey: true, createdAt: true,
          /* ⚠️ Хэмжээ тооцоход (админ жагсаалтын "Хэмжээ" багана) */
          videoKey: true, videoRawKey: true, trailerKey: true, durationSec: true,
          genres: { include: { genre: { select: { id: true, name: true } } } },
          _count: { select: { seasons: true } },
          /**
           * ⚠️⚠️ ЦУВРАЛЫН АНГИУДЫН ТӨЛӨВ — badge зөв харуулахад.
           *
           * БОДИТ АЛДАА: `Title.streamStatus` нь SERIES-д ХЭЗЭЭ Ч
           * өөрчлөгддөггүй (видео нь `Episode` дээр) тул 10 анги нь
           * бүрэн бэлэн цуврал ч админд «Видео ороогүй» гэж ХУДЛАА
           * харагддаг байв.
           *
           * ⚠️ Зөвхөн `streamStatus` — хөнгөн (`select` тул бусад
           * багана татахгүй).
           */
          seasons: {
            select: { episodes: { select: { streamStatus: true } } },
          },
        },
      }),
      this.prisma.title.count({ where }),
    ]);

    /**
     * ⚠️⚠️ SERIES-ийн БОДИТ төлвийг ангиудаас тооцно.
     *
     *   бүгд READY        → READY («Бэлэн»)
     *   аль нэг PROCESSING→ PROCESSING («Боловсруулж байна»)
     *   аль нэг FAILED    → FAILED («Алдаатай»)
     *   аль нэг UPLOADED  → UPLOADED («Ачаалагдсан»)
     *   анги огт байхгүй  → NONE («Видео ороогүй») — энэ л ЖИНХЭНЭ
     *
     * ⚠️ `episodeStats` талбарыг ч буцаана — админ «7/10 бэлэн» гэж
     * нарийн харах боломжтой.
     */
    const withStatus = items.map((t) => {
      if (t.type !== 'SERIES') {
        const { seasons: _drop, ...rest } = t;
        return rest;
      }
      const eps = (t.seasons ?? []).flatMap((s) => s.episodes ?? []);
      const { seasons: _drop, ...rest } = t;

      if (!eps.length) return { ...rest, episodeStats: { total: 0, ready: 0 } };

      const ready = eps.filter((e) => e.streamStatus === 'READY').length;
      const streamStatus =
        ready === eps.length
          ? 'READY'
          : eps.some((e) => e.streamStatus === 'PROCESSING')
            ? 'PROCESSING'
            : eps.some((e) => e.streamStatus === 'FAILED')
              ? 'FAILED'
              : eps.some((e) => e.streamStatus === 'UPLOADED')
                ? 'UPLOADED'
                : 'NONE';

      return {
        ...rest,
        streamStatus: streamStatus as typeof t.streamStatus,
        episodeStats: { total: eps.length, ready },
      };
    });

    return {
      items: await this.media.decorateMany(withStatus),
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
      /**
       * ⚠️⚠️ ANGI-ийн постерыг BATCH presign — өмнө нь давталт дотор
       * `await` байсан (жинхэнэ N+1). `R2_PUBLIC_URL` тохируулсан үед
       * нөлөө бага (шууд string), ГЭВЧ тохируулаагүй орчинд 100 ангитай
       * цуврал = 100 ДАРААЛСАН crypto presign → хуудас олон секунд гацна.
       * Нийтийн тал (`titles.service.ts`) үүнийг зөв хийсэн байсан
       * атлаа админ талд засагдаагүй үлдсэн.
       */
      seasons: await (async () => {
        const allEps = title.seasons.flatMap((s) => s.episodes);
        const epUrls = await this.media.urlMany(allEps.map((e) => e.posterKey));
        const urlById = new Map(allEps.map((e, i) => [e.id, epUrls[i]]));
        return title.seasons.map((s) => ({
          ...s,
          episodes: s.episodes.map((e) => ({ ...e, posterUrl: urlById.get(e.id) ?? null })),
        }));
      })(),
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

    /**
     * ⚠️⚠️ ХҮЧЭЭР УСТГАХ ҮЕД ХЭН ХОХИРСНЫГ БИЧИЖ ҮЛДЭЭНЭ.
     *
     * `Rental` нь Cascade тул мөр нь ҮГҮЙ БОЛНО. `Payment` нь
     * `rentalTitleId: SetNull` тул үлдэх ч ЯМАР кино байсан нь
     * алга болно — «төлбөр байна, юуных нь мэдэгдэхгүй» гэсэн
     * байдалд орж, буцаалт хийхэд гараар ухах шаардлагатай болно.
     *
     * Тиймээс устгахаас ӨМНӨ хохирогчдын жагсаалтыг лог руу бичнэ.
     */
    if (title.rentals.length && force) {
      const victims = await this.prisma.rental.findMany({
        where: { titleId: id, expiresAt: { gt: new Date() } },
        select: {
          userId: true,
          amount: true,
          expiresAt: true,
          paymentId: true,
          user: { select: { email: true } },
        },
      });
      const sum = victims.reduce((s, r) => s + r.amount, 0);
      this.logger.warn(
        `⚠️ ХҮЧЭЭР УСТГАВ: "${title.title}" (${id}) — ${victims.length} идэвхтэй түрээс ` +
          `${sum.toLocaleString()}₮ устлаа. Хохирогчид: ` +
          victims
            .map(
              (v) =>
                `${v.user.email}(${v.amount}₮, дуусах:${v.expiresAt.toISOString()}, payment:${v.paymentId ?? 'null'})`,
            )
            .join(', '),
      );
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

  /**
   * Улирлын НЭР засах.
   * ⚠️ Хоосон мөр = нэрийг УСТГАХ () — тэр үед frontend нь
   * «N-р улирал» гэсэн автомат нэр харуулна.
   */
  async updateSeason(id: string, dto: { name?: string }) {
    const exists = await this.prisma.season.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Улирал олдсонгүй');
    return this.prisma.season.update({
      where: { id },
      data: { name: dto.name?.trim() || null },
    });
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
