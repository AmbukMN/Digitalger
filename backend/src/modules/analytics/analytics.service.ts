import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { AppCacheService, CacheKeys } from '../../common/cache/app-cache.service';

// Имэйл маркетингийн кампанит ажлууд (admin dashboard-д харагдах эрэмбээр).
// redis email:open:{campaign} тоолуур болон EmailOpen хүснэгтийн campaign-тай тааруулна.
const EMAIL_CAMPAIGNS: { key: string; label: string }[] = [
  { key: 'cart-1h', label: 'Сагс сануулга (1ц)' },
  { key: 'discount-24h', label: 'Хөнгөлөлт (24ц)' },
  { key: 'coupon-expiring', label: 'Купон дуусах' },
  { key: 'new-product', label: 'Шинэ бүтээгдэхүүн' },
  { key: 'reactivation', label: 'Эргэн идэвхжүүлэх' },
  { key: 'welcome', label: 'Тавтай морил' },
];

@Injectable()
export class AnalyticsService {
  private readonly redis: Redis;

  constructor(
    private prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cache: AppCacheService,
  ) {
    const redisUrl =
      this.config.get<string>('redisUrl') ??
      this.config.get<string>('REDIS_URL') ??
      'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
  }

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
        this.prisma.searchEvent.updateMany({
          where: { sessionId, userId: null },
          data: { userId: safe },
        }),
        this.prisma.lessonEvent.updateMany({
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
    userId?: string;
  }) {
    const userId = await this.safeUserId(data.userId);
    return this.prisma.searchEvent.create({ data: { ...data, userId } });
  }

  // Хичээлийн видео үзэлтийн event (lesson_started/completed/progress).
  // ProductEvent-тэй ижил хэв маяг: public, fail-open. lessonId/productId-д хатуу
  // FK байхгүй тул устсан id-аас ч insert унахгүй. userId л safeUserId-аар шалгагдана.
  async trackLessonEvent(data: {
    event: string;
    lessonId: string;
    productId?: string;
    sessionId?: string;
    userId?: string;
    watchedSeconds?: number;
    durationSec?: number;
    playbackSpeed?: number;
    position?: number;
    device?: string;
  }) {
    const userId = await this.safeUserId(data.userId);
    return this.prisma.lessonEvent.create({
      data: {
        event: data.event,
        lessonId: data.lessonId,
        productId: data.productId,
        sessionId: data.sessionId,
        userId,
        watchedSeconds: data.watchedSeconds,
        durationSec: data.durationSec,
        playbackSpeed: data.playbackSpeed,
        position: data.position,
        device: data.device,
      },
    });
  }

  // Admin dashboard 15+ parallel query (2-3 сек) — статистик тул 5 мин хоцролт
  // зүгээр. Redis cache-аар дараагийн ачаалал шуурхай болно. Invalidate
  // шаардлагагүй (TTL дуусахад дахин тооцоолно). Fail-open: Redis унавал DB.
  async getDashboardStats(days = 30) {
    return this.cache.getOrSet(
      `${CacheKeys.dashboardStatsPrefix}stats:${days}`,
      5 * 60_000,
      () => this.computeDashboardStats(days),
    );
  }

