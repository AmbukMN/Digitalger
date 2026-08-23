import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';

/** Хугацааны сонголт — dashboard-тай ижил */
/** ⚠️ AnalyticsService-ийн RANGE_DAYS-тэй ЯГ ИЖИЛ байх ёстой */
const RANGE_DAYS: Record<string, number> = {
  today: 1,
  /**
   * ⚠️ «Өнөөдрийн тойм» карт нь ӨЧИГДӨРТЭЙ харьцуулахын тулд 2 хоногийг
   * татаад өнөөдрийг хасдаг. Энэ мужгүй бол `?? 30` руу унаж
   * харьцуулалт ХУДАЛ болно (30 хоногийн орлогыг «өчигдөр» гэж үзнэ).
   */
  '2d': 2,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '365d': 365,
};

/**
 * Хэрэглэгчийн зан төлөвийн шинжилгээ (Google Analytics-ийн жижиг хувилбар).
 *
 * ⚠️ Аль хэдийн цуглуулж байгаа `PageView` / `TitleEvent` / `SearchEvent`
 * өгөгдлөөс тооцоолно — шинэ дата цуглуулах шаардлагагүй.
 *
 * Хэмжигдэхүүнүүд нь стриминг платформд ЧУХАЛ зүйлүүд:
 *   - Хэн юу үзэж байна (эрэлт)
 *   - Хаана орхиж байна (conversion funnel)
 *   - Юу хайж байгаа боловч ОЛДОХГҮЙ байна (контентын цоорхой)
 */
