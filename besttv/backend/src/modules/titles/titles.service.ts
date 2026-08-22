import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, TitleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { expandQuery } from '../../common/transliterate';
import {
  isShortWord,
  matchesWholeWord,
  matchesWordStart,
  mnStem,
  parseQuery,
} from '../../common/search-text';
import { TitleMediaHelper } from './title-media.helper';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CacheService } from '../../common/cache/cache.service';

// Card жагсаалтад хэрэгтэй хөнгөн select (videoKey зэрэг нууц талбар ОРОХГҮЙ)
const CARD_SELECT = {
  id: true,
  type: true,
  title: true,
  slug: true,
  posterKey: true,
  backdropKey: true,
  isPremium: true,
  rating: true,
  year: true,
  views: true,
  comingSoon: true,
  createdAt: true,
  // ⚠️ Хэл — картан дээр 🇲🇳 "Хэл" / "Хадмал" шошго харуулна
  language: true,
  /**
   * ⚠️ Видео бэлэн эсэх — картан дээр "Бэлтгэж байна" шошго болно.
   * Эс бөгөөс хөрвүүлэлт дуусаагүй кино ялгагдахгүй харагдаж, хэрэглэгч
   * дараад л "Видео бэлтгэгдэж байна" гэсэн бичигтэй тулгардаг.
   */
  streamStatus: true,
  /**
   * ⚠️⚠️ ЦУВРАЛЫН СТАТУС — `Title.streamStatus` нь ХУДАЛ.
   *
   * SERIES-ийн видео нь `Episode` дээр байдаг тул эцэг `Title`-ийн
   * `streamStatus` нь ХЭЗЭЭ Ч READY болдоггүй — 10/10 анги бүрэн
   * хөрвүүлсэн ч карт дээр "Бэлтгэж байна" гэж ХУДЛАА гардаг байв
   * (Agent Kim Reactivated).
   *
   * Тиймээс ангиудынх нь статусыг татаж `decorate()` дотор БОДИТ
   * статусыг тооцно. `_count` биш `select` — статус бүрийг үзэх ёстой,
   * гэхдээ зөвхөн 1 талбар тул хөнгөн.
   */
  seasons: {
    /* ⚠️ Нуусан улирал/анги картын «бэлэн» статусыг гажуудуулах ёсгүй —
       админ нуусан ангийг тоолвол видеогүй кино «Үзэх боломжтой» болно */
    where: { isVisible: true },
    select: {
      episodes: { where: { isVisible: true }, select: { streamStatus: true } },
    },
  },
  // ⚠️ Жанр — карт дээр аль ангилалд багтахыг харуулна (админ хүсэлт).
  // Хэрэглэгч ямар багц авбал үзэхээ шууд ойлгоно.
  genres: {
    orderBy: { order: 'asc' as const },
    take: 2,
    select: { genre: { select: { id: true, name: true, slug: true, isAdult: true } } },
  },
} satisfies Prisma.TitleSelect;

/**
 * ⚠️⚠️ 18+ ШҮҮЛТ БҮРМӨСӨН ХАСАГДСАН (админы шийдвэр, 2026-08-15).
 *
 * Өмнө нь `NOT_ADULT` шүүлт нь насанд хүрэгчдийн жанртай контентыг
 * нүүр/кино/цуврал/хайлт/баннер/ижил төстэй БҮХ ГАЗРААС хасдаг байв.
 * Тиймээс админ 18+ киног баннерт тавихыг оролдоход ЧИМЭЭГҮЙ
 * харагдахгүй байсан (тохиргоо хадгалагдсан ч үр дүнгүй).
 *
 * Одоо 18+ контент нь БУСАД контенттой АДИЛХАН — хаана ч гарна.
 * `/adult` хуудас нь ХЭВЭЭР үлдэнэ (тэнд зөвхөн 18+ жанрыг шүүнэ),
 * гэхдээ тэр нь нэмэлт хэсэг болохоос хориг биш.
 *
 * ⚠️ Дахин хориглох шаардлага гарвал энэ тогтмолыг сэргээхээс илүү
 *    хэрэглэгчийн НАС БАТАЛГААЖУУЛАЛТ дээр тулгуурласан шийдэл хий —
 *    контентыг бүрмөсөн нуух нь админд ойлгомжгүй байдал үүсгэдэг.
 */

/** sitemap.xml стандартын дээд хязгаар */
const SITEMAP_MAX = 50_000;

@Injectable()
export class TitlesService {
  private readonly logger = new Logger(TitlesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: TitleMediaHelper,
    private readonly subs: SubscriptionsService,
    /* ⚠️ Нүүрний кэш + үзэлтийн давхардал шүүлт (@Global тул import хэрэггүй) */
    private readonly cache: CacheService,
  ) {}

  // ─── Нүүр хуудас ────────────────────────────────────────────────────────────

  /**
   * Нүүр хуудас.
   *
   * ⚠️⚠️ ХОЁР ХЭСЭГТ ХУВААСАН:
   *   `homeShared()` — БҮХ зочинд ижил (banner/шинэ/жанр/top10) → КЭШТЭЙ
   *   `continueWatching` — хэрэглэгч тус бүрийнх → кэшлэхгүй
   *
   * ЯАГААД: нүүр бол хамгийн их зочилдог хуудас бөгөөд хүсэлт бүрд
   * 6 их асуулга хийдэг байв (жанр бүрд nested 20 кино). 1000 зэрэг
   * зочин = 6000 асуулга/минут. Одоо 90 секундэд НЭГ л удаа.
   *
   * ⚠️ Кэш унасан ч сайт ажиллана (`wrap` нь алдааг залгиж шууд тооцно).
   */
  async home(userId?: string | null) {
    const [shared, continueWatching] = await Promise.all([
      this.cache.wrap('home:v1', 90, () => this.homeShared()),
      userId ? this.continueWatching(userId) : Promise.resolve([]),
    ]);
    return { ...shared, continueWatching };
  }

