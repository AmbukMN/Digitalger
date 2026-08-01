import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Хугацааны сонголт — dashboard-тай ижил */
const RANGE_DAYS: Record<string, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
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
  constructor(private readonly prisma: PrismaService) {}

  private bounds(range: string) {
    const days = RANGE_DAYS[range] ?? 30;
    const from = new Date(Date.now() - days * 86400_000);
    return { days, from };
  }

  async overview(range = '30d') {
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
      this.prisma.pageView.findMany({
        where: { createdAt: { gte: from } },
        select: { createdAt: true },
      }),
    ]);

    const evt = (t: string) => titleEvents.find((e) => e.type === t)?._count ?? 0;
    const views = evt('view');
    const plays = evt('play');
    const completes = evt('complete');

    // Цагийн хуваарилалт — хэзээ хамгийн их үздэгийг мэдэх
    const byHour = Array.from({ length: 24 }, () => 0);
    for (const p of hourly) byHour[p.createdAt.getHours()] += 1;
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
        completes,
        playRate: views ? Math.round((plays / views) * 100) : 0,
        completeRate: plays ? Math.round((completes / plays) * 100) : 0,
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
}
