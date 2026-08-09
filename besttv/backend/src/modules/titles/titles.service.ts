import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TitleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { expandQuery } from '../../common/transliterate';
import { mnStem, parseQuery } from '../../common/search-text';
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
  // ⚠️ Жанр — карт дээр аль ангилалд багтахыг харуулна (админ хүсэлт).
  // Хэрэглэгч ямар багц авбал үзэхээ шууд ойлгоно.
  genres: {
    orderBy: { order: 'asc' as const },
    take: 2,
    select: { genre: { select: { id: true, name: true, slug: true, isAdult: true } } },
  },
} satisfies Prisma.TitleSelect;

/**
 * ⚠️ 18+ хамгаалалт — насанд хүрэгчдийн жанртай контент ЕРӨНХИЙ каталог
 * (нүүр/кино/цуврал/хайлт/ижил төстэй)-д ОГТ харагдахгүй. Зөвхөн /adult
 * хуудсанд (нас баталгаажуулсны дараа) гарна.
 */
const NOT_ADULT: Prisma.TitleWhereInput = {
  genres: { none: { genre: { isAdult: true } } },
};

@Injectable()
export class TitlesService {
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
          where: { isBanner: true, isActive: true, ...NOT_ADULT },
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
          where: { isActive: true, hideFromNew: false, comingSoon: false, ...NOT_ADULT },
          orderBy: [{ newReleasesOrder: 'asc' }, { createdAt: 'desc' }],
          take: 20,
          select: CARD_SELECT,
        }),
        this.prisma.title.findMany({
          where: { isActive: true, comingSoon: true, ...NOT_ADULT },
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
          where: { isActive: true, comingSoon: false, ...NOT_ADULT },
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

    return Promise.all(
      filtered.map(async (r) => ({
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
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
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
     * Өмнө нь жанр сонгоогүй үед `NOT_ADULT` ажиллаж, "Бүгд" дархад
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
  async search(q: string, limit = 20) {
    // 1) Stop word хасаж гол үгсийг ялгана ("сайхан кино байна уу" → ∅)
    const parsed = parseQuery(q);
    if (!parsed.usable) return [];

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

    const matchClauses = (t: string): Prisma.TitleWhereInput[] => [
      { title: { contains: t, mode: 'insensitive' as const } },
      { titleEn: { contains: t, mode: 'insensitive' as const } },
      { slug: { contains: t, mode: 'insensitive' as const } },
      { actors: { has: t } },
      { director: { contains: t, mode: 'insensitive' as const } },
      { description: { contains: t, mode: 'insensitive' as const } },
      {
        genres: {
          some: {
            genre: {
              isAdult: false,
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

    // 3) Нэр дэвшигчдийг татна (эрэмбийг доор кодоор тооцно)
    const rows = await this.prisma.title.findMany({
      where: {
        isActive: true,
        ...NOT_ADULT, // ⚠️ 18+ хайлтын үр дүнд гарахгүй
        OR: allVariants.flatMap(matchClauses),
      },
      take: Math.min(80, limit * 4), // оноолохын тулд илүү татна
      select: { ...CARD_SELECT, titleEn: true, director: true, description: true, actors: true },
    });

    // 4) ⚠️ ОНОО — DigitalGer-т байхгүй байсан гол дутагдал (тэнд зүгээр
    //    createdAt/views эрэмбэлдэг тул гарчигт яг таарсан кино доор гардаг).
    //    Гарчиг=10, жанр=6, бусад талбар=3, түгээмэл үг=1.
    const scoreOf = (t: (typeof rows)[number]) => {
      const title = `${t.title} ${t.titleEn ?? ''} ${t.slug}`.toLowerCase();
      const body = `${t.description ?? ''} ${t.director ?? ''} ${(t.actors ?? []).join(' ')}`.toLowerCase();
      const genreText = (t.genres ?? [])
        .map((g: { genre: { name: string; slug: string } }) => `${g.genre.name} ${g.genre.slug}`)
        .join(' ')
        .toLowerCase();

      let score = 0;
      let hits = 0;

      for (const variants of keyVariants) {
        const inTitle = variants.some((v) => title.includes(v));
        const inGenre = variants.some((v) => genreText.includes(v));
        const inBody = variants.some((v) => body.includes(v));
        if (inTitle) score += 10;
        else if (inGenre) score += 6;
        else if (inBody) score += 3;
        if (inTitle || inGenre || inBody) hits += 1;
      }
      for (const variants of commonVariants) {
        if (variants.some((v) => title.includes(v) || body.includes(v) || genreText.includes(v))) {
          score += 1;
        }
      }

      // Гарчиг ЯГ таарсан бол хамгийн дээр
      const exact = parsed.raw.join(' ');
      if (t.title.toLowerCase() === exact) score += 50;
      else if (t.title.toLowerCase().startsWith(exact)) score += 20;

      return { score, hits };
    };

    const scored = rows.map((t) => ({ t, ...scoreOf(t) }));

    // 5) ⚠️ maxHits шүүлт — олон гол үг таарсан байхад ганц үг таарсныг
    //    ХАЯНА (чимээ багасгах). Жишээ: "солонгос драм" → хоёуланг агуулсан
    //    байвал зөвхөн "драм"-тайг харуулахгүй.
    const maxHits = scored.reduce((m, s) => Math.max(m, s.hits), 0);
    const relevant = scored
      .filter((s) => s.hits >= maxHits && s.score > 0)
      .sort((a, b) => b.score - a.score || b.t.views - a.t.views)
      .slice(0, limit)
      .map((s) => s.t);

    return this.media.decorateMany(relevant);
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
          include: { genre: { select: { id: true, name: true, slug: true } } },
        },
        seasons: {
          orderBy: { number: 'asc' },
          include: {
            episodes: {
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
        ...NOT_ADULT, // 18+ "ижил төстэй"-д гарахгүй
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
