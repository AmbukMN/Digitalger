import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // Дамжуулсан userId DB-д бодитоор оршдог эсэхийг шалгана.
  // (Хуучин/устсан/хуурамч id-аас FK алдаа гарахаас сэргийлж, fail-open.)
  private async safeUserId(userId?: string): Promise<string | undefined> {
    if (!userId) return undefined;
    try {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      return u ? userId : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Нэвтрэх агшинд дуудна: тухайн session-ийн userId-гүй (зочин үед бичигдсэн)
   * бүх ProductEvent/PageView-г энэ хэрэглэгчид буцаан холбоно. Хэрэглэгч ихэвчлэн
   * нэвтрэхээсээ ӨМНӨ бүтээгдэхүүн үздэг тул эс бол admin popup "Үзсэн/Дарсан"
   * хоосон харагддаг — энэ нь нэвтрэхээс өмнөх зан төлөвийг хэрэглэгчид холбоно.
   */
  async backfillSessionEvents(sessionId: string, userId: string): Promise<void> {
    if (!sessionId || !userId) return;
    const safe = await this.safeUserId(userId);
    if (!safe) return;
    try {
      await this.prisma.$transaction([
        this.prisma.productEvent.updateMany({
          where: { sessionId, userId: null },
          data: { userId: safe },
        }),
        this.prisma.pageView.updateMany({
          where: { sessionId, userId: null },
          data: { userId: safe },
        }),
      ]);
    } catch {
      // backfill амжилтгүй болсон ч нэвтрэлтэд нөлөөлөхгүй (best-effort).
    }
  }

  async trackPageView(data: {
    path: string;
    sessionId?: string;
    device?: string;
    referrer?: string;
    userId?: string;
  }) {
    const userId = await this.safeUserId(data.userId);
    return this.prisma.pageView.create({ data: { ...data, userId } });
  }

  async trackProductEvent(data: {
    type: string;
    productId: string;
    productSlug: string;
    sessionId?: string;
    userId?: string;
    device?: string;
  }) {
    const userId = await this.safeUserId(data.userId);
    return this.prisma.productEvent.create({ data: { ...data, userId } });
  }

  async trackSearch(data: {
    query: string;
    results: number;
    sessionId?: string;
  }) {
    return this.prisma.searchEvent.create({ data });
  }

  async getDashboardStats(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [
      totalViews,
      todayViews,
      yesterdayViews,
      topPages,
      topProducts,
      topSearches,
      deviceStats,
      dailyViews,
      productFunnel,
    ] = await Promise.all([
      // Нийт views (days хоног)
      this.prisma.pageView.count({ where: { createdAt: { gte: since } } }),

      // Өнөөдрийн views
      this.prisma.pageView.count({ where: { createdAt: { gte: today } } }),

      // Өчигдрийн views
      this.prisma.pageView.count({
        where: { createdAt: { gte: yesterday, lt: today } },
      }),

      // Top хуудсууд
      this.prisma.pageView.groupBy({
        by: ['path'],
        where: { createdAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),

      // Top бүтээгдэхүүн (view-аар)
      this.prisma.productEvent.groupBy({
        by: ['productSlug', 'productId'],
        where: { type: 'view', createdAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),

      // Top хайлтын үгс
      this.prisma.searchEvent.groupBy({
        by: ['query'],
        where: { createdAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),

      // Device breakdown
      this.prisma.pageView.groupBy({
        by: ['device'],
        where: { createdAt: { gte: since }, device: { not: null } },
        _count: { id: true },
      }),

      // Өдөр тутмын views (сүүлийн 30 хоног)
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE("createdAt")::text as date, COUNT(*)::bigint as count
        FROM "PageView"
        WHERE "createdAt" >= ${since}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,

      // Funnel: view → click → cart → purchase
      this.prisma.productEvent.groupBy({
        by: ['type'],
        where: { createdAt: { gte: since } },
        _count: { id: true },
      }),
    ]);

    return {
      overview: {
        totalViews,
        todayViews,
        yesterdayViews,
        growthPercent:
          yesterdayViews > 0
            ? Math.round(((todayViews - yesterdayViews) / yesterdayViews) * 100)
            : null,
      },
      dailyViews: dailyViews.map((d) => ({
        date: d.date,
        count: Number(d.count),
      })),
      topPages: topPages.map((p) => ({ path: p.path, count: p._count.id })),
      topProducts: topProducts.map((p) => ({
        slug: p.productSlug,
        productId: p.productId,
        views: p._count.id,
      })),
      topSearches: topSearches.map((s) => ({
        query: s.query,
        count: s._count.id,
      })),
      deviceStats: deviceStats.map((d) => ({
        device: d.device ?? 'unknown',
        count: d._count.id,
      })),
      funnel: {
        view: productFunnel.find((f) => f.type === 'view')?._count.id ?? 0,
        click: productFunnel.find((f) => f.type === 'click')?._count.id ?? 0,
        cart: productFunnel.find((f) => f.type === 'cart')?._count.id ?? 0,
        purchase: productFunnel.find((f) => f.type === 'purchase')?._count.id ?? 0,
      },
    };
  }
}
