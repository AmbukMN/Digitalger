import {
  Controller,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Prisma, TitleType } from '@prisma/client';
import { assertTitleOnSite } from '../../common/site/site-guard';
import { currentSite } from '../../common/site/site-context';
import { PrismaService } from '../../prisma/prisma.service';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { TitlesService } from '../titles/titles.service';
import { TitlesModule } from '../titles/titles.module';
import { TitleMediaHelper } from '../titles/title-media.helper';
import { CacheService } from '../../common/cache/cache.service';
import { siteConfig } from '../../common/site/site-config';

/**
 * ⚠️⚠️⚠️ ГАР УТАСНЫ АППЫН ТУСДАА ЗАМ — `/api/mobile/*`
 *
 * ЯАГААД ТУСДАА ВЭ:
 *
 * 1. **App Store / Google Play-ийн бодлого.** Apple-ийн Guideline 1.1.4
 *    нь эротик контентыг ШУУД хориглодог. Тиймээс апп-д 18+ жанрын кино
 *    ОГТ БУЦААХГҮЙ. Гэвч ВЭБ дээр тэдгээр нь ил хэвээр байх ЁСТОЙ —
 *    орлогын 90%+ түүнээс ирдэг.
 *
 * 2. **Вэбийн endpoint-ийг ХӨНДӨХГҮЙ.** `/titles/home`, `/titles`,
 *    `/titles/:slug` нь одоогийн байдлаараа ажиллана. Тэдгээрт `?client=app`
 *    гэх мэт нөхцөл нэмбэл вэбийн зан төлөв санамсаргүй өөрчлөгдөх
 *    эрсдэлтэй (1000+ хэрэглэгчтэй production).
 *
 * ⚠️ ШҮҮЛТ НЬ BACKEND ТАЛД — апп талд шүүвэл 18+ киноны ID, нэр,
 *    постер сүлжээгээр дамжина. App Store-ийн шалгагч сүлжээний
 *    урсгалыг шалгадаг тул илэрч болзошгүй.
 *
 * ⚠️ Энэ модул нь `TitlesService`-ийг ДУУДНА, код давхардуулахгүй.
 *    Ялгаа нь зөвхөн ШҮҮЛТ.
 */

/** ⚠️ Киноны АЛЬ Ч жанр 18+ биш байх — `some: { isAdult: false }` бол
    18+ БА энгийн хоёр жанртай кино нэвтэрч орно */
const NOT_ADULT: Prisma.TitleWhereInput = {
  genres: { none: { genre: { isAdult: true } } },
};

/** Аппын картад хэрэгтэй талбарууд (вэбийн CARD_SELECT-тэй ижил) */
const CARD = {
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
  language: true,
  streamStatus: true,
} satisfies Prisma.TitleSelect;

@Injectable()
export class MobileService {
  private readonly logger = new Logger(MobileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly titles: TitlesService,
    private readonly media: TitleMediaHelper,
    private readonly cache: CacheService,
  ) {}

  /**
   * Аппын нүүр хуудас — 18+ ХАССАН.
   *
   * ⚠️ Вэбийн `home()`-ийг дуудаж шүүх нь БУРУУ: тэр нь эгнээ бүрд
   * `take: 12` авдаг тул 18+ хасахад эгнээ ХООСРОХ эсвэл цөөрнө
   * (жишээ: «Их үзсэн» 12-оос 5 болно). Тиймээс query-г тусад нь.
   *
   * ⚠️ Кэшийн түлхүүр нь `mobile:` угтвартай — вэбийн `home:v1`-ийг
   * ДАРЖ БИЧВЭЛ вэб дээр 18+ алга болно (ноцтой алдаа).
   */
  async home(userId?: string | null) {
    const shared = await this.cache.wrap('mobile:home:v1', 90, () => this.homeShared());
    const continueWatching = userId ? await this.continueWatching(userId) : [];
    return { ...shared, continueWatching };
  }

