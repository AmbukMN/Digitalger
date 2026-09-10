import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ubDayKey } from '../../common/ub-date';
import { Prisma } from '@prisma/client';
import { fillSeo } from './title-seo.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { slugify } from '../../common/slugify';
import { expandQuery } from '../../common/transliterate';
import { TitleMediaHelper } from './title-media.helper';
import { PushService } from '../notifications/push.service';
import { currentSite, runAcrossSites } from '../../common/site/site-context';
import { normalizeSites } from '../../common/site/site-models';
import { assertTitleOnSite } from '../../common/site/site-guard';
import { isSite, SITE_LABEL, type Site } from '../../common/site/site.constants';
import {
  BulkGenreMode,
  CreateEpisodeDto,
  CreateSeasonDto,
  UpdateSeasonDto,
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
    /** ⚠️ Шинэ контент гарахад эрхтэй хэрэглэгчид мэдэгдэнэ */
    private readonly push: PushService,
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
    /** ⚠️ Нүүрний carousel — 'true' | 'false' (заагаагүй бол бүгд) */
    banner?: string;
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
    /* ⚠️ Нүүрний carousel-д гарч буй кино — админ аль нь баннер дээр
       байгааг НЭГ ХАРЦААР мэдэх ёстой (өмнө нь кино бүрийг нээж
       шалгах шаардлагатай байв) */
    if (params.banner === 'true') where.isBanner = true;
    else if (params.banner === 'false') where.isBanner = false;

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
    /** ⚠️ Жагсаалттай ЯГ ИЖИЛ байх ЁСТОЙ — эс бөгөөс дээрх алдаа
        (харсан мөрөөс өөр тоо татагдана) давтагдана */
    banner?: string;
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
          /* ⚠️ UB огноо — `toISOString()` нь UTC тул UB-гийн
             00:00–08:00-д нэмсэн кино ӨМНӨХ өдрөөр бичигдэнэ */
          ubDayKey(r.createdAt),
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
    banner?: string;
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

    /**
     * ⚠️⚠️ HERO ТОХИРГОО — ТУХАЙН САЙТЫНХЫГ буцаана.
     *
     * ⚠️ Админ BestFilm дээр кино нээхэд BestFilm-ийн hero тохиргоо
     *    харагдах ёстой. `Title.isBanner` (ДУНДЫН) -ыг шууд буцаавал
     *    нөгөө сайтын тохиргоог харуулж, админ түүн дээр хадгалахад
     *    өөрийн сайтынхаа тохиргоог дарж бичнэ.
     *
     * ⚠️ Мөр байхгүй бол `Title`-ийн үндсэн утга (fallback) —
     *    `titles.service.ts`-ийн нүүрний логиктой ЯГ ИЖИЛ дүрэм.
     */
    const heroOverride = await this.prisma.titleSiteOrder.findFirst({
      /* ⚠️ `genreId: ''` = hero мөр (жанрын эрэмбийнхээс ялгаатай) */
      where: { titleId: id, genreId: '' },
      select: { order: true, isBanner: true },
    });

    const decorated = await this.media.decorate(title);
    const castRaw = Array.isArray(title.cast)
      ? (title.cast as unknown as { name: string; character?: string; photoKey?: string }[])
      : [];
    const castPhotoUrls = await this.media.urlMany(castRaw.map((c) => c.photoKey));
    const galleryUrls = await this.media.urlMany(title.galleryKeys);

    return {
      ...decorated,
      /* ⚠️ Сайтын hero тохиргоо — мөр байхгүй бол киноны үндсэн утга */
      isBanner: heroOverride?.isBanner ?? title.isBanner,
      bannerOrder: heroOverride?.order ?? title.bannerOrder,
      trailerUrl: await this.media.url(title.trailerKey),
      /* ⚠️ Трейлерийн хөрвүүлэлтийн явц — кино/ангитай ИЖИЛ мэдээлэл
         (админд progress bar, алдааны шалтгаан, файлын нэр) */
      trailerStatus: title.trailerStatus,
      trailerProgress: title.trailerProgress,
      trailerError: title.trailerError,
      trailerFileName: title.trailerFileName,
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
    const { genreIds, cast, slug: rawSlug, sites: rawSites, ...data } = dto;
    const slug = await this.makeUniqueSlug(rawSlug?.trim() || dto.title);

    /**
     * ⚠️⚠️ SEO-г ХООСОН орхихгүй — `title-seo.helper.ts` тайлбар үз.
     *
     * Өмнө нь энэ логик ЗӨВХӨН админ панелийн client талд байсан тул
     * API-аар үүсгэсэн кино SEO-ГҮЙ үлддэг байв (бодит алдаа).
     */
    const seo = fillSeo(data, {
      title: dto.title,
      year: dto.year,
      description: dto.description,
    });

    /**
     * ⚠️⚠️ АЛЬ САЙТАД ХАРАГДАХ ВЭ.
     *
     * БОДИТ АЛДАА (2026-09-08): энэ мөр БАЙГААГҮЙ тул схемийн
     * `sites String[] @default(["besttv"])` үйлчилж, BestFilm-ийн
     * админаар нэмсэн кино BestFilm дээр ОГТ ХАРАГДАХГҮЙ байв —
     * каталог, нүүр, чатбот бүгд алгасна. Админ «нэмсэн ч гарахгүй
     * байна» гэж гомдоно.
     *
     * Одоо: админ сонгосон бол ТҮҮНИЙГ, эс бөгөөс АЖИЛЛАЖ БАЙГАА
     * сайтад (`currentSite()`) — BestFilm дээр нэмсэн кино BestFilm-д.
     */
    const sites = normalizeSites(rawSites) ?? [currentSite()];

    return this.prisma.title.create({
      data: {
        ...data,
        ...seo,
        sites,
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

    const {
      genreIds,
      cast,
      slug: rawSlug,
      sites: rawSites,
      /**
       * ⚠️⚠️ HERO БАННЕР — `Title`-Д БИШ `TitleSiteOrder`-Т БИЧНЭ.
       *
       * ⛔ БОДИТ ХЭРЭГЦЭЭ (2026-09-10): «nuur huudsand haragdaj baigaa
       *    kinonoos garch baigaa undsen banner tohirgoo tusdaa baih
       *    estoi» — сайт бүр өөрийн hero-той байх ёстой.
       *
       * ⚠️ `Title.isBanner`/`bannerOrder` нь ДУНДЫН тул нэг сайтад
       *    hero-д нэмэхэд нөгөөд нь ч гардаг байв.
       * ⚠️ Хуучин баганууд ХЭВЭЭР үлдэнэ — мөр байхгүй үеийн fallback
       *    (`titles.service.ts`-ийн `heroBy` логикийг үз).
       */
      isBanner,
      bannerOrder,
      ...data
    } = dto;
    const castData = cast ? { cast: cast as unknown as Prisma.InputJsonValue } : {};

    /**
     * ⚠️⚠️ САЙТЫН ХАРАГДАЦ — ЗӨВХӨН админ ЗОРИУД илгээсэн үед солино.
     *
     * `normalizeSites` нь буруу/хоосон утгад `null` буцаадаг тул
     * тэр үед талбар ОГТ хөндөгдөхгүй (`{}`). Энэ нь чухал: админ
     * зөвхөн гарчиг засахад форм `sites` илгээгээгүй бол кино
     * ХОЁУЛАНГААС нь алга болох ёсгүй.
     */
    const sitesData = (() => {
      const clean = normalizeSites(rawSites);
      if (!clean) return {};
      /**
       * ⚠️⚠️ ӨӨРИЙН САЙТААС ХАСАХЫГ ХОРИГЛОНО — `bulkSetSite`-тай ИЖИЛ.
       *
       * ⛔ Аудитаар илэрсэн (2026-09-09): `bulkSetSite` (мөр ~828) нь
       * 3 хамгаалалттай (хоосон болгохгүй, өөрийн сайтаас хасахгүй,
       * нэмэх/хасах) атал ГАНЦ киноны `update` нь `sites`-ыг ШУУД
       * дарж бичдэг байв.
       *
       * Үр дагавар: BestTV-ийн админ `{"sites":["besttv"]}` илгээвэл
       * кино BestFilm-ийн каталог/нүүр/хайлт/чатботоос ШУУД алга
       * болно. `{"sites":["bestfilm"]}` бол өөрийн панелаасаа ч
       * харагдахгүй болж, буцаах ганц зам нь DB гар засвар.
       *
       * ⚠️ BestTV-д ЭЕРЭГ нөлөө: санамсаргүй хасахаас хамгаална.
       * Зориуд хасах бол bulk үйлдэл ашиглана (тэнд баталгаажуулалттай).
       */
      if (!clean.includes(currentSite()) && existing.sites.includes(currentSite())) {
        throw new BadRequestException(
          'Киног өөрийн сайтаас хасах боломжгүй — жагсаалтаас сонгоод bulk үйлдэл ашиглана уу',
        );
      }
      return { sites: clean };
    })();

    /**
     * ⚠️ Slug засах — ЗӨВХӨН админ гараар өөрчилсөн үед.
     * Гарчиг өөрчлөгдөхөд slug АВТОМАТААР солигдохгүй: хуучин линк
     * (Google index, сошиал хуваалцалт, чатбот) бүгд эвдэрнэ.
     */
    const slugData =
      rawSlug?.trim() && slugify(rawSlug) !== existing.slug
        ? { slug: await this.makeUniqueSlug(rawSlug, id) }
        : {};

    /**
     * ⚠️⚠️ SEO ХООСОН бол нөхнө — `title-seo.helper.ts` тайлбар үз.
     *
     * ⚠️ Утгатай байвал ХЭЗЭЭ Ч дарж бичихгүй: админ гараар
     *    тохируулсан SEO нь автоматаас илүү үнэ цэнэтэй.
     * ⚠️ Эх сурвалж нь ШИНЭЧЛЭГДСЭН утга — гарчиг/он/тайлбар
     *    өөрчлөгдөж байвал шинээр нь ашиглана (`?? existing`).
     */
    const seo = fillSeo(
      {
        metaTitle: data.metaTitle ?? existing.metaTitle,
        metaDescription: data.metaDescription ?? existing.metaDescription,
      },
      {
        title: data.title ?? existing.title,
        year: data.year ?? existing.year,
        description: data.description ?? existing.description,
      },
    );

    return this.prisma.$transaction(async (tx) => {
      if (genreIds) {
        await tx.titleGenre.deleteMany({ where: { titleId: id } });
        await tx.titleGenre.createMany({
          data: genreIds.map((genreId, i) => ({ titleId: id, genreId, order: i })),
        });
      }
      /**
       * ⚠️⚠️ HERO БАННЕР — ТУХАЙН САЙТАД л үйлчилнэ.
       *
       * ⚠️ Админ `isBanner`/`bannerOrder`-ыг ЗОРИУД илгээсэн үед л
       *    хөндөнө. Зөвхөн гарчиг засахад форм эдгээрийг илгээгээгүй
       *    бол hero тохиргоо ХЭВЭЭР үлдэнэ (`undefined` шалгалт).
       *
       * ⚠️ `upsert` — тухайн сайтад анх удаа тохируулж байгаа киноны
       *    мөр хараахан байхгүй. `genreId: null` нь «hero мөр» гэсэн
       *    утгатай (жанрын эрэмбийн мөрөөс ялгагдана).
       */
      if (isBanner !== undefined || bannerOrder !== undefined) {
        const site = currentSite();
        const patch = {
          ...(isBanner !== undefined ? { isBanner } : {}),
          ...(bannerOrder !== undefined ? { order: bannerOrder } : {}),
        };

        /**
         * ⚠️ `genreId: ''` = HERO мөр (жанрын эрэмбийн мөрөөс ялгагдана).
         * ⚠️ Хоосон мөр нь `Genre.id`-д тохиолдохгүй (cuid = 25 тэмдэгт).
         */
        await tx.titleSiteOrder.upsert({
          where: { titleId_genreId_site: { titleId: id, genreId: '', site } },
          create: { titleId: id, genreId: '', site, ...patch },
          update: patch,
        });
      }

      return tx.title.update({
        where: { id },
        data: { ...data, ...seo, ...castData, ...slugData, ...sitesData },
      });
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

    /**
     * ⚠️⚠️ НӨГӨӨ САЙТАД БАЙГАА БОЛ УСТГАХГҮЙ — ЗӨВХӨН ХАСНА.
     *
     * ⛔ БОДИТ ЭРСДЭЛ (2026-09-09 аудит): `Title` нь SHARED модел
     * (`sites[]`) бөгөөд бүх 257 кино ХОЁУЛАНД нь бий. `delete` нь
     * site шүүлт авдаггүй тул нэг сайтын админ устгахад:
     *   · DB мөр бүрмөсөн устана (Season/Episode/Subtitle cascade)
     *   · `cleanupR2` нь НӨГӨӨ САЙТЫН ч урсгаж буй HLS файлыг устгана
     * R2 versioning OFF тул СЭРГЭЭХ БОЛОМЖГҮЙ.
     *
     * ⚠️ `bulkSetSite` (мөр ~828) нь энэ хамгаалалттай байсан —
     * устгах зам нь л мартагдсан.
     */
    if (title.sites.length > 1) {
      const next = title.sites.filter((x) => x !== currentSite());
      await this.prisma.title.update({ where: { id }, data: { sites: next } });
      this.logger.log(
        `«${title.title}» нь ${next.join(', ')} сайтад ҮЛДСЭН тул устгасангүй — ` +
          `${currentSite()}-аас хаслаа (R2 файл хэвээр)`,
      );
      return { ok: true, removedFromSite: true, remainingSites: next };
    }

    await this.prisma.title.delete({ where: { id } });

    // Fire-and-forget цэвэрлэгээ (DB устгал амжилттай болсны ДАРАА)
    this.cleanupR2(keys, prefixes);

    return { ok: true };
  }

  /**
   * ⚠️⚠️ БАЙРШУУЛСАН ТРЕЙЛЕРИЙГ УСТГАНА (R2 + DB).
   *
   * Админ буруу видео оруулсан эсвэл YouTube хувилбар руу буцахыг
   * хүсвэл ЗАМ БАЙХ ЁСТОЙ. Өмнө нь трейлер нэг л удаа орж, дараа нь
   * СОЛИХ/УСТГАХ БОЛОМЖГҮЙ байв — зөвхөн шинийг дээр нь бичих
   * (хуучин HLS хавтас R2-д үүрд үлдэж, хадгалалтын төлбөр өснө).
   *
   * ⚠️ HLS нь ОЛОН файлын хавтас (master + variant + segment) тул
   * ганц key биш, БҮХ prefix-ийг цэвэрлэнэ.
   *
   * ⚠️ `trailerYoutubeKey`-д ГАР ХҮРЭХГҮЙ — тэр нь ТУСДАА талбар.
   * HLS устмагц YouTube хувилбар (байвал) автоматаар идэвхжинэ.
   */
  async removeTrailer(id: string) {
    const title = await this.prisma.title.findUnique({
      where: { id },
      select: { trailerKey: true, trailerYoutubeKey: true },
    });
    if (!title) throw new NotFoundException('Контент олдсонгүй');
    if (!title.trailerKey) {
      throw new BadRequestException('Байршуулсан трейлер алга');
    }

    const prefix = this.hlsPrefix(title.trailerKey);
    await this.prisma.title.update({
      where: { id },
      data: { trailerKey: null },
    });

    /* ⚠️ DB амжилттай болсны ДАРАА — R2 унасан ч трейлер нь админд
       "устсан" харагдана (дахин байршуулах боломжтой). */
    this.cleanupR2([], [prefix]);

    return { ok: true, youtubeFallback: title.trailerYoutubeKey ?? null };
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
        /* ⚠️ `sites` — диалог ҮНЭНИЙГ хэлэхэд ЗААВАЛ (доор) */
        sites: true,
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
      /**
       * ⚠️⚠️ НӨГӨӨ САЙТАД БАЙГАА ЭСЭХ — диалог ХУДАЛ айлгахаас сэргийлнэ.
       *
       * ⛔ Аудитаар илэрсэн (2026-09-09): диалог «Видео, зураг, HLS
       * файлууд R2-оос БҮРМӨСӨН устана» гэж бичдэг байсан ч кино
       * нөгөө сайтад ч байвал R2 ОГТ хөндөгдөхгүй (зөвхөн `sites[]`-
       * ээс хасагдана). Админ буруу мэдээллээр шийдвэр гаргана.
       */
      sharedWithOtherSite: t.sites.length > 1,
      inMyList: t._count.myList,
      reviews: t._count.reviews,
      activeRentals: t.rentals.length,
      rentalAmount: t.rentals.reduce((s, r) => s + r.amount, 0),
    }));

    return {
      total: items.length,
      /** ⚠️ Хэд нь нөгөө сайтад ҮЛДЭХ вэ — R2 файл ХЭВЭЭР */
      sharedCount: items.filter((i) => i.sharedWithOtherSite).length,
      /** ⚠️ Хэд нь БҮРЭН устах вэ — R2 файл ч устана */
      hardDeleteCount: items.filter((i) => !i.sharedWithOtherSite).length,
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

    /**
     * ⚠️⚠️ НӨГӨӨ САЙТАД БАЙГААГ УСТГАХГҮЙ — `remove()`-тэй ИЖИЛ.
     *
     * Хоёр бүлэгт хуваана:
     *   · `shared` — нөгөө сайтад ч бий → зөвхөн `sites[]`-ээс хасна,
     *     R2 файл ХЭВЭЭР (нөгөө сайт урсгасаар байна)
     *   · `only`   — зөвхөн энэ сайтынх → бүрэн устгана + R2 цэвэрлэнэ
     */
    const shared = titles.filter((t) => t.sites.length > 1);
    const only = titles.filter((t) => t.sites.length <= 1);

    for (const t of shared) {
      await this.prisma.title.update({
        where: { id: t.id },
        data: { sites: t.sites.filter((x) => x !== currentSite()) },
      });
    }

    const foundIds = only.map((t) => t.id);
    const { count } = foundIds.length
      ? await this.prisma.title.deleteMany({ where: { id: { in: foundIds } } })
      : { count: 0 };

    /**
     * ⚠️ R2-г ЗӨВХӨН бүрэн устгасан кинонд — `shared`-ийн файлыг
     * цэвэрлэвэл нөгөө сайтын урсгал ТАСАРНА.
     */
    if (foundIds.length) {
      const onlyIds = new Set(foundIds);
      const k2: string[] = [];
      const p2: string[] = [];
      for (const t of only) {
        if (!onlyIds.has(t.id)) continue;
        for (const k of [t.posterKey, t.backdropKey, t.videoRawKey]) if (k) k2.push(k);
        k2.push(...t.galleryKeys, ...castPhotoKeys(t.cast));
        if (t.videoKey) p2.push(this.hlsPrefix(t.videoKey));
        if (t.trailerKey) p2.push(this.hlsPrefix(t.trailerKey));
        for (const se of t.seasons) {
          for (const e of se.episodes) {
            if (e.posterKey) k2.push(e.posterKey);
            if (e.videoRawKey) k2.push(e.videoRawKey);
            if (e.videoKey) p2.push(this.hlsPrefix(e.videoKey));
          }
        }
      }
      this.cleanupR2(k2, p2);
    }

    if (shared.length) {
      this.logger.log(
        `Bulk: ${shared.length} контент нөгөө сайтад үлдсэн тул ` +
          `${currentSite()}-аас л хаслаа (R2 файл хэвээр)`,
      );
    }

    this.logger.log(`Bulk устгал: ${count} контент бүрэн устгав`);
    return {
      ok: true,
      deleted: count,
      removedFromSite: shared.length,
      files: keys.length,
      hlsFolders: prefixes.length,
    };
  }

  /** Идэвх (нийтлэгдсэн эсэх) бөөнөөр солих */
  async bulkSetActive(ids: string[], isActive: boolean) {
    this.assertBulk(ids);

    /* ⚠️ Аль нь ШИНЭЭР идэвхжиж байгааг ӨМНӨ нь тэмдэглэнэ — аль хэдийн
       идэвхтэй байсан кинонд дахин мэдэгдэл явуулах ЁСГҮЙ */
    const newlyActive = isActive
      ? await this.prisma.title.findMany({
          where: { id: { in: ids }, isActive: false },
          select: { id: true, title: true, slug: true },
        })
      : [];

    const { count } = await this.prisma.title.updateMany({
      where: { id: { in: ids } },
      data: { isActive },
    });

    /* ⚠️ Push нь `void` — идэвхжүүлэлт мэдэгдлээс болж зогсох ЁСГҮЙ */
    for (const t of newlyActive) void this.notifyNewTitle(t.id, t.title, t.slug);

    return { ok: true, updated: count };
  }

  /**
   * Сонгосон киног тухайн САЙТАД нэмэх / хасах (бөөнөөр).
   *
   * ⚠️⚠️ МАССИВЫГ ДАРЖ БИЧИХГҮЙ — НЭМЭХ/ХАСАХ.
   *
   * 257 кино одоо хоёуланд нь бий. Хэрэв `sites = [site]` гэж дарж
   * бичвэл «BestFilm-д нэмэх» товч нь тэдгээрийг BestTV-ЭЭС УСТГАНА
   * — production сайт хоосорч, хэрэглэгч төлбөр төлсөн контентоо
   * алдана. Тиймээс одоогийн массивыг уншиж, зөвхөн нэг элемент
   * нэмнэ/хасна.
   *
   * ⚠️⚠️ СҮҮЛИЙН САЙТЫГ ХАСАХГҮЙ: `sites` хоосон болвол кино ХААНА Ч
   * харагдахгүй — DB-д мөр байгаа ч каталог, нүүр, хайлт, чатбот
   * бүгд алгасна. Админ «устсан юм болов уу» гэж эргэлзэнэ. Тийм
   * киног алгасаж, тайланд ЯГ хэлнэ.
   *
   * ⚠️ `updateMany` нь массивд элемент нэмэх үйлдлийг ДЭМЖДЭГГҮЙ
   * (Prisma-д `push` нь зөвхөн `update`-д) тул мөр бүрээр шинэчилнэ.
   * Тоо цөөн (админ гар сонголт) тул транзакц хангалттай.
   */
  async bulkSetSite(ids: string[], site: string, enabled: boolean) {
    this.assertBulk(ids);
    if (!isSite(site)) {
      throw new BadRequestException(`Танихгүй сайт: ${site}`);
    }

    /* ⚠️ `withAllSites` — админ НӨГӨӨ сайтын киног ч засаж чадах ёстой
       (BestTV-ийн админ «BestFilm-д нэмэх» гэж дарж байна) */
    const rows = await runAcrossSites(() =>
      this.prisma.title.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, sites: true },
      }),
    );

    const updates: { id: string; sites: string[] }[] = [];
    const blocked: string[] = [];
    let unchanged = 0;

    for (const r of rows) {
      const has = r.sites.includes(site);
      if (has === enabled) {
        unchanged++;
        continue;
      }
      const next = enabled
        ? [...r.sites, site]
        : r.sites.filter((s) => s !== site);

      /* ⚠️ Сүүлийн сайтыг хасахгүй — доорх тайлбарыг үз */
      if (next.length === 0) {
        blocked.push(r.title);
        continue;
      }

      /**
       * ⚠️⚠️ ӨӨРИЙН САЙТААС ХАСАХЫГ ХОРИГЛОНО.
       *
       * БОДИТ ЭРСДЭЛ (тестээр илэрсэн): BestTV-ийн админ панелд сууж
       * байгаад «BestTV-ээс хасах» дарвал кино production сайтаас
       * ШУУД алга болно. Бүр дордуулж, тэр кино дараа нь өөрийн
       * панелд ХАРАГДАХАА БОЛЬДОГ (`sites` дотор `besttv` алга) тул
       * буцааж нэмэх ч боломжгүй — зөвхөн DB-ээс гараар засна.
       *
       * Нөгөө сайтаас хасах нь зүгээр (тэр сайтын админ шалгаж чадна).
       */
      if (!enabled && site === currentSite()) {
        blocked.push(r.title);
        continue;
      }

      updates.push({ id: r.id, sites: next });
    }

    if (updates.length) {
      await runAcrossSites(() =>
        this.prisma.$transaction(
          updates.map((u) =>
            this.prisma.title.update({ where: { id: u.id }, data: { sites: u.sites } }),
          ),
        ),
      );
    }

    this.logger.log(
      `Bulk site: ${site} ${enabled ? 'нэмэв' : 'хасав'} — ` +
        `${updates.length} кино (хэвээр ${unchanged}, хаагдсан ${blocked.length})`,
    );

    return {
      ok: true,
      updated: updates.length,
      unchanged,
      /* ⚠️ Админд ЯГ хэлнэ — чимээгүй алгасвал «яагаад болсонгүй» гэнэ */
      blocked,
      /**
       * ⚠️ Блоклох ХОЁР шалтгаан бий — админд ЯЛГАЖ хэлнэ, эс бөгөөс
       * «яагаад болсонгүй» гэдгийг ойлгохгүй.
       */
      message: blocked.length
        ? !enabled && site === currentSite()
          ? `${blocked.length} кино хасагдсангүй — өөрийн сайтаасаа хасах ` +
            `боломжгүй. ${SITE_LABEL[site]}-ээс хасах бол нөгөө сайт руу ` +
            `шилжиж, тэндээс хасна уу.`
          : `${blocked.length} кино хасагдсангүй — тэдгээр нь зөвхөн энэ ` +
            `сайтад байгаа тул хасвал хаана ч харагдахгүй болно`
        : undefined,
    };
  }

  /**
   * ⚠️⚠️ ШИНЭ КОНТЕНТ ГАРСАН — ЗӨВХӨН ТУХАЙН ЖАНРЫН ЭРХТЭЙ хэрэглэгчид.
   *
   * Бүх хэрэглэгч рүү илгээвэл:
   *   · эрхгүй хүн мэдэгдэл дараад «үзэх боломжгүй» гэж уурлана
   *   · спам гэж үзэж push-ыг бүрмөсөн унтраана (буцаах аргагүй)
   *
   * Тиймээс тухайн киноны ЖАНРЫГ агуулсан идэвхтэй багцтай (эсвэл VIP)
   * хэрэглэгчид л мэдэгдэнэ.
   */
  private async notifyNewTitle(titleId: string, title: string, slug: string): Promise<void> {
    try {
      const genres = await this.prisma.titleGenre.findMany({
        where: { titleId },
        select: { genreId: true },
      });
      if (!genres.length) return;
      const genreIds = genres.map((g) => g.genreId);
      const now = new Date();

      /* ⚠️ VIP нь БҮХ жанрыг нээдэг тул тэднийг ч оруулна */
      const subs = await this.prisma.subscription.findMany({
        where: {
          expiresAt: { gt: now },
          OR: [
            { plan: { isVip: true } },
            { plan: { genres: { some: { genreId: { in: genreIds } } } } },
          ],
        },
        select: { userId: true },
        distinct: ['userId'],
        /* ⚠️ Дээд хязгаар — нэг удаад хэт олон push нь Expo-гийн
           rate limit-д мөргөнө. Цаашид дараалалд шилжүүлнэ. */
        take: 2000,
      });
      if (!subs.length) return;

      await this.push.sendToUsers(
        subs.map((x) => x.userId),
        'Шинэ контент',
        `«${title}» нэмэгдлээ`,
        { link: `/title/${slug}` },
      );
      this.logger.log(`Шинэ контент push: ${title} → ${subs.length} хэрэглэгч`);
    } catch (e) {
      this.logger.warn(`Шинэ контентын push амжилтгүй (${title}): ${String(e)}`);
    }
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

  /**
   * ЖАНР бөөнөөр солих — нэмэх / хасах / бүрэн солих.
   *
   * ⚠️⚠️ ЯАГААД ГУРВАН ГОРИМ ВЭ: кино нь ОЛОН жанрт зэрэг харьяалагдана.
   * Ганц «солих» горимтой байсан бол «С-drama доторх AI кинонуудыг AI
   * багц руу» зөөх үед тэдгээрийн БУСАД жанр (ж: «Монгол кино») чимээгүй
   * устана. Админ үүнийг хардаггүй тул `add` нь АНХДАГЧ горим.
   *
   * ⚠️ `order` — TitleGenre-д эрэмбэ бий. Нэмэхдээ ХАМГИЙН СҮҮЛД тавина,
   * эс бөгөөс шинэ жанр эхний байрыг булааж, картан дээрх үндсэн шошго
   * өөрчлөгдөнө.
   */
  async bulkSetGenres(ids: string[], genreIds: string[], mode: BulkGenreMode) {
    this.assertBulk(ids);

    /* ⚠️ `replace` нь ХООСОН жагсаалт зөвшөөрнө (бүх жанрыг арилгах),
       харин `add`/`remove` нь утгагүй болно. */
    if (!genreIds.length && mode !== BulkGenreMode.REPLACE) {
      throw new BadRequestException('Нэг ч жанр сонгоогүй байна');
    }

    /* ⚠️ Байхгүй жанрын ID ирвэл createMany нь FK алдаагаар унана —
       УРЬДЧИЛАН шалгаж ОЙЛГОМЖТОЙ мессеж өгнө. */
    if (genreIds.length) {
      const found = await this.prisma.genre.findMany({
        where: { id: { in: genreIds } },
        select: { id: true },
      });
      if (found.length !== genreIds.length) {
        throw new BadRequestException('Сонгосон жанруудын зарим нь олдсонгүй');
      }
    }

    /* ⚠️ Байхгүй Title-ыг чимээгүй алгасахгүй — админд ХЭД засагдсаныг
       үнэн зөвөөр хэлнэ. */
    const titles = await this.prisma.title.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (!titles.length) throw new NotFoundException('Сонгосон контент олдсонгүй');
    const titleIds = titles.map((t) => t.id);

    await this.prisma.$transaction(async (tx) => {
      if (mode === BulkGenreMode.REMOVE) {
        await tx.titleGenre.deleteMany({
          where: { titleId: { in: titleIds }, genreId: { in: genreIds } },
        });
        return;
      }

      if (mode === BulkGenreMode.REPLACE) {
        await tx.titleGenre.deleteMany({ where: { titleId: { in: titleIds } } });
        if (genreIds.length) {
          await tx.titleGenre.createMany({
            data: titleIds.flatMap((titleId) =>
              genreIds.map((genreId, i) => ({ titleId, genreId, order: i })),
            ),
          });
        }
        return;
      }

      // ── ADD: байгаа дээр нь нэмнэ ──
      /* ⚠️ Аль хэдийн байгаа хосыг ДАХИН үүсгэвэл unique зөрчинө.
         Тиймээс кино тус бүрийн одоогийн жанрыг уншиж, ЗӨВХӨН
         дутууг нь эрэмбийн ард залгана. */
      const existing = await tx.titleGenre.findMany({
        where: { titleId: { in: titleIds } },
        select: { titleId: true, genreId: true, order: true },
      });

      const byTitle = new Map<string, { has: Set<string>; maxOrder: number }>();
      for (const id of titleIds) byTitle.set(id, { has: new Set(), maxOrder: -1 });
      for (const e of existing) {
        const row = byTitle.get(e.titleId)!;
        row.has.add(e.genreId);
        if (e.order > row.maxOrder) row.maxOrder = e.order;
      }

      const rows: { titleId: string; genreId: string; order: number }[] = [];
      for (const [titleId, row] of byTitle) {
        let order = row.maxOrder;
        for (const genreId of genreIds) {
          if (row.has.has(genreId)) continue; // аль хэдийн байна
          order += 1;
          rows.push({ titleId, genreId, order });
        }
      }
      if (rows.length) await tx.titleGenre.createMany({ data: rows });
    });

    this.logger.log(
      `Bulk жанр (${mode}): ${titleIds.length} контент, ${genreIds.length} жанр`,
    );
    return { ok: true, updated: titleIds.length };
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
   * ⚠️⚠️ УЛИРАЛ/АНГИ ЭНЭ САЙТЫНХ ЭСЭХИЙГ БАТАЛНА.
   *
   * ⛔ БОДИТ ЦООРХОЙ (2026-09-09 аудит): `Season`/`Episode` нь
   * SHARED модел (`site` баганагүй) бөгөөд тайлбар нь «Title-ийн
   * `sites[]`-ээр хянагдана» гэдэг. ГЭТЭЛ эдгээр endpoint нь Title-ыг
   * ОГТ шалгадаггүй байв:
   *   · `updateEpisode` — шалгалт ТЭГ
   *   · `removeSeason`/`removeEpisode` — R2 файлыг ЭРГЭЛТ БУЦАЛТГҮЙ устгана
   *
   * Скан 1-д 9 endpoint дээр ижил алдааг зассан — эдгээр 4 орхигдсон.
   *
   * ⚠️ 257/257 кино хоёр сайтад байгаа тул одоогоор далд. Аль нэг
   * сайтад л нийтлэгдсэн кино гармагц ШУУД идэвхтэй болно.
   */
  private async assertSeasonOnSite(seasonId: string): Promise<void> {
    const row = await this.prisma.season.findUnique({
      where: { id: seasonId },
      select: { title: { select: { sites: true } } },
    });
    if (!row) throw new NotFoundException('Улирал олдсонгүй');
    assertTitleOnSite(row.title?.sites, 'Улирал олдсонгүй');
  }

  private async assertEpisodeOnSite(episodeId: string): Promise<void> {
    const row = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      select: { season: { select: { title: { select: { sites: true } } } } },
    });
    if (!row) throw new NotFoundException('Анги олдсонгүй');
    assertTitleOnSite(row.season?.title?.sites, 'Анги олдсонгүй');
  }

  /**
   * Улирлын НЭР засах.
   * ⚠️ Хоосон мөр = нэрийг УСТГАХ () — тэр үед frontend нь
   * «N-р улирал» гэсэн автомат нэр харуулна.
   */
  async updateSeason(id: string, dto: UpdateSeasonDto) {
    await this.assertSeasonOnSite(id);
    return this.prisma.season.update({
      where: { id },
      data: {
        /* ⚠️ `name` талбар ИРСЭН үед л хөндөнө — зөвхөн `isVisible`
           илгээхэд нэрийг санамсаргүй устгахгүй */
        ...(dto.name !== undefined ? { name: dto.name.trim() || null } : {}),
        ...(dto.isVisible !== undefined ? { isVisible: dto.isVisible } : {}),
      },
    });
  }

  async removeSeason(id: string) {
    /* ⚠️ R2 устгал ЭРГЭЛТ БУЦАЛТГҮЙ — сайт заавал шалгана */
    await this.assertSeasonOnSite(id);
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
    await this.assertSeasonOnSite(seasonId);
    return this.prisma.episode.create({ data: { seasonId, ...dto } });
  }

  async updateEpisode(id: string, dto: UpdateEpisodeDto) {
    await this.assertEpisodeOnSite(id);
    return this.prisma.episode.update({ where: { id }, data: dto });
  }

  async removeEpisode(id: string) {
    /* ⚠️ R2 устгал ЭРГЭЛТ БУЦАЛТГҮЙ — сайт заавал шалгана */
    await this.assertEpisodeOnSite(id);
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