  private async computeDashboardStats(days = 30) {
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
      lessonEventCounts,
      lessonWatchAgg,
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

      // Хичээлийн event тоо (lesson_started / lesson_completed / lesson_progress)
      this.prisma.lessonEvent.groupBy({
        by: ['event'],
        where: { createdAt: { gte: since } },
        _count: { id: true },
      }),

      // Дундаж үзсэн секунд (зөвхөн lesson_completed event-ийн watchedSeconds)
      this.prisma.lessonEvent.aggregate({
        where: {
          event: 'lesson_completed',
          createdAt: { gte: since },
          watchedSeconds: { not: null },
        },
        _avg: { watchedSeconds: true },
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
      lessons: {
        started:
          lessonEventCounts.find((e) => e.event === 'lesson_started')?._count
            .id ?? 0,
        completed:
          lessonEventCounts.find((e) => e.event === 'lesson_completed')?._count
            .id ?? 0,
        progress:
          lessonEventCounts.find((e) => e.event === 'lesson_progress')?._count
            .id ?? 0,
        avgWatchSeconds: lessonWatchAgg._avg.watchedSeconds
          ? Math.round(lessonWatchAgg._avg.watchedSeconds)
          : 0,
      },
    };
  }

  /**
   * Хичээлийн аналитик (lesson dropoff / курс дуусгалт).
   * - Хичээл бүрээр started vs completed тоо (хамгийн их орхиж буй хичээл = dropoff).
   * - Ерөнхий курс дуусгалтын хувь = completed / started.
   * - Дундаж үзсэн секунд (completed event-ийн watchedSeconds).
   * lessonId-д хатуу FK байхгүй тул Lesson.title-ийг тусад нь resolve хийнэ
   * (устсан хичээлийн id үлдсэн байж болно — байхгүй бол id-ийн товчлол харуулна).
   */
  async getLessonAnalytics(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [lessonGroups, lessonEventCounts, lessonWatchAgg] = await Promise.all([
      // Хичээл бүрээр event төрлийн тоо (started/completed/progress)
      this.prisma.lessonEvent.groupBy({
        by: ['lessonId', 'event'],
        where: { createdAt: { gte: since } },
        _count: { id: true },
      }),

      // Ерөнхий event тоо (курс дуусгалтын хувь бодоход)
      this.prisma.lessonEvent.groupBy({
        by: ['event'],
        where: { createdAt: { gte: since } },
        _count: { id: true },
      }),

      // Дундаж үзсэн секунд (completed)
      this.prisma.lessonEvent.aggregate({
        where: {
          event: 'lesson_completed',
          createdAt: { gte: since },
          watchedSeconds: { not: null },
        },
        _avg: { watchedSeconds: true },
      }),
    ]);

    // lessonId бүрээр started/completed нэгтгэх
    const byLesson = new Map<string, { started: number; completed: number }>();
    for (const g of lessonGroups) {
      const rec = byLesson.get(g.lessonId) ?? { started: 0, completed: 0 };
      if (g.event === 'lesson_started') rec.started += g._count.id;
      else if (g.event === 'lesson_completed') rec.completed += g._count.id;
      byLesson.set(g.lessonId, rec);
    }

    // Хичээлийн нэрсийг resolve (зөвхөн илэрсэн id-уудаар)
    const lessonIds = [...byLesson.keys()];
    const titles = lessonIds.length
      ? await this.prisma.lesson.findMany({
          where: { id: { in: lessonIds } },
          select: { id: true, title: true },
        })
      : [];
    const titleMap = new Map(titles.map((l) => [l.id, l.title]));

    // dropoff = started > 0 бөгөөд completed < started. dropoffRate-аар эрэмбэлнэ.
    const lessons = lessonIds
      .map((id) => {
        const { started, completed } = byLesson.get(id)!;
        const dropoff = Math.max(0, started - completed);
        const dropoffRate = started > 0 ? Math.round((dropoff / started) * 100) : 0;
        const completionRate =
          started > 0 ? Math.round((completed / started) * 100) : 0;
        return {
          lessonId: id,
          title: titleMap.get(id) ?? `Хичээл ${id.slice(0, 6)}…`,
          started,
          completed,
          dropoff,
          dropoffRate,
          completionRate,
        };
      })
      // Зөвхөн эхлүүлсэн хичээлүүд (хог утга шүүх)
      .filter((l) => l.started > 0)
      .sort((a, b) => b.dropoff - a.dropoff || b.started - a.started);

    const totalStarted =
      lessonEventCounts.find((e) => e.event === 'lesson_started')?._count.id ?? 0;
    const totalCompleted =
      lessonEventCounts.find((e) => e.event === 'lesson_completed')?._count.id ?? 0;

    return {
      // Ерөнхий курс дуусгалтын хувь (completed / started)
      completionRate:
        totalStarted > 0
          ? Math.round((totalCompleted / totalStarted) * 100)
          : 0,
      totalStarted,
      totalCompleted,
      avgWatchSeconds: lessonWatchAgg._avg.watchedSeconds
        ? Math.round(lessonWatchAgg._avg.watchedSeconds)
        : 0,
      // Топ dropoff (хамгийн их орхиж буй) — графикт эхний 8
      topDropoff: lessons.slice(0, 8),
    };
  }

  /**
   * Имэйл маркетингийн кампанит ажлуудын нээлтийн статистик.
   * - openedTotal: redis email:open:{campaign} тоолуур (нийт амьдралын турш).
   * - openedPeriod / uniqueOpens: EmailOpen хүснэгт (сонгосон хугацаанд, бодит/unique).
   * EmailOpen хүснэгт нь нээлт бүрт мөр үүсгэдэг тул бодит open rate-д энэ найдвартай.
   */
  async getEmailAnalytics(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // EmailOpen + EmailLog-оос campaign бүрийн нээлт/илгээлтийг ЗЭРЭГ авна.
    const [opensGrouped, uniqueGrouped, sentGrouped, deliveredGrouped, bouncedGrouped] =
      await Promise.all([
        // 1) Нийт нээлт (campaign бүрд, хугацаанд)
        this.prisma.emailOpen.groupBy({
          by: ['campaign'],
          where: { openedAt: { gte: since } },
          _count: { id: true },
        }),
        // 2) Unique = ялгаатай (campaign+email) хосын тоо
        this.prisma.emailOpen.groupBy({
          by: ['campaign', 'email'],
          where: { openedAt: { gte: since } },
          _count: { id: true },
        }),
        // 3) Илгээсэн (sent) — EmailLog-оос campaign бүрийн нийт илгээлт
        this.prisma.emailLog.groupBy({
          by: ['campaign'],
          where: { campaign: { not: null }, createdAt: { gte: since } },
          _count: { id: true },
        }),
        // 4) Хүргэгдсэн (delivered)
        this.prisma.emailLog.groupBy({
          by: ['campaign'],
          where: { campaign: { not: null }, deliveredAt: { gte: since } },
          _count: { id: true },
        }),
        // 5) Буцсан (bounced)
        this.prisma.emailLog.groupBy({
          by: ['campaign'],
          where: { campaign: { not: null }, bouncedAt: { gte: since } },
          _count: { id: true },
        }),
      ]);

    const openMap = new Map(opensGrouped.map((o) => [o.campaign, o._count.id]));
    const uniqueMap = new Map<string, number>();
    for (const u of uniqueGrouped) {
      uniqueMap.set(u.campaign, (uniqueMap.get(u.campaign) ?? 0) + 1);
    }
    const sentMap = new Map(
      sentGrouped.map((s) => [s.campaign as string, s._count.id]),
    );
    const deliveredMap = new Map(
      deliveredGrouped.map((s) => [s.campaign as string, s._count.id]),
    );
    const bouncedMap = new Map(
      bouncedGrouped.map((s) => [s.campaign as string, s._count.id]),
    );

    // redis нийт тоолуур (best-effort, fail-open)
    const redisTotals = await Promise.all(
      EMAIL_CAMPAIGNS.map(async (c) => {
        try {
          const v = await this.redis.get(`email:open:${c.key}`);
          return v ? parseInt(v, 10) : 0;
        } catch {
          return 0;
        }
      }),
    );

    // campaign бүрд бүрэн үзүүлэлт бүтээх туслах (sent/delivered/opened/unique/openRate)
    const buildCampaign = (key: string, label: string, openedTotal: number) => {
      const sent = sentMap.get(key) ?? 0;
      const delivered = deliveredMap.get(key) ?? 0;
      const bounced = bouncedMap.get(key) ?? 0;
      const openedPeriod = openMap.get(key) ?? 0;
      const uniqueOpens = uniqueMap.get(key) ?? 0;
      // Open rate = unique нээгчид / илгээсэн (sent байхгүй бол delivered-ээр)
      const denom = sent || delivered || 0;
      const openRate = denom > 0 ? Math.round((uniqueOpens / denom) * 1000) / 10 : 0;
      return {
        key,
        label,
        sent,
        delivered,
        bounced,
        openedPeriod,
        uniqueOpens,
        openedTotal,
        openRate, // %
      };
    };

    // EMAIL_CAMPAIGNS + DB-д орсон бусад (sent эсвэл opened-тэй) campaign-уудыг нэгтгэх
    const known = new Set(EMAIL_CAMPAIGNS.map((c) => c.key));
    const extraKeys = new Set<string>();
    for (const k of openMap.keys()) if (!known.has(k)) extraKeys.add(k);
    for (const k of sentMap.keys()) if (!known.has(k)) extraKeys.add(k);

    const campaigns = [
      ...EMAIL_CAMPAIGNS.map((c, i) =>
        buildCampaign(c.key, c.label, redisTotals[i]),
      ),
      ...[...extraKeys].map((k) => buildCampaign(k, this.prettyCampaign(k), 0)),
    ]
      // Илгээлт ч, нээлт ч байхгүй хоосон campaign-ийг нуух (UI цэвэр байх)
      .filter((c) => c.sent > 0 || c.openedPeriod > 0 || c.openedTotal > 0)
      // Хамгийн их илгээсэн нь дээр
      .sort((a, b) => b.sent - a.sent || b.openedPeriod - a.openedPeriod);

    const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
    const totalDelivered = campaigns.reduce((s, c) => s + c.delivered, 0);
    const totalOpensPeriod = campaigns.reduce((s, c) => s + c.openedPeriod, 0);
    const totalUnique = campaigns.reduce((s, c) => s + c.uniqueOpens, 0);
    // Нийт open rate = unique нээгчид / нийт илгээсэн
    const overallOpenRate =
      totalSent > 0 ? Math.round((totalUnique / totalSent) * 1000) / 10 : 0;

    return {
      campaigns,
      totalSent,
      totalDelivered,
      totalOpensPeriod,
      totalUnique,
      overallOpenRate,
    };
  }

  // Campaign key-г уншихад ойлгомжтой Монгол нэр болгох (bulk-167... → "Бөөн илгээлт").
  private prettyCampaign(key: string): string {
    if (key.startsWith('bulk-') || key.startsWith('broadcast-')) {
      return 'Бөөн имэйл (Marketing)';
    }
    const map: Record<string, string> = {
      'new-product': 'Шинэ бүтээгдэхүүн',
      welcome: 'Тавтай морил',
      reactivation: 'Эргэн идэвхжүүлэлт',
      'coupon-expiring': 'Купон дуусах',
    };
    return map[key] ?? key;
  }
}