  private async homeShared() {
    const base: Prisma.TitleWhereInput = { isActive: true, ...NOT_ADULT };

    /* ⚠️ Nested relation filter-т ГАРААР дамжуулна (өргөтгөл нэмэхгүй) */
    const _site = currentSite();

    const [banners, newReleases, comingSoon, popular, genres,
           heroOverrides, titleOrders, genreOverrides] =
      await Promise.all([
      /**
       * ⚠️⚠️ HERO — САЙТ БҮРД ӨӨР (`TitleSiteOrder`, genreId='').
       *
       * ⛔ БОДИТ АЛДАА (2026-09-10 аудит): апп нь дундын
       *    `Title.isBanner`/`bannerOrder`-ыг ШУУД уншдаг байв. Вэб
       *    дээр зассан атал апп орхигдсон → ижил хэрэглэгч утас/вэб
       *    хооронд ӨӨР hero харна:
       *      · BestFilm-д хассан кино АПП дээр ХЭВЭЭР гарна
       *      · BestFilm-д нэмсэн кино АПП дээр ОГТ гарахгүй
       *
       * ⚠️ Тиймээс ӨРГӨН татаад (үндсэн + сайтын нэмэлт), JS талд
       *    эцэслэнэ. `take: 8`-ыг ЭНД тавибал сайтын нэмэлт хасагдана.
       */
      this.prisma.title.findMany({
        where: {
          ...base,
          comingSoon: false,
          OR: [
            { isBanner: true },
            /* ⚠️ `site` ГАРААР — өргөтгөл nested filter-т нэмэхгүй */
            { siteOrders: { some: { site: _site, genreId: '', isBanner: true } } },
          ],
        },
        orderBy: [{ bannerOrder: 'asc' }, { createdAt: 'desc' }],
        take: 24,
        /* ⚠️ `isBanner`/`bannerOrder` ЗААВАЛ — fallback дүрэмд */
        select: { ...CARD, isBanner: true, bannerOrder: true },
      }),
      this.prisma.title.findMany({
        where: { ...base, comingSoon: false, hideFromNew: false },
        orderBy: [{ newReleasesOrder: 'asc' }, { createdAt: 'desc' }],
        take: 18,
        select: CARD,
      }),
      this.prisma.title.findMany({
        where: { ...base, comingSoon: true },
        orderBy: [{ comingSoonOrder: 'asc' }, { createdAt: 'desc' }],
        take: 12,
        select: CARD,
      }),
      this.prisma.title.findMany({
        where: { ...base, comingSoon: false },
        orderBy: { views: 'desc' },
        take: 18,
        select: CARD,
      }),
      /* ⚠️ 18+ ЖАНРЫГ ӨӨРИЙГ НЬ ч буцаахгүй — апп дээр «Насанд
         хүрэгчдийн» гэсэн ангилал харагдвал шалгагч анзаарна */
      this.prisma.genre.findMany({
        where: { isAdult: false },
        orderBy: { order: 'asc' },
        /* ⚠️ `order` ЗААВАЛ — `GenreSiteOrder` мөргүй жанрын fallback
           эрэмбэд хэрэгтэй (доорх `?? g.order`). Байхгүй бол бүгд 0
           болж дараалал санамсаргүй болно. */
        select: { id: true, name: true, slug: true, order: true },
      }),
      /**
       * ⚠️ HERO-ийн сайтын тохиргоо (`genreId = ''` мөрүүд).
       * `isBanner === null` бол «тохируулаагүй» → `Title.isBanner`.
       */
      this.prisma.titleSiteOrder.findMany({
        where: { genreId: '' },
        select: { titleId: true, order: true, isBanner: true },
      }),
      /**
       * ⚠️⚠️ ЖАНР ДОТОРХ КИНОНЫ ЭРЭМБЭ — САЙТ БҮРД ӨӨР.
       * ⛔ Апп нь дундын `TitleGenre.order`-оор эрэмбэлдэг байв.
       */
      this.prisma.titleSiteOrder.findMany({
        where: { genreId: { not: '' } },
        select: { titleId: true, genreId: true, order: true },
      }),
      /**
       * ⚠️⚠️ ЖАНРЫН ЭРЭМБЭ/ХАРАГДАЦ — САЙТ БҮРД ӨӨР.
       *
       * ⛔ Вэбийн `titles.service.ts` -тэй ЯГ ИЖИЛ алдаа энд ч байв:
       *    `Genre.order` (SHARED) -оор эрэмбэлдэг тул сайтын өөрийн
       *    эрэмбэ, нуусан жанр аль аль нь хэрэгжихгүй байсан.
       *
       * ⚠️ Вэб болон апп ИЖИЛ дараалал харуулах ЁСТОЙ — эс бөгөөс
       *    хэрэглэгч төхөөрөмж солиход өөр эрэмбэ хараад эргэлзэнэ.
       */
      this.prisma.genreSiteOrder.findMany({
        select: { genreId: true, order: true, isVisible: true },
      }),
    ]);

    /**
     * ⚠️⚠️ HERO-Г САЙТЫН ТОХИРГООГООР ЭЦЭСЛЭНЭ.
     *
     * Дүрэм (`titles.service.ts`-ийн вэбийнхтэй ЯГ ИЖИЛ):
     *   мөрийн `isBanner = true`  → ГАРНА
     *   мөрийн `isBanner = false` → ГАРАХГҮЙ
     *   мөр байхгүй / `null`      → `Title.isBanner` өвлөнө
     *
     * ⚠️ Эрэмбэлсний ДАРАА 8-аар таслана — өмнө нь таславал сайтын
     *    нэмсэн кино хэзээ ч гарахгүй.
     */
    const heroBy = new Map(heroOverrides.map((h) => [h.titleId, h]));
    const heroList = banners
      .filter((b) => heroBy.get(b.id)?.isBanner ?? b.isBanner)
      /* ⚠️ `i` — DB-ийн буцаасан байрлал (вэбтэй ИЖИЛ дүрэм) */
      .map((b, i) => ({ b, i, order: heroBy.get(b.id)?.order ?? b.bannerOrder }))
      .sort((a, b) => a.order - b.order || a.i - b.i)
      .slice(0, 8)
      .map((x) => x.b);

    /**
     * ⚠️ Кино×жанрын САЙТЫН эрэмбэ — `genreId|titleId` түлхүүртэй Map.
     * ⚠️ Мөр байхгүй бол DB-ийн буцаасан дараалал (TitleGenre.order).
     */
    const titleOrderBy = new Map(
      titleOrders.map((o) => [`${o.genreId}|${o.titleId}`, o.order]),
    );

    /**
     * ⚠️ Жанр бүрийн эгнээ — САЙТЫН эрэмбийг дагана.
     * ⚠️ Дүрэм нь `titles.service.ts` болон `genres.module.ts`-тэй
     *    ЯГ ИЖИЛ: мөр байвал түүний утга, байхгүй бол `Genre.order`
     *    + харагдана.
     */
    const genreOverrideBy = new Map(genreOverrides.map((o) => [o.genreId, o]));
    const visibleGenres = genres
      .filter((g) => genreOverrideBy.get(g.id)?.isVisible !== false)
      .map((g) => ({ g, order: genreOverrideBy.get(g.id)?.order ?? g.order }))
      .sort((a, b) => a.order - b.order || a.g.name.localeCompare(b.g.name, 'mn'))
      .map((x) => x.g);

    const genreRows = await Promise.all(
      visibleGenres.map(async (g) => {
        const rows = await this.prisma.titleGenre.findMany({
          where: {
            genreId: g.id,
            title: { ...base, comingSoon: false },
          },
          orderBy: [{ order: 'asc' }, { title: { createdAt: 'desc' } }],
          /**
           * ⚠️⚠️ 60 — САЙТЫН эрэмбийг хэрэглэх ЗАЙ.
           *
           * ⛔ 18 байхад: DB нь ДУНДЫН `TitleGenre.order`-оор эхний
           *    18-ыг сонгоно. BestFilm дээр 25-р байрны киног 1-р
           *    болгож эрэмбэлсэн ч ЭНЭ ШАТАНД хасагдаж, эгнээнд
           *    ХЭЗЭЭ Ч гарахгүй (вэб талд ижил урхи байсан).
           */
          take: 60,
          select: { titleId: true, title: { select: CARD } },
        });

        /**
         * ⚠️⚠️ САЙТЫН эрэмбээр ДАХИН жагсаагаад 18-аар таслана.
         * ⚠️ Fallback нь DB-ийн БУЦААСАН дараалал (`i`) — тэр нь
         *    `TitleGenre.order` + шинэ нь урьтах дүрмийг агуулна.
         */
        const ordered = rows
          .map((r, i) => ({
            r,
            order: titleOrderBy.get(`${g.id}|${r.titleId}`) ?? i,
          }))
          .sort((a, b) => a.order - b.order)
          .slice(0, 18)
          .map((x) => x.r);

        return {
          ...g,
          items: await this.media.decorateMany(ordered.map((r) => r.title)),
        };
      }),
    );

    return {
      /* ⚠️ `heroList` — сайтын override хэрэглэсэн, 8-аар тасалсан */
      banners: await this.media.decorateMany(heroList),
      newReleases: await this.media.decorateMany(newReleases),
      comingSoon: await this.media.decorateMany(comingSoon),
      popular: await this.media.decorateMany(popular),
      /* ⚠️ Хоосон эгнээг ХАСНА — апп дээр гарчигтай хоосон мөр эвгүй */
      genreRows: genreRows.filter((g) => g.items.length > 0),
    };
  }

