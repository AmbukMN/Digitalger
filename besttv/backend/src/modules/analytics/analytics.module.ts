import { Module } from '@nestjs/common';
import { Controller, Get, Injectable, Query, UseGuards } from '@nestjs/common';
import { PaymentStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { InsightsService } from './insights.service';

/**
 * Хянах самбарын хугацааны сонголт.
 * ⚠️ InsightsService-ийн RANGE_DAYS-тэй ЯГ ИЖИЛ байх ёстой — нэг сонголтоор
 * хоёр эх сурвалжийг зэрэг шүүдэг тул зөрвөл тоо таарахгүй.
 */
const RANGE_DAYS: Record<string, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '365d': 365,
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Сонгосон мужийн эхлэл + өмнөх ижил урттай мужийн эхлэл (харьцуулалтад) */
  private bounds(range: string) {
    const days = RANGE_DAYS[range] ?? 30;
    const now = new Date();
    const from = new Date(now.getTime() - days * 86400_000);
    // ⚠️ Өмнөх ижил урттай муж — өсөлт/бууралтын хувь тооцоход
    const prevFrom = new Date(from.getTime() - days * 86400_000);
    return { days, now, from, prevFrom };
  }

  /** Өсөлтийн хувь (өмнөх муж 0 бол null — "∞%" гаргахгүй) */
  private growth(cur: number, prev: number): number | null {
    if (!prev) return cur > 0 ? null : 0;
    return Math.round(((cur - prev) / prev) * 100);
  }

  /**
   * Хянах самбар.
   *
   * ⚠️ Бүх тоо СОНГОСОН МУЖИД харьяалагдана + өмнөх ижил мужтай харьцуулж
   * өсөлтийн хувь буцаана. Өмнө нь зөвхөн "сүүлийн 30 хоног" тогтмол байсан.
   */
  async dashboard(range = '30d') {
    const { days, now, from, prevFrom } = this.bounds(range);

    const [
      totalUsers,
      newUsers,
      prevNewUsers,
      activeSubscriptions,
      newSubscriptions,
      prevNewSubscriptions,
      totalTitles,
      totalMovies,
      totalSeries,
      revenueAll,
      revenueRange,
      prevRevenueRange,
      paidCountRange,
      rentalsRange,
      recentPayments,
      topTitles,
      series,
      planBreakdown,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: from } } }),
      this.prisma.user.count({ where: { createdAt: { gte: prevFrom, lt: from } } }),
      this.prisma.subscription.count({ where: { expiresAt: { gt: now } } }),
      this.prisma.subscription.count({ where: { createdAt: { gte: from } } }),
      this.prisma.subscription.count({ where: { createdAt: { gte: prevFrom, lt: from } } }),
      this.prisma.title.count(),
      this.prisma.title.count({ where: { type: 'MOVIE' } }),
      this.prisma.title.count({ where: { type: 'SERIES' } }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID, paidAt: { gte: from } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID, paidAt: { gte: prevFrom, lt: from } },
        _sum: { amount: true },
      }),
      this.prisma.payment.count({ where: { status: PaymentStatus.PAID, paidAt: { gte: from } } }),
      this.prisma.rental.count({ where: { createdAt: { gte: from } } }),
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.PAID },
        orderBy: { paidAt: 'desc' },
        take: 10,
        select: {
          id: true,
          amount: true,
          paidAt: true,
          isWalletTopup: true,
          user: { select: { email: true, name: true } },
          plan: { select: { name: true } },
        },
      }),
      this.prisma.title.findMany({
        orderBy: { views: 'desc' },
        take: 10,
        select: { id: true, title: true, type: true, views: true, rating: true },
      }),
      this.dailySeries(from, days),
      this.planBreakdown(now),
    ]);

    const revenue = revenueRange._sum.amount ?? 0;
    const prevRevenue = prevRevenueRange._sum.amount ?? 0;

    return {
      range,
      days,
      totalUsers,
      newUsers,
      newUsersGrowth: this.growth(newUsers, prevNewUsers),
      activeSubscriptions,
      newSubscriptions,
      newSubscriptionsGrowth: this.growth(newSubscriptions, prevNewSubscriptions),
      totalTitles,
      totalMovies,
      totalSeries,
      totalRevenue: revenueAll._sum.amount ?? 0,
      revenue,
      revenueGrowth: this.growth(revenue, prevRevenue),
      paidCount: paidCountRange,
      /** Дундаж чек — орлого / төлөгдсөн гүйлгээ */
      avgOrder: paidCountRange ? Math.round(revenue / paidCountRange) : 0,
      rentals: rentalsRange,
      recentPayments,
      topTitles,
      /** Өдөр тутмын орлого/бүртгэл — график зурахад */
      series,
      /** Багц бүрийн идэвхтэй захиалагчийн тоо */
      planBreakdown,
      // Хуучин UI-тай нийцтэй байх (backward-compat)
      newUsersMonth: newUsers,
      revenueLast30Days: revenue,
    };
  }

  /**
   * Өдөр тутмын цуваа (орлого + шинэ хэрэглэгч).
   * ⚠️ Хоосон өдрийг ч 0-ээр дүүргэнэ — эс бөгөөс график тасалдана.
   */
  private async dailySeries(from: Date, days: number) {
    const [payments, users] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.PAID, paidAt: { gte: from } },
        select: { paidAt: true, amount: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: from } },
        select: { createdAt: true },
      }),
    ]);

    const key = (d: Date) => d.toISOString().slice(0, 10);
    const revenueMap = new Map<string, number>();
    const userMap = new Map<string, number>();

    for (const p of payments) {
      if (!p.paidAt) continue;
      const k = key(p.paidAt);
      revenueMap.set(k, (revenueMap.get(k) ?? 0) + p.amount);
    }
    for (const u of users) {
      const k = key(u.createdAt);
      userMap.set(k, (userMap.get(k) ?? 0) + 1);
    }

    const out: { date: string; revenue: number; users: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000);
      const k = key(d);
      out.push({ date: k, revenue: revenueMap.get(k) ?? 0, users: userMap.get(k) ?? 0 });
    }

    // ⚠️ 60-аас олон өдөр бол 7 хоногоор бүлэглэнэ — эс бөгөөс график хэт нягт
    if (out.length <= 60) return out;
    const grouped: typeof out = [];
    for (let i = 0; i < out.length; i += 7) {
      const chunk = out.slice(i, i + 7);
      grouped.push({
        date: chunk[0].date,
        revenue: chunk.reduce((s, c) => s + c.revenue, 0),
        users: chunk.reduce((s, c) => s + c.users, 0),
      });
    }
    return grouped;
  }

  /** Багц бүрийн идэвхтэй захиалагч — аль багц эрэлттэйг харна */
  private async planBreakdown(now: Date) {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
      select: {
        id: true,
        name: true,
        price: true,
        isVip: true,
        _count: { select: { subscriptions: { where: { expiresAt: { gt: now } } } } },
      },
    });
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      isVip: p.isVip,
      activeCount: p._count.subscriptions,
    }));
  }
}

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AnalyticsController {
  constructor(
    private readonly svc: AnalyticsService,
    private readonly insights: InsightsService,
  ) {}

  /** Хэрэглэгчийн зан төлөвийн шинжилгээ (хандалт, юүлүүр, хайлт) */
  @Get('insights')
  insightsOverview(@Query('range') range?: string) {
    return this.insights.overview(range ?? '30d');
  }

  @Get('dashboard')
  dashboard(@Query('range') range?: string) {
    return this.svc.dashboard(range ?? '30d');
  }
}

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, InsightsService],
})
export class AnalyticsModule {}