  private async homeShared() {
    const [banners, newReleases, comingSoon, genres, popular] =
      await Promise.all([
        // Hero carousel — backdrop + trailer
        this.prisma.title.findMany({
          where: { isBanner: true, isActive: true },
          orderBy: { bannerOrder: 'asc' },
          take: 8,
          select: {
            ...CARD_SELECT,
            description: true,
            trailerKey: true,
            /**
             * ⚠️⚠️ `id` ЗААВАЛ — frontend-ийн `accessState()` нь хэрэглэгчийн
             * `accessGenreIds`-ыг жанрын ID-аар тулгадаг. `id` байхгүй бол
             * тулгалт ҮРГЭЛЖ бүтэлгүйтэж, БАГЦТАЙ хэрэглэгчид ч hero дээр
             * "Багц авах" гэж харагддаг байв (бодит гомдол).
             */
            genres: { include: { genre: { select: { id: true, name: true, slug: true } } } },
          },
        }),
        this.prisma.title.findMany({
          where: { isActive: true, hideFromNew: false, comingSoon: false },
          orderBy: [{ newReleasesOrder: 'asc' }, { createdAt: 'desc' }],
          take: 20,
          select: CARD_SELECT,
        }),
        this.prisma.title.findMany({
          where: { isActive: true, comingSoon: true },
          orderBy: { comingSoonOrder: 'asc' },
          take: 20,
          select: CARD_SELECT,
        }),
        // Жанрын мөрүүд — order-той, тус бүр 20 title.
        // ⚠️ 18+ жанрыг НҮҮРЭНД ХАРУУЛНА (админ хүсэлт). Тухайн мөрийн
        // кинонууд эрхгүй үед lock тэмдэгтэй харагдана — багц авбал нээгдэнэ.
        this.prisma.genre.findMany({
          /**
           * ⚠️ ХООСОН ЖАНРЫГ DB ТАЛД шүүнэ. Өмнө нь бүх жанрыг татаад
           * JS-д `titles.length > 0` гэж шүүдэг байсан тул хоосон жанр
           * бүрд nested LATERAL JOIN дэмий явдаг байв.
           */
          where: { titles: { some: { title: { isActive: true, comingSoon: false } } } },
          orderBy: { order: 'asc' },
          /**
           * ⚠️ ГАДНА `take` — админ 50 жанр нэмбэл 50×20 = 1000 мөр нэг
           * хариунд орно. Нүүрэнд 15 эгнээ хангалттай (доош гүйлгэхэд
           * хэрэглэгч ядардаг), илүү нь `/movies` каталогт бий.
           */
          take: 15,
          include: {
            titles: {
              where: { title: { isActive: true, comingSoon: false } },
              /**
               * ⚠️⚠️ ШИНЭ КИНО ЭХЭНД ГАРНА.
               *
               * `order` ГАНЦААРАА хангалтгүй байв: админ гараар эрэмбэ
               * өгөөгүй тул БҮХ бичлэгийн `order = 0` бөгөөс Postgres
               * тэнцүү утгад дурын дараалал буцаадаг. Үр дүнд шинэ кино
               * эгнээний дунд/сүүлд санамсаргүй байрлаж, хэрэглэгч
               * "шинэ юу нэмэгдсэн" гэдгийг ОГТ хардаггүй байв.
               *
               * ⚠️ `order` нь ЭХНИЙ түлхүүр хэвээр — админ гараар эрэмбэ
               * өгвөл тэр нь ДАВУУ (онцлох кино дээшээ). Зөвхөн ТЭНЦҮҮ
               * үед л шинэ нь урьтна.
               */
              orderBy: [{ order: 'asc' }, { title: { createdAt: 'desc' } }],
              /**
               * ⚠️ 24 — жанрын эгнээ ХОЁР МӨР болсон тул (`title-row.tsx`).
               * 20 бол ердөө 10 багана өгч, хэвтээ гүйлт бараг байхгүй
               * болно. 24 нь 12 багана — дэлгэц дүүрч, гүйлгэх утгатай.
               */
              take: 24,
              include: { title: { select: CARD_SELECT } },
            },
          },
        }),
        // Top 10 — хамгийн их үзэлттэй (Netflix-ийн Top 10 мөр)
        this.prisma.title.findMany({
          where: { isActive: true, comingSoon: false },
          orderBy: { views: 'desc' },
          take: 10,
          select: CARD_SELECT,
        }),
      ]);

    const decoratedBanners = await Promise.all(
      banners.map(async (b) => ({
        ...(await this.media.decorate(b)),
        trailerAvailable: !!b.trailerKey,
        trailerKey: undefined, // key задлахгүй — stream gate-ээр л
        genres: b.genres.map((g) => g.genre),
      })),
    );

    /* ⚠️ Хоосон жанрыг DB талд шүүсэн тул энд `filter` шаардлагагүй */
    const genreRows = await Promise.all(
      genres.map(async (g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        titles: await this.media.decorateMany(g.titles.map((t) => t.title)),
      })),
    );