  /** Үргэлжлүүлэх — 18+ хассан (вэбийнхтэй ижил дүрэм) */
  private async continueWatching(userId: string) {
    const rows = await this.prisma.watchProgress.findMany({
      where: {
        userId,
        /**
         * ⚠️⚠️ `sites: { has: … }` ЗААВАЛ — `WatchProgress` нь SCOPED ч
         * `Title` нь MULTI бөгөөд nested нөхцөлийг өргөтгөл ШҮҮДЭГГҮЙ.
         * Үүнгүйгээр нөгөө сайтад л байгаа кино «Үргэлжлүүлэн үзэх»
         * эгнээнд гарч ирнэ.
         */
        title: { sites: { has: currentSite() }, isActive: true, ...NOT_ADULT },
      },
      orderBy: { updatedAt: 'desc' },
      take: 12,
      include: {
        title: { select: CARD },
        episode: { select: { id: true, number: true } },
      },
    });

    /* ⚠️ 95%-аас дээш үзсэнийг ХАСНА — дууссан киног «үргэлжлүүл»
       гэж санал болгох нь утгагүй */
    const active = rows.filter((r) => r.durationSec === 0 || r.positionSec < r.durationSec * 0.95);
    const decorated = await this.media.decorateMany(active.map((r) => r.title));

    return active.map((r, i) => ({
      ...decorated[i],
      positionSec: r.positionSec,
      durationSec: r.durationSec,
      episodeId: r.episode?.id ?? null,
      episodeNumber: r.episode?.number ?? null,
    }));
  }