@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private bounds(range: string) {
    const days = RANGE_DAYS[range] ?? 30;
    const from = new Date(Date.now() - days * 86400_000);
    return { days, from };
  }

  /**
   * ⚠️ 5 МИНУТ КЭШЛЭНЭ — админ dashboard нь real-time байх шаардлагагүй.
   * Энэ нь 12 хүнд асуулга (groupBy, distinct, count) зэрэг ажиллуулдаг
   * тул админ хуудсаа refresh дарах бүрд DB-г дарамтална.
   * ⚠️ `range` нь түлхүүрт орно — 7d/30d/365d тус тусдаа кэштэй.
   */
  async overview(range = '30d') {
    return this.cache.wrap(`insights:${range}`, 300, () => this.overviewFresh(range));
  }

  private async overviewFresh(range: string) {
    const { days, from } = this.bounds(range);

    const [
      pageViews,
      uniqueSessions,
      uniqueUsers,
      deviceRows,
      topPages,
      referrers,
      titleEvents,
      topViewed,
      topPlayed,
      topCompleted,
      searches,
      noResultSearches,
      hourly,
    ] = await Promise.all([
      this.prisma.pageView.count({ where: { createdAt: { gte: from } } }),
      this.prisma.pageView
        .findMany({
          where: { createdAt: { gte: from }, sessionId: { not: null } },
          distinct: ['sessionId'],
          select: { sessionId: true },
        })
        .then((r) => r.length),
      this.prisma.pageView
        .findMany({
          where: { createdAt: { gte: from }, userId: { not: null } },
          distinct: ['userId'],
          select: { userId: true },
        })
        .then((r) => r.length),
      this.prisma.pageView.groupBy({
        by: ['device'],
        where: { createdAt: { gte: from } },
        _count: true,
      }),
      this.prisma.pageView.groupBy({
        by: ['path'],
        where: { createdAt: { gte: from } },
        _count: true,
        orderBy: { _count: { path: 'desc' } },
        take: 12,
      }),
      this.prisma.pageView.groupBy({
        by: ['referrer'],
        where: { createdAt: { gte: from }, referrer: { not: null } },
        _count: true,
        orderBy: { _count: { referrer: 'desc' } },
        take: 8,
      }),
      this.prisma.titleEvent.groupBy({
        by: ['type'],
        where: { createdAt: { gte: from } },
        _count: true,
      }),
      // Хамгийн их НЭЭСЭН (дэлгэрэнгүй харсан)
      this.prisma.titleEvent.groupBy({
        by: ['titleId', 'titleName'],
        where: { createdAt: { gte: from }, type: 'view' },
        _count: true,
        orderBy: { _count: { titleId: 'desc' } },
        take: 10,
      }),
      // Хамгийн их ТОГЛУУЛСАН
      this.prisma.titleEvent.groupBy({
        by: ['titleId', 'titleName'],
        where: { createdAt: { gte: from }, type: 'play' },
        _count: true,
        orderBy: { _count: { titleId: 'desc' } },
        take: 10,
      }),
      // Хамгийн их ДУУСГАСАН — жинхэнэ таалагдсан контент
      this.prisma.titleEvent.groupBy({
        by: ['titleId', 'titleName'],
        where: { createdAt: { gte: from }, type: 'complete' },
        _count: true,
        orderBy: { _count: { titleId: 'desc' } },
        take: 10,
      }),
      this.prisma.searchEvent.groupBy({
        by: ['query'],
        where: { createdAt: { gte: from } },
        _count: true,
        orderBy: { _count: { query: 'desc' } },
        take: 12,
      }),
      // ⚠️ ХАМГИЙН ҮНЭТЭЙ ХЭМЖИГДЭХҮҮН: хайсан ч ОЛДООГҮЙ — ямар контент
      // дутуу байгааг шууд харуулна
      this.prisma.searchEvent.groupBy({
        by: ['query'],
        where: { createdAt: { gte: from }, results: 0 },
        _count: true,
        orderBy: { _count: { query: 'desc' } },
        take: 12,
      }),
      /**
       * ⚠️⚠️ ЦАГИЙН ХУВААРИЛАЛТЫГ SQL-ЭЭР бүлэглэнэ.
       *
       * Өмнө нь `findMany({ select: { createdAt } })` — `take` БАЙХГҮЙ.
       * `range=365d` сонговол ЖИЛИЙН БҮХ PageView мөр Node процессын
       * санах ойд ордог (1 сая мөр = 1 сая Date объект) → GC даралт,
       * магадгүй OOM-оор backend унана. Postgres тал дээр бүлэглэвэл
       * 24 мөр л буцна.
       *
       * ⚠️ `date_part('hour', ...)` нь UTC-ээр тооцно. `getHours()` нь
       * серверийн цагийн бүсээр тооцдог байсан — сервер UTC тул үр дүн
       * ИЖИЛ (Германд байрлалтай ч контейнер UTC).
       */
      this.prisma.$queryRaw<{ h: number; c: bigint }[]>`
        SELECT date_part('hour', "createdAt")::int AS h, count(*)::bigint AS c
        FROM "PageView"
        WHERE "createdAt" >= ${from}
        GROUP BY 1
      `,
    ]);

    const evt = (t: string) => titleEvents.find((e) => e.type === t)?._count ?? 0;
    const views = evt('view');
    const plays = evt('play');
    const completes = evt('complete');

    // Цагийн хуваарилалт — хэзээ хамгийн их үздэгийг мэдэх
    const byHour = Array.from({ length: 24 }, () => 0);
    /* ⚠️ `count(*)` нь bigint буцаана — JSON-д хөрвүүлэхэд алдана */
    for (const row of hourly) byHour[row.h] = Number(row.c);
    const peakHour = byHour.indexOf(Math.max(...byHour));

    return {
      range,
      days,
      traffic: {
        pageViews,
        uniqueSessions,
        uniqueUsers,
        /** Дундаж — нэг сешн хэдэн хуудас үзсэн */
        pagesPerSession: uniqueSessions ? +(pageViews / uniqueSessions).toFixed(1) : 0,
        peakHour,
        byHour,
      },
      devices: deviceRows.map((d) => ({ device: d.device ?? 'тодорхойгүй', count: d._count })),
      topPages: topPages.map((p) => ({ path: p.path, count: p._count })),
      referrers: referrers.map((r) => ({ source: this.cleanReferrer(r.referrer), count: r._count })),
      /**
       * Үзэлтийн юүлүүр (funnel) — хаана хэрэглэгч орхиж байгааг харна.
       * дэлгэрэнгүй нээсэн → тоглуулсан → дуустал үзсэн
       */
      funnel: {
        views,
        plays,
        /**
         * ⚠️ `completes` нь `plays`-ээс ИХ гарч болзошгүй: 'complete' үйлдэл
         * тоглуулалт бүрт биш, хуудас сэргээх/үргэлжлүүлэх үед ч бүртгэгддэг
         * бөгөөд эхлэлийн 'play' нь өөр мужид унасан байж болно.
         * Юүлүүр нь БУУРАХ дараалалтай байх ёстой (үзсэн ≥ тоглуулсан ≥
         * дуусгасан) тул дээд хязгаарыг барина — эс бөгөөс "150%" гэж
         * гарч, график дүүрэн улаан болдог байв.
         */
        completes: Math.min(completes, plays),
        // ⚠️ Хоёр хувийг ЭХНИЙ алхмаас (views) тооцно — үе шат бүр
        //    өмнөхөөсөө бага хувьтай болж, юүлүүр зөв харагдана.
        playRate: views ? Math.round((plays / views) * 100) : 0,
        completeRate: views ? Math.round((Math.min(completes, plays) / views) * 100) : 0,
      },
      topViewed: this.mapTitles(topViewed),
      topPlayed: this.mapTitles(topPlayed),
      topCompleted: this.mapTitles(topCompleted),
      searches: searches.map((s) => ({ query: s.query, count: s._count })),
      /** ⚠️ Контентын цоорхой — эдгээрийг нэмбэл шууд эрэлттэй */
      noResultSearches: noResultSearches.map((s) => ({ query: s.query, count: s._count })),
    };
  }

  private mapTitles(rows: { titleId: string; titleName: string | null; _count: number }[]) {
    return rows.map((r) => ({
      titleId: r.titleId,
      title: r.titleName ?? '(устгагдсан)',
      count: r._count,
    }));
  }

  /** Referrer-ээс домэйныг л авна (URL бүтнээр нь харуулбал уншигдахгүй) */
  private cleanReferrer(ref: string | null): string {
    if (!ref) return 'Шууд';
    try {
      const host = new URL(ref).hostname.replace(/^www\./, '');
      if (host.includes('besttv')) return 'Дотоод';
      if (host.includes('google')) return 'Google';
      if (host.includes('facebook') || host.includes('fb.')) return 'Facebook';
      if (host.includes('instagram')) return 'Instagram';
      return host;
    } catch {
      return 'Тодорхойгүй';
    }
  }

  /**
   * ⚠️⚠️ КОНТЕНТ ГҮЙЦЭТГЭЛ — админд нарийн insight (хүсэлт).
   *
   * • topRented   — хамгийн их түрээслэгдсэн кино (тоо + орлого)
   * • topViewed   — хамгийн их үзэгдсэн кино (views)
   * • byGenre     — жанр бүрийн түрээсийн орлого + ширхэг
   * • rentalTotal — нийт түрээсийн орлого/тоо (топапгүй)
   *
   * ⚠️ 5 минут кэштэй (groupBy + join хүнд).
   */
  async contentInsights() {
    return this.cache.wrap('content-insights', 300, () => this.contentInsightsFresh());
  }

  private async contentInsightsFresh() {
    // 1. Түрээсийн төлбөр кино бүрээр (PAID, rentalTitleId-тэй)
    const rentalSales = await this.prisma.payment.groupBy({
      by: ['rentalTitleId'],
      where: { status: 'PAID', isWalletTopup: false, rentalTitleId: { not: null } },
      _sum: { amount: true },
      _count: { _all: true },
    });
    const titleIds = rentalSales.map((r) => r.rentalTitleId!).filter(Boolean);

    // 2. Тэдгээр киноны нэр/жанр
    const titles = titleIds.length
      ? await this.prisma.title.findMany({
          where: { id: { in: titleIds } },
          select: {
            id: true,
            title: true,
            type: true,
            views: true,
            genres: { select: { genre: { select: { name: true, slug: true } } } },
          },
        })
      : [];
    const titleById = new Map(titles.map((t) => [t.id, t]));

    // 3. Хамгийн их түрээслэгдсэн — тоогоор эрэмбэлж, дээд 10
    const topRented = rentalSales
      .map((r) => {
        const t = titleById.get(r.rentalTitleId!);
        return {
          id: r.rentalTitleId!,
          title: t?.title ?? '(устсан)',
          type: t?.type ?? 'MOVIE',
          count: r._count._all,
          revenue: r._sum.amount ?? 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 4. Жанр бүрийн түрээсийн орлого/тоо (кино → жанрууд)
    const genreMap = new Map<string, { name: string; count: number; revenue: number }>();
    for (const r of rentalSales) {
      const t = titleById.get(r.rentalTitleId!);
      if (!t) continue;
      for (const g of t.genres) {
        const key = g.genre.slug;
        const cur = genreMap.get(key) ?? { name: g.genre.name, count: 0, revenue: 0 };
        cur.count += r._count._all;
        cur.revenue += r._sum.amount ?? 0;
        genreMap.set(key, cur);
      }
    }
    const byGenre = [...genreMap.values()].sort((a, b) => b.revenue - a.revenue);

    // 5. Хамгийн их үзэгдсэн кино (views — түрээснээс үл хамааран бүх идэвхтэй)
    const topViewed = await this.prisma.title.findMany({
      where: { isActive: true },
      orderBy: { views: 'desc' },
      take: 10,
      select: { id: true, title: true, type: true, views: true, rating: true },
    });

    const rentalTotal = rentalSales.reduce(
      (acc, r) => ({
        count: acc.count + r._count._all,
        revenue: acc.revenue + (r._sum.amount ?? 0),
      }),
      { count: 0, revenue: 0 },
    );

    return { topRented, topViewed, byGenre, rentalTotal };
  }
}