    return {
      banners: decoratedBanners,
      newReleases: await this.media.decorateMany(newReleases),
      comingSoon: await this.media.decorateMany(comingSoon),
      popular: await this.media.decorateMany(popular),
      genreRows,
    };
  }

  private async continueWatching(userId: string) {
    const rows = await this.prisma.watchProgress.findMany({
      where: {
        userId,
        positionSec: { gt: 30 },
        // дуусаагүй (95%-иас бага үзсэн) — дууссаныг "үргэлжлүүлэх"-д харуулахгүй
      },
      orderBy: { updatedAt: 'desc' },
      take: 12,
      include: {
        title: { select: CARD_SELECT },
        episode: { select: { id: true, number: true, name: true, seasonId: true } },
      },
    });

    const filtered = rows.filter(
      (r) => r.durationSec === 0 || r.positionSec < r.durationSec * 0.95,
    );

    /**
     * ⚠️⚠️ НЭГ КИНО НЭГ Л УДАА — цувралын анги бүр тусдаа
     * `WatchProgress` мөртэй тул 10 анги үзсэн цуврал эгнээнд 10
     * УДАА давхардаж гардаг байв.
     *
     * ⚠️ `rows` нь `updatedAt: 'desc'` тул ЭХНИЙ таарсан нь ХАМГИЙН
     * СҮҮЛД үзсэн явц — түүнийг л үлдээнэ (Map нь эхний утгыг
     * хадгална, дарж бичихгүй).
     */
    const uniq = new Map<string, (typeof filtered)[number]>();
    for (const r of filtered) {
      if (!uniq.has(r.titleId)) uniq.set(r.titleId, r);
    }

    return Promise.all(
      [...uniq.values()].map(async (r) => ({
        ...(await this.media.decorate(r.title)),
        progress: {
          positionSec: r.positionSec,
          durationSec: r.durationSec,
          episode: r.episode,
        },
      })),
    );
  }

  // ─── Каталог ────────────────────────────────────────────────────────────────

  /**
   * ID жагсаалтаар кино авах (зочны "Дуртай"). Дараалал нь өгсөн ids-ийн
   * дарааллаар — хэрэглэгчийн нэмсэн дэс дараалал хадгалагдана.
   */
  async byIds(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.prisma.title.findMany({
      where: { id: { in: ids.slice(0, 100) }, isActive: true },
      select: CARD_SELECT,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof rows;
    return this.media.decorateMany(ordered);
  }

  /**
   * SITEMAP — идэвхтэй БҮХ киноны slug (хязгааргүй).
   *
   * ⚠️⚠️ БОДИТ АЛДАА: `sitemap.ts` нь `/titles?limit=1000` дуудсан ч
   * `list()` нь 60-аар таслана. 131 киноны 71 нь Google-д ХЭЗЭЭ Ч
   * индексжихгүй байв — шинэ 49 драм бүхэлдээ хайлтад олдохгүй.
   *
   * ⚠️ ЗӨВХӨН `slug` + `updatedAt` — постер presign, жанр, тайлбар
   * ОГТ татахгүй тул 1000 мөр ч хөнгөн (`CARD_SELECT`-ээс 20 дахин бага).
   *
   * ⚠️ `comingSoon` ОРНО — "удахгүй" кино ч хуудастай, урьдчилан
   * индексжих нь SEO-д ашигтай.
   */
  async allSlugs() {
    const items = await this.prisma.title.findMany({
      /**
       * ⚠️⚠️ SITEMAP-ААС 18+ КОНТЕНТЫГ ХАСНА.
       *
       * Сайт дээр 18+ кино бусадтай АДИЛХАН харагдана (баннер, хайлт,
       * каталог) — тэр шүүлт 2026-08-15-д хасагдсан. ГЭВЧ sitemap нь
       * ӨӨР зорилготой: Google-д «энэ хуудсыг индексжүүл» гэсэн ШУУД
       * дохио өгдөг.
       *
       * Хуудас өөрөө `noindex` авдаг (frontend-ийн
       * `generateMetadata`) тул sitemap-д оруулах нь зөрчилтэй
       * дохио — Search Console-д «Submitted URL marked noindex» алдаа
       * гарч, sitemap-ийн чанар унана.
       *
       * ⚠️ AdSense/Search Console бодлогоор 18+ контент индексжвэл
       *    бүх сайтын байр саатуулах эрсдэлтэй.
       */
      where: { isActive: true, genres: { none: { genre: { isAdult: true } } } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      /**
       * ⚠️⚠️ ДЭЭД ХЯЗГААР — sitemap нь `items` массивыг ШУУД уншдаг
       * (frontend/src/app/sitemap.ts) тул хуудаслалт нэмбэл эвдэрнэ.
       *
       * 50,000 нь sitemap.xml стандартын дээд хязгаар. Каталог одоо
       * 151 тул хол хүрэхгүй, гэхдээ хамгаалалтгүй байснаас дээр.
       */
      take: SITEMAP_MAX,
    });

    /* ⚠️ Хязгаарт хүрвэл ЗААВАЛ мэдэгдэнэ — дутуу sitemap нь SEO-д
       хохиролтой атлаа гаднаас нь огт харагдахгүй */
    if (items.length >= SITEMAP_MAX) {
      this.logger.warn(
        `Sitemap ${SITEMAP_MAX} хязгаарт хүрлээ — хуудаслалт нэмэх шаардлагатай`,
      );
    }
    return { items, total: items.length };
  }

  async list(params: {
    type?: TitleType;
    genre?: string;
    year?: number;
    sort?: 'new' | 'popular' | 'rating';
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(60, params.limit ?? 24);

    /**
     * ⚠️⚠️ КАТАЛОГТ 18+ ШҮҮЛТ ХИЙХГҮЙ.
     *
     * Өмнө нь жанр сонгоогүй үед 18+ шүүлт ажиллаж, "Бүгд" дархад
     * насанд хүрэгчдийн кино ОГТ ГАРАХГҮЙ байв. Гэтэл эдгээр нь
     * НҮҮР ХУУДСАНД аль хэдийн харагддаг тул каталогт нуух нь
     * зөрчилтэй бөгөөд хэрэглэгчид ойлгомжгүй ("яагаад Бүгд гэхэд
     * зарим кино алга болов?").
     *
     * `/adult` хуудас нь нас баталгаажуулалттай хэвээр — тэр нь
     * ТУСГАЙЛСАН хуудас. Ерөнхий каталог бол бүх контентын жагсаалт.
     */
    const where: Prisma.TitleWhereInput = {
      isActive: true,
      ...(params.genre ? { genres: { some: { genre: { slug: params.genre } } } } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.year ? { year: params.year } : {}),
    };

    /**
     * ⚠️⚠️ ЖАНРААР ШҮҮХЭД АДМИНЫ ЭРЭМБИЙГ ДАГАНА.
     *
     * Нүүр хуудасны жанрын эгнээ нь `TitleGenre.order`-оор эрэмбэлэгддэг
     * (админ панелийн "Эрэмбэлэх" хуудсаар тохируулна). Гэтэл "Бүгд"
     * товч дарж каталогт орвол ЗӨВХӨН `createdAt desc` байсан тул
     * ХОЁР ХУУДАС ӨӨР дараалал үзүүлж, админы тохируулсан эрэмбэ
     * алга болдог байв ("яагаад миний онцлох кино эхэнд байхгүй вэ?").
     *
     * ⚠️ Prisma нь олон-олон холбоосын талбараар (`genres.order`)
     * эрэмбэлж ЧАДДАГГҮЙ тул холбоосын хүснэгт талаас query хийнэ.
     *
     * ⚠️ Зөвхөн АНХНЫ (`new`) эрэмбэд — хэрэглэгч "Алдартай"/"Үнэлгээ"
     * гэж ЗОРИУД сонгосон бол түүнийг нь хүндэтгэнэ.
     */
    const useGenreOrder = !!params.genre && (!params.sort || params.sort === 'new');
    if (useGenreOrder) return this.listByGenreOrder(where, params.genre!, page, limit);

    const orderBy: Prisma.TitleOrderByWithRelationInput =
      params.sort === 'popular'
        ? { views: 'desc' }
        : params.sort === 'rating'
          ? { rating: 'desc' }
          : { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.title.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: CARD_SELECT,
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

  /**
   * Жанрын каталог — АДМИНЫ тохируулсан дарааллаар (нүүр хуудастай ижил).
   *
   * ⚠️⚠️ ЯАГААД ХОЛБООСЫН ХҮСНЭГТ ТАЛААС ВЭ:
   * Prisma-д `title.findMany({ orderBy: { genres: { order } } })` гэж
   * бичих БОЛОМЖГҮЙ (олон-олон холбоосын талбараар эрэмбэлэхийг
   * дэмждэггүй). Тиймээс `titleGenre`-ээс эхэлж, дотор нь `title`-ыг
   * татна — эрэмбэ нь холбоосын мөр дээр байгаа тул шууд ажиллана.
   *
   * ⚠️ `order` тэнцүү (админ гараар эрэмбэлээгүй, бүгд 0) үед
   * `createdAt desc` — нүүр хуудасны `genreRows` query-тэй ЯГ ИЖИЛ
   * хоёрдогч түлхүүр. Эс бөгөөс Postgres дурын дараалал буцаана.
   */
  private async listByGenreOrder(
    where: Prisma.TitleWhereInput,
    genreSlug: string,
    page: number,
    limit: number,
  ) {
    /* ⚠️ `where`-ээс жанрын нөхцөлийг ХАСНА — энд `genreId`-гээр
       шүүж байгаа тул давхардвал дэмий JOIN нэмэгдэнэ */
    const { genres: _drop, ...titleWhere } = where;

    const linkWhere: Prisma.TitleGenreWhereInput = {
      genre: { slug: genreSlug },
      title: titleWhere,
    };

    const [rows, total] = await Promise.all([
      this.prisma.titleGenre.findMany({
        where: linkWhere,
        orderBy: [{ order: 'asc' }, { title: { createdAt: 'desc' } }],
        skip: (page - 1) * limit,
        take: limit,
        select: { title: { select: CARD_SELECT } },
      }),
      this.prisma.titleGenre.count({ where: linkWhere }),
    ]);

    return {
      items: await this.media.decorateMany(rows.map((r) => r.title)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Хайлт (галиг Латин↔Кирилл) ────────────────────────────────────────────

  /**
   * Хайлт — нэр, жанр, найруулагч, жүжигчин, тайлбараар.
   *
   * ⚠️ Өмнө нь ЗӨВХӨН нэрээр хайдаг байсан тул "монгол кино", "солонгос"
   * гэх мэт ЖАНРЫН хайлт үргэлж 0 буцаадаг байв (чатбот ч кино олдоггүй).
   */
  /**
   * @param type ЗӨВХӨН MOVIE эсвэл SERIES. Чатботод шаардлагатай —
   *   «цуврал байна уу» гэвэл олон ангит, «кино» гэвэл бүрэн хэмжээний.
   *
   * ⚠️⚠️ `q` ХООСОН байж БОЛНО (зөвхөн `type`). Хэрэглэгч «цуврал»,
   * «шинэ кино» гэх зэрэг ТӨРЛӨӨР асуухад хайх үг байхгүй — өмнө нь
   * `parsed.usable=false` болж хоосон буцаадаг тул чатбот «олдсонгүй»
   * гэж ХУДЛАА хариулж байв.
   */
  async search(q: string, limit = 20, type?: 'MOVIE' | 'SERIES') {
    // 1) Stop word хасаж гол үгсийг ялгана ("сайхан кино байна уу" → ∅)
    const parsed = parseQuery(q);

    /**
     * Хайх үг байхгүй ч ТӨРӨЛ заасан бол — тухайн төрлийн ШИНЭ
     * кинонуудыг буцаана («цуврал байна уу» → сүүлийн цувралууд).
     */
    if (!parsed.usable) {
      if (!type) return [];
      const rows = await this.prisma.title.findMany({
        where: { isActive: true, comingSoon: false, type },
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
        select: { ...CARD_SELECT, description: true },
      });
      return this.media.decorateMany(rows);
    }

    // 2) Үг бүрийг галиг + үндэс хувилбар болгож дэлгэнэ
    //    "монголын" → ["монголын", "монгол", "mongolyn"...]
    const expandWord = (w: string): string[] => {
      const out = new Set<string>();
      for (const t of expandQuery(w)) {
        out.add(t);
        const stem = mnStem(t);
        if (stem.length >= 3 && stem !== t) out.add(stem);
      }
      return [...out];
    };

    const keyVariants = parsed.keywords.map(expandWord);
    const commonVariants = parsed.common.map(expandWord);
    const allVariants = [...keyVariants, ...commonVariants].flat();
    if (!allVariants.length) return [];

    /**
     * ⚠️⚠️ БОГИНО ҮГ (≤3 үсэг) — ЗӨВХӨН гарчиг/slug-д.
     *
     * БОДИТ АЛДАА: «Үл таних» → «үл» → галиг «ul» → тайлбар доторх
     * «булан/сургууль/хулгай» гэх үгийн ДУНД таарч, огт хамааралгүй
     * кино эхэнд гардаг байв. Богино үгийг тайлбар, жүжигчин,
     * найруулагч, улс, жанрт хайх нь ЧИМЭЭ л нэмнэ.
     */
    const matchClauses = (t: string): Prisma.TitleWhereInput[] => {
      if (isShortWord(t)) {
        return [
          { title: { contains: t, mode: 'insensitive' as const } },
          { titleEn: { contains: t, mode: 'insensitive' as const } },
          { slug: { contains: t, mode: 'insensitive' as const } },
        ];
      }
      return [
      { title: { contains: t, mode: 'insensitive' as const } },
      { titleEn: { contains: t, mode: 'insensitive' as const } },
      { slug: { contains: t, mode: 'insensitive' as const } },
      { actors: { has: t } },
      { director: { contains: t, mode: 'insensitive' as const } },
      /* ⚠️ Улс — «солонгос цуврал», «хятад кино» гэх хайлтын гол түлхүүр */
      { country: { contains: t, mode: 'insensitive' as const } },
      { description: { contains: t, mode: 'insensitive' as const } },
      {
        genres: {
          some: {
            genre: {
              OR: [
                { name: { contains: t, mode: 'insensitive' as const } },
                { nameEn: { contains: t, mode: 'insensitive' as const } },
                { slug: { contains: t, mode: 'insensitive' as const } },
              ],
            },
          },
        },
      },
      ];
    };

    // 3) Нэр дэвшигчдийг татна (эрэмбийг доор кодоор тооцно)
    const rows = await this.prisma.title.findMany({
      where: {
        isActive: true,
        ...(type ? { type } : {}),
        OR: allVariants.flatMap(matchClauses),
      },
      /**
       * ⚠️⚠️ НЭР ДЭВШИГЧИЙН ТОО — оноололоос ӨМНӨХ шүүлт тул ЭНЭ ТОО
       * ШУУД ЗӨВ ХАРИУГ ХАЯЖ БОЛНО.
       *
       * БОДИТ АЛДАА: `Math.min(80, limit * 4)` нь limit=6 үед ердөө 24
       * мөр татдаг байв. «намайг аварсан хайр» гэх 3 үгтэй хайлт нь
       * OR-оор олон зуун мөр таарах бөгөөд Prisma нь ОНООГҮЙГЭЭР эхний
       * 24-ийг сугалдаг тул ЯГ ЗӨВ кино («Намайг аварсан хайр») огт
       * ирэхгүй, харин «Захирлыг аварсан ногоочин охин» гэх санамсаргүй
       * хоёр кино гардаг байлаа. Ганц үгээр («намайг») хайхад л зөв
       * гардаг байсан нь үүнийг илчилсэн.
       *
       * Оноолол нь санах ойд ажилладаг тул 400 мөр татах нь хямд.
       */
      take: 400,
      select: { ...CARD_SELECT, titleEn: true, director: true, description: true, actors: true, country: true },
    });

    // 4) ⚠️ ОНОО — DigitalGer-т байхгүй байсан гол дутагдал (тэнд зүгээр
    //    createdAt/views эрэмбэлдэг тул гарчигт яг таарсан кино доор гардаг).
    //    Гарчиг=10, жанр=6, бусад талбар=3, түгээмэл үг=1.
    const scoreOf = (t: (typeof rows)[number]) => {
      const title = `${t.title} ${t.titleEn ?? ''} ${t.slug}`.toLowerCase();
      const body = `${t.description ?? ''} ${t.director ?? ''} ${(t.actors ?? []).join(' ')}`.toLowerCase();
      /**
       * ⚠️ УЛС нь ЖАНРТАЙ ижил жинтэй — «солонгос» гэдэг нь хэрэглэгчийн
       * хувьд ангилал шиг утгатай (тайлбарын дунд санамсаргүй таарсан
       * үгнээс хамаагүй чухал).
       */
      const genreText = ((t.genres ?? [])
        .map((g: { genre: { name: string; slug: string } }) => `${g.genre.name} ${g.genre.slug}`)
        .join(' ') + ' ' + (t.country ?? ''))
        .toLowerCase();

      let score = 0;
      let hits = 0;
      /** ⚠️ Гарчигт БҮТЭН үгээр таарсан тоо — эрэмбийн гол хүчин зүйл */
      let titleWordHits = 0;

      for (const variants of keyVariants) {
        /**
         * ⚠️⚠️ ГУРВАН ТҮВШНИЙ ТААРАЛТ (хүчтэйгээс сул руу):
         *   1. БҮТЭН ҮГ    — «таних» ⊂ «Үл таних охин»       → 14
         *   2. ҮГИЙН ЭХЛЭЛ — «таних» ⊂ «Танихгүй таашаал»    → 10
         *   3. ДЭД МӨР     — «таних» ⊂ «үлтанихад» (ховор)   → 5
         *
         * Өмнө нь бүгд ижил 10 оноотой байсан тул «Танихгүй таашаал»
         * (үзэлт 33) нь «Үл таних охин» (үзэлт 12)-оос ДЭЭР гардаг
         * байв — хэрэглэгчийн хайсан яг тэр кино 2-рт.
         */
        const wholeInTitle = variants.some((v) => matchesWholeWord(title, v));
        const startInTitle = !wholeInTitle && variants.some((v) => matchesWordStart(title, v));
        const subInTitle = !wholeInTitle && !startInTitle && variants.some((v) => title.includes(v));
        const inTitle = wholeInTitle || startInTitle || subInTitle;

        /* ⚠️ Жанр/улсад ҮГИЙН ЭХЛЭЛ шаардана — «драм» нь «мелодрам»-д
           таарах нь зөв, харин үгийн дунд санамсаргүй таарах нь БУРУУ */
        const inGenre = variants.some((v) => matchesWordStart(genreText, v));

        /**
         * ⚠️⚠️ ТАЙЛБАРТ ЗӨВХӨН БҮТЭН ҮГ.
         * Дэд мөрийн таарал (`includes`) нь «Үл таних → Замд дайгдсан
         * охин» алдааны ШУУД шалтгаан байсан.
         */
        const inBody = variants.some((v) => matchesWholeWord(body, v));

        if (wholeInTitle) {
          score += 14;
          titleWordHits += 1;
        } else if (startInTitle) score += 10;
        else if (subInTitle) score += 5;
        else if (inGenre) score += 6;
        else if (inBody) score += 3;

        if (inTitle || inGenre || inBody) hits += 1;
      }
      for (const variants of commonVariants) {
        if (
          variants.some(
            (v) =>
              matchesWordStart(title, v) ||
              matchesWholeWord(body, v) ||
              matchesWordStart(genreText, v),
          )
        ) {
          score += 1;
        }
      }

      /**
       * ⚠️ БҮХ гол үг гарчигт БҮТНЭЭР таарсан бол ХАМГИЙН дээр.
       * «Үл таних» → «Үл таних охин» нь 2/2 тул энэ урамшууллыг авна,
       * «Замд дайгдсан охин» нь 0/2 тул авахгүй.
       */
      if (keyVariants.length && titleWordHits === keyVariants.length) score += 30;

      // Гарчиг ЯГ таарсан бол бүр дээр
      const exact = parsed.raw.join(' ');
      if (t.title.toLowerCase() === exact) score += 50;
      else if (t.title.toLowerCase().startsWith(exact)) score += 20;

      return { score, hits, titleWordHits };
    };

    const scored = rows.map((t) => ({ t, ...scoreOf(t) }));

    // 5) ⚠️ maxHits шүүлт — олон гол үг таарсан байхад ганц үг таарсныг
    //    ХАЯНА (чимээ багасгах). Жишээ: "солонгос драм" → хоёуланг агуулсан
    //    байвал зөвхөн "драм"-тайг харуулахгүй.
    /**
     * ⚠️⚠️ `maxHits` ШҮҮЛТИЙГ ЗӨӨЛРҮҮЛЭВ.
     *
     * БОДИТ АЛДАА: хатуу `hits >= maxHits` нь ЗӨВ киног ХАЯДАГ байв.
     * «Үл таних» гэж хайхад «Замд дайгдсан охин» нь тайлбар дотроос
     * хоёр үгийг ЧУУ таарч 2 hits авдаг, харин хэрэглэгчийн хайсан
     * «Үл таних охин» ч мөн 2 hits — гэтэл эрэмбэ буруу тул эхнийх
     * дээр гарч, `slice` дээр нөгөө нь тасардаг байв.
     *
     * Одоо: гарчигт БҮТЭН үгээр таарсан кино БАЙВАЛ зөвхөн тэдгээрийг
     * харуулна (хамгийн итгэлтэй дохио). Байхгүй үед л сул таарал руу
     * ухарна.
     */
    const bestTitleHits = scored.reduce((m, s) => Math.max(m, s.titleWordHits), 0);
    const pool =
      bestTitleHits > 0
        ? scored.filter((s) => s.titleWordHits === bestTitleHits)
        : scored.filter((s) => s.hits >= scored.reduce((m, x) => Math.max(m, x.hits), 0));

    const relevant = pool
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || b.t.views - a.t.views)
      .slice(0, limit)
      .map((s) => s.t);

    /**
     * ⚠️⚠️ FUZZY FALLBACK — ЗӨВХӨН юу ч олдоогүй үед.
     *
     * ЯАГААД: `contains` нь ЯГ таарсан дэд мөрийг л олдог тул хүний
     * энгийн алдааг таньдаггүй:
     *   • «үлтаних»  — зай орхисон
     *   • «танихох»  — үсэг дутуу
     *   • «дангин»   — нөхцөл дутуу
     * Хэрэглэгч «олдсонгүй» гээд явчихна, гэтэл кино байсаар.
     *
     * ⚠️ ЗӨВХӨН fallback — яг таарал байвал fuzzy ажиллуулахгүй.
     * Эс бөгөөс ойролцоо кино зөв үр дүнг бохирдуулна.
     */
    if (relevant.length) return this.media.decorateMany(relevant);
    return this.fuzzySearch(parsed.raw.join(' '), limit, type);
  }

  /**
   * TRIGRAM ойролцоо хайлт (pg_trgm) — алдаатай бичилтэд.
   *
   * ⚠️ `similarity()` нь 0..1 — 0.3 нь практикт «ойролцоо» гэж
   * тооцогдох босго (PostgreSQL-ийн анхдагч). Түүнээс доош болговол
   * огт хамааралгүй кино гарч эхэлнэ.
   *
   * ⚠️ Кирилл + Латин ХОЁУЛАНГ шалгана — хэрэглэгч аль ч хэлбэрээр
   * алдаатай бичиж болно.
   */
  private async fuzzySearch(raw: string, limit: number, type?: 'MOVIE' | 'SERIES') {
    const q = raw.trim();
    /* ⚠️ 3 үсгээс богино мөрөнд trigram утгагүй — бүх зүйл таарна */
    if (q.length < 3) return [];

    /* Галиг хувилбарууд — «ul tanih» ↔ «үл таних» */
    const variants = [...new Set([q, ...expandQuery(q)])].filter((v) => v.length >= 3);

    try {
      const rows = await this.prisma.$queryRaw<{ id: string; sim: number }[]>`
        SELECT t.id,
               GREATEST(
                 similarity(lower(t.title), lower(${q})),
                 similarity(lower(COALESCE(t."titleEn", '')), lower(${q})),
                 similarity(replace(lower(t.slug), '-', ' '), lower(${q}))
               ) AS sim
        FROM "Title" t
        WHERE t."isActive" = true
          AND (${type}::text IS NULL OR t.type::text = ${type}::text)
          AND (
            lower(t.title) % lower(${q})
            OR lower(COALESCE(t."titleEn", '')) % lower(${q})
            OR replace(lower(t.slug), '-', ' ') % lower(${q})
          )
        ORDER BY sim DESC
        LIMIT ${Math.min(20, limit)}
      `;

      /**
       * ⚠️ Галиг хувилбараар ч оролдоно — «ul tanih ohin» гэж алдаатай
       * бичихэд кирилл гарчигтай харьцуулбал similarity бага гарна.
       */
      const ids = new Set(rows.map((r) => r.id));
      if (!ids.size && variants.length > 1) {
        for (const v of variants.slice(1, 4)) {
          const alt = await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT t.id FROM "Title" t
            WHERE t."isActive" = true
              AND (${type}::text IS NULL OR t.type::text = ${type}::text)
              AND (
                replace(lower(t.slug), '-', ' ') % lower(${v})
                OR lower(COALESCE(t."titleEn", '')) % lower(${v})
              )
            LIMIT ${Math.min(10, limit)}
          `;
          for (const r of alt) ids.add(r.id);
          if (ids.size) break;
        }
      }
      if (!ids.size) return [];

      const found = await this.prisma.title.findMany({
        where: { id: { in: [...ids] } },
        select: { ...CARD_SELECT, description: true },
      });
      /* ⚠️ similarity-ийн эрэмбийг хадгална — Prisma нь `in`-ий
         дарааллыг баталгаажуулдаггүй */
      const order = new Map(rows.map((r, i) => [r.id, i]));
      found.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));

      this.logger.log(`Fuzzy хайлт «${q}» → ${found.length} үр дүн`);
      return this.media.decorateMany(found);
    } catch (e) {
      /* ⚠️ pg_trgm суугаагүй бол ХООСОН буцаана — хайлт УНАХГҮЙ */
      this.logger.warn(`Fuzzy хайлт боломжгүй: ${String(e).slice(0, 120)}`);
      return [];
    }
  }

  // ─── 18+ хуудас (нас баталгаажуулсны дараа) ────────────────────────────────

  /** Зөвхөн насанд хүрэгчдийн жанрын контент — /adult хуудсанд */
  async adult(params: { type?: TitleType; page?: number; limit?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(60, params.limit ?? 24);

    const where: Prisma.TitleWhereInput = {
      isActive: true,
      genres: { some: { genre: { isAdult: true } } },
      ...(params.type ? { type: params.type } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.title.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: CARD_SELECT,
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

  // ─── Дэлгэрэнгүй ────────────────────────────────────────────────────────────

  async detail(slug: string, userId?: string | null) {
    const title = await this.prisma.title.findUnique({
      where: { slug },
      include: {
        genres: {
          orderBy: { order: 'asc' },
          /* ⚠️ `isAdult` — frontend нь 18+ киноны хуудсанд `noindex`
             тавихад ашиглана (Google-д индексжих нь эрсдэлтэй) */
          include: { genre: { select: { id: true, name: true, slug: true, isAdult: true } } },
        },
        /**
         * ⚠️⚠️ НУУСАН УЛИРАЛ/АНГИ ХЭРЭГЛЭГЧИД ОГТ ХАРАГДАХГҮЙ.
         *
         * Админ «3-р бүлгийг харуулахгүй» гэж тохируулбал энэ шүүлт
         * түүнийг DB-ээс ч татахгүй. Frontend талд шүүх нь БУРУУ —
         * API хариунд ирсэн дата DevTools-оор харагдана.
         *
         * ⚠️ Улирал нуувал доторх БҮХ анги нуугдана (эцгээ дагана).
         */
        seasons: {
          where: { isVisible: true },
          orderBy: { number: 'asc' },
          include: {
            episodes: {
              where: { isVisible: true },
              orderBy: { number: 'asc' },
              select: {
                id: true,
                number: true,
                name: true,
                description: true,
                posterKey: true,
                durationSec: true,
                streamStatus: true,
                isFreePreview: true,
              },
            },
          },
        },
      },
    });

    if (!title || !title.isActive) {
      throw new NotFoundException('Контент олдсонгүй');
    }

    /**
     * ⚠️⚠️ ҮЗЭЛТИЙН ТОО — 30 МИНУТЫН ДАВХАРДАЛ ШҮҮЛТТЭЙ.
     *
     * Өмнө нь дуудалт БҮРД +1 болдог байсан тул:
     *   • хэрэглэгч refresh дарах бүрд +1
     *   • Google/Facebook crawler, SEO сканнер бүрд +1
     *   • скриптээр давтан дуудвал хязгааргүй
     * `views` нь "Их үзсэн" мөр болон `related`-ийн ЭРЭМБЭД
     * хэрэглэгддэг тул хуурамч тоо нүүр хуудсыг гуйвуулна.
     *
     * ⚠️ Redis байхгүй/унасан бол ХУУЧНААР ажиллана (тоолохоо болихоос
     * тоолсон нь дээр) — `incr` нь `null` буцаана.
     */
    void (async () => {
      const who = userId ?? 'anon';
      const seen = await this.cache.incr(`view:${title.id}:${who}`, 1800);
      /* `seen === 1` → энэ 30 минутын цонхонд АНХ удаа */
      if (seen === null || seen === 1) {
        await this.prisma.title
          .update({ where: { id: title.id }, data: { views: { increment: 1 } } })
          .catch(() => null);
      }
    })();

    const titleGenreIds = title.genres.map((g) => g.genreId);

    const [
      decorated,
      related,
      progress,
      inMyList,
      reviewStats,
      galleryUrls,
      hasAccess,
      requiredPlans,
      rental,
    ] =
      await Promise.all([
        this.media.decorate(title),
        this.related(title.id),
        userId
          ? this.prisma.watchProgress.findUnique({
              where: { userId_titleId: { userId, titleId: title.id } },
              select: { positionSec: true, durationSec: true, episodeId: true },
            })
          : Promise.resolve(null),
        userId
          ? this.prisma.myListItem
              .findUnique({
                where: { userId_titleId: { userId, titleId: title.id } },
              })
              .then(Boolean)
          : Promise.resolve(false),
        this.reviewStats(title.id),
        this.media.urlMany(title.galleryKeys),
        // Энэ контентыг үзэх эрхтэй эсэх (багц ↔ жанраар)
        title.isPremium
          ? this.subs.canAccessTitle(userId, titleGenreIds, title.id)
          : Promise.resolve(true),
        // Эрхгүй бол ЯМАР багц авбал нээгдэхийг харуулна
        this.requiredPlans(titleGenreIds),
        // Ширхэгээр түрээслэх боломж/үнэ + идэвхтэй түрээс
        this.rentalInfo(title, userId),
      ]);

    // Cast — photoKey-үүдийг batch presign (N+1 биш, зэрэг гүйцэтгэнэ)
    const castRaw = Array.isArray(title.cast)
      ? (title.cast as unknown as CastMember[])
      : [];
    const castPhotoUrls = await this.media.urlMany(castRaw.map((c) => c.photoKey));
    const cast = castRaw.map((c, i) => ({
      name: c.name,
      character: c.character,
      photoUrl: castPhotoUrls[i],
    }));

    // Episode poster-ийг batch presign (season бүрийн episode-уудыг НЭГ дор)
    const allEpisodes = title.seasons.flatMap((s) => s.episodes);
    const episodePosterUrls = await this.media.urlMany(
      allEpisodes.map((e) => e.posterKey),
    );
    let epIdx = 0;
    const seasons = title.seasons.map((s) => ({
      ...s,
      episodes: s.episodes.map((e) => ({
        ...e,
        posterUrl: episodePosterUrls[epIdx++],
        posterKey: undefined,
        playable: e.streamStatus === 'READY',
      })),
    }));

    return {
      ...decorated,
      // ⚠️ Нууц талбарууд — video key-үүд клиент рүү ЯВАХГҮЙ (stream gate-ээр л)
      videoKey: undefined,
      videoRawKey: undefined,
      trailerKey: undefined,
      cast: undefined, // raw cast (photoKey) — cast (photoUrl) доор орлуулна
      castMembers: cast,
      galleryUrls,
      galleryKeys: undefined,
      /**
       * ⚠️ Трейлер БАЙГАА эсэх — манай HLS ЭСВЭЛ YouTube.
       * Хоёулаа байвал HLS давуу (өөрийн CDN, зар сурталчилгаагүй).
       */
      trailerAvailable: !!title.trailerKey || !!title.trailerYoutubeKey,
      /**
       * ⚠️ ЗӨВХӨН манай HLS БАЙХГҮЙ үед YouTube-ийг явуулна — клиент тал
       * аль тоглуулагчийг сонгохоо ҮҮГЭЭР шийднэ. HLS байвал `null` тул
       * гадаад embed дэмий ачаалахгүй.
       */
      trailerYoutubeKey: title.trailerKey ? null : title.trailerYoutubeKey,
      playable: title.type === 'MOVIE' ? title.streamStatus === 'READY' : undefined,
      genres: title.genres.map((g) => g.genre),
      seasons,
      related,
      progress,
      inMyList,
      reviewStats,
      /** Хэрэглэгч энэ контентыг үзэх эрхтэй эсэх (үнэгүй бол үргэлж true) */
      hasAccess,
      /** Эрхгүй үед аль багц авбал нээгдэхийг харуулна */
      requiredPlans,
      /**
       * Ширхэгээр түрээслэх мэдээлэл:
       * { available, price, hours, active: {expiresAt} | null }
       */
      rental,
    };
  }

  /**
   * Тухайн киноны ширхэгийн түрээс.
   *
   * ⚠️ Үнэ = кинонд заасан `rentPrice` → байхгүй бол сайтын нийтлэг (Settings
   * key='rent', default 4,900₮/48ц). Үнэгүй кинонд түрээс хэрэггүй.
   */
  private async rentalInfo(
    title: { id: string; isPremium: boolean; rentPrice: number | null; rentHours: number | null; rentEnabled: boolean },
    userId?: string | null,
  ) {
    const [row, active] = await Promise.all([
      this.prisma.settings.findUnique({ where: { key: 'rent' } }).catch(() => null),
      userId ? this.subs.activeRental(userId, title.id) : Promise.resolve(null),
    ]);
    const cfg = (row?.value ?? {}) as { price?: number; hours?: number; enabled?: boolean };

    return {
      available: (cfg.enabled ?? true) && title.rentEnabled && title.isPremium,
      price: title.rentPrice ?? cfg.price ?? 4900,
      hours: title.rentHours ?? cfg.hours ?? 48,
      active: active ? { expiresAt: active.expiresAt } : null,
    };
  }

  /** Тухайн жанруудыг нээдэг идэвхтэй багцууд (VIP үргэлж багтана) */
  private async requiredPlans(titleGenreIds: string[]) {
    if (!titleGenreIds.length) return [];
    return this.prisma.plan.findMany({
      where: {
        isActive: true,
        OR: [{ isVip: true }, { genres: { some: { genreId: { in: titleGenreIds } } } }],
      },
      orderBy: { price: 'asc' },
      select: { id: true, name: true, price: true, isVip: true },
    });
  }

  private async reviewStats(titleId: string) {
    const [avg, count] = await Promise.all([
      this.prisma.review.aggregate({ where: { titleId }, _avg: { rating: true } }),
      this.prisma.review.count({ where: { titleId } }),
    ]);
    return { average: avg._avg.rating ?? null, count };
  }

  private async related(titleId: string, limit = 12) {
    // Ижил жанрын бусад контент
    const genreIds = (
      await this.prisma.titleGenre.findMany({
        where: { titleId },
        select: { genreId: true },
      })
    ).map((g) => g.genreId);

    const items = await this.prisma.title.findMany({
      where: {
        isActive: true,
        id: { not: titleId },
        ...(genreIds.length
          ? { genres: { some: { genreId: { in: genreIds } } } }
          : {}),
      },
      orderBy: { views: 'desc' },
      take: limit,
      select: CARD_SELECT,
    });

    return this.media.decorateMany(items);
  }
}

interface CastMember {
  name: string;
  character?: string;
  photoKey?: string | null;
}