  /**
   * Каталог — 18+ хассан.
   *
   * ⚠️ Cursor пагинаци: offset (`page`) нь infinite scroll дээр мөр
   * ДАВХАРДУУЛНА (шинэ кино нэмэгдэхэд бүх мөр нэгээр шилжинэ).
   * Апп нь `FlatList` ашигладаг тул давхардсан `key` нь React алдаа өгнө.
   *
   * `cursor` нь сүүлийн элементийн `id` — тогтвортой.
   */
  async list(params: { type?: string; genre?: string; cursor?: string; limit?: number }) {
    const limit = Math.min(48, params.limit ?? 24);
    const where: Prisma.TitleWhereInput = {
      isActive: true,
      ...NOT_ADULT,
      ...(params.genre && params.genre !== 'ALL'
        ? { genres: { some: { genreId: params.genre } } }
        : {}),
      ...(params.type && params.type !== 'ALL' ? { type: params.type as TitleType } : {}),
    };

    const rows = await this.prisma.title.findMany({
      where,
      /* ⚠️ `id` нь ХОЁРДУГААР эрэмбэ — `createdAt` ижил бол дараалал
         тогтворгүй болж cursor алгасна/давхардана */
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: CARD,
    });

    /* ⚠️ `limit + 1` авч дараагийн хуудас БАЙГАА эсэхийг мэднэ —
       нэмэлт `count` query шаардлагагүй (хурдан) */
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: await this.media.decorateMany(items),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /** Хайлт — 18+ хассан */
  async search(q: string, limit = 30) {
    const all = await this.titles.search(q, Math.min(40, limit));
    /* ⚠️ `search()` нь галиг/үндэслэлийн нарийн логиктой тул ДАХИН
       бичихгүй — үр дүнгээс нь 18+ шүүнэ. Жанрын мэдээлэл хариунд
       ирдэг эсэхийг шалгаж, байхгүй бол ID-гаар шүүнэ. */
    const ids = all.map((t: { id: string }) => t.id);
    if (!ids.length) return [];

    const adult = await this.prisma.title.findMany({
      where: { id: { in: ids }, genres: { some: { genre: { isAdult: true } } } },
      select: { id: true },
    });
    const block = new Set(adult.map((a) => a.id));
    return all.filter((t: { id: string }) => !block.has(t.id));
  }

  /**
   * Киноны дэлгэрэнгүй — 18+ бол 404.
   *
   * ⚠️ 403 БИШ 404: «эрх байхгүй» гэвэл контент ОРШИХ нь мэдэгдэнэ.
   * Апп дээр тэр кино БАЙХГҮЙ мэт байх ёстой.
   */
  async detail(slug: string, userId?: string | null) {
    const t = await this.prisma.title.findUnique({
      where: { slug },
      /* ⚠️ `sites` ЗААВАЛ — post-filter fail-open-оос сэргийлнэ */
      select: { sites: true, id: true, genres: { select: { genre: { select: { isAdult: true } } } } },
    });
    if (!t || t.genres.some((g) => g.genre.isAdult)) {
      throw new NotFoundException('Контент олдсонгүй');
    }
    assertTitleOnSite(t.sites, 'Контент олдсонгүй');

    const detail = await this.titles.detail(slug, userId ?? undefined);

    /**
     * ⚠️⚠️ `related`-ЫГ ЗААВАЛ ШҮҮНЭ.
     *
     * БОДИТ ЦООРХОЙ байсан: `titles.detail` нь вэбийн хариу буцаадаг
     * тул «Төстэй кино» жагсаалтад 18+ кино ОРЖ ирдэг байв (тестээр
     * шалгасан 15 киноны БҮГД дээр илэрсэн). Кино өөрөө хаагдсан
     * атлаа санал болголтоор нэвтэрч байсан.
     *
     * ⚠️ Вэбийн `titles.service.ts`-д ХҮРЭХГҮЙ — зөвхөн энд шүүнэ.
     */
    const related = (detail as { related?: { id: string }[] }).related ?? [];
    if (related.length) {
      const adultIds = new Set(
        (
          await this.prisma.title.findMany({
            where: {
              id: { in: related.map((r) => r.id) },
              genres: { some: { genre: { isAdult: true } } },
            },
            select: { id: true },
          })
        ).map((x) => x.id),
      );
      if (adultIds.size) {
        return { ...detail, related: related.filter((r) => !adultIds.has(r.id)) };
      }
    }

    return detail;
  }

  /**
   * Жанрын жагсаалт — 18+ хассан.
   *
   * ⚠️⚠️ ЭРЭМБЭ/ХАРАГДАЦ САЙТ БҮРД ӨӨР (`GenreSiteOrder`).
   *
   * ⛔ БОДИТ АЛДАА (2026-09-10 аудит): дундын `Genre.order`-оор
   *    эрэмбэлж, `isVisible` шүүлт ОГТ хийдэггүй байв. Үр дүнд:
   *      · BestFilm-д «нуусан» жанр аппын каталогийн шүүлтүүрт
   *        ХЭВЭЭР гарч, дарахад кинонууд нь ч гарна
   *      · Аппын НҮҮР (GenreSiteOrder уншдаг) ба КАТАЛОГ (уншдаггүй)
   *        хоорондоо ЗӨРЧИЛТЭЙ дараалал харуулна
   *
   * ⚠️ Дүрэм нь `genres.module.ts` list()-тэй ЯГ ИЖИЛ байх ЁСТОЙ.
   */
  async genres() {
    const [rows, overrides] = await Promise.all([
      this.prisma.genre.findMany({
        where: { isAdult: false },
        orderBy: { order: 'asc' },
        /* ⚠️ `order` — мөр байхгүй жанрын fallback эрэмбэд ЗААВАЛ */
        select: { id: true, name: true, slug: true, order: true },
      }),
      this.prisma.genreSiteOrder.findMany({
        select: { genreId: true, order: true, isVisible: true },
      }),
    ]);

    const by = new Map(overrides.map((o) => [o.genreId, o]));
    return rows
      .filter((g) => by.get(g.id)?.isVisible !== false)
      .map((g) => ({ g, order: by.get(g.id)?.order ?? g.order }))
      .sort((a, b) => a.order - b.order || a.g.name.localeCompare(b.g.name, 'mn'))
      /* ⚠️ `order`-ыг гадагш ГАРГАХГҮЙ — апп зөвхөн дарааллыг дагана */
      .map(({ g }) => ({ id: g.id, name: g.name, slug: g.slug }));
  }

  /**
   * ⚠️⚠️ АППЫН ТОХИРГОО — алсаас удирдана.
   *
   * `paymentsEnabled` нь ГОЛ: Apple нь IAP-ийн дүрмээр QPay-г
   * татгалзвал апп дахин build хийхгүйгээр төлбөрийн дэлгэцийг
   * АЛСААС хаана (дахин илгээлтийн 1–2 долоо хоног хэмнэнэ).
   *
   * ⚠️ Орчны хувьсагчаас уншина — DB-д хадгалбал админ панелд
   * шинэ хуудас нэмэх шаардлагатай болно (одоохондоо илүүдэл).
   */
  config() {
    return {
      /* Аппын доод хувилбар — эндээс бага бол албадан шинэчлэлт */
      minVersion: process.env.APP_MIN_VERSION ?? '1.0.0',
      /* ⚠️ Анхдагч нь ҮНЭН — тохируулаагүй бол төлбөр ажиллана */
      paymentsEnabled: process.env.APP_PAYMENTS_ENABLED !== 'false',
      /* Вэбийн хаяг — «Багц авах» товч эндэ рүү чиглүүлнэ */
      webUrl: siteConfig().url,
      supportUrl: `${siteConfig().url}/faq`,
    };
  }
}

@Controller('mobile')
@UseGuards(OptionalJwtAuthGuard)
export class MobileController {
  constructor(private readonly svc: MobileService) {}

  /** ⚠️ `config` нь `:slug`-ЭЭС ӨМНӨ — эс бөгөөс slug гэж ойлгогдоно */
  @Get('config')
  config() {
    return this.svc.config();
  }

  @Get('home')
  home(@CurrentUser() user?: JwtPayload) {
    return this.svc.home(user?.sub);
  }

  @Get('genres')
  genres() {
    return this.svc.genres();
  }

  @Get('search')
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    if (!q?.trim()) return [];
    /**
     * ⚠️⚠️ УРТЫГ ХЯЗГААРЛАНА — вэб хувилбартай ИЖИЛ.
     *
     * ⛔ `titles.controller.ts:66` нь `.slice(0, 100)` хийдэг болсон
     * (бодит осол: `q=bubobubo…` 20 тэмдэгт origin-ыг 125 СЕКУНД
     * түгжсэн). Mobile нь ЯГ ижил `titles.search()`-ыг дуудна.
     *
     * `MAX_VARIANTS=64` нь экспоненциал тэсрэлтийг барьсан ч `q` нь
     * `$queryRaw` trigram `similarity()` руу хязгааргүй уртаар очно.
     */
    return this.svc.search(q.slice(0, 100), limit ? Number(limit) : 30);
  }

  @Get('titles')
  list(
    @Query('type') type?: string,
    @Query('genre') genre?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list({ type, genre, cursor, limit: limit ? Number(limit) : 24 });
  }

  @Get('titles/:slug')
  detail(@Param('slug') slug: string, @CurrentUser() user?: JwtPayload) {
    return this.svc.detail(slug, user?.sub);
  }
}

@Module({
  /* ⚠️ `TitlesService` + `TitleMediaHelper`-ийг ДАХИН ашиглана —
     код давхардуулахгүй, зөвхөн шүүлт нэмнэ */
  imports: [TitlesModule],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}
