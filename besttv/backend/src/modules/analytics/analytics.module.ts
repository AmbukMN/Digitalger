import { Module } from '@nestjs/common';
import { Body, Controller, Get, Injectable, Patch, Query, UseGuards } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { MetaCapiService } from './meta-capi.service';
import { PaymentStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { InsightsService } from './insights.service';
import { StorageUsageService } from './storage-usage.service';
import { ContentHealthService } from './content-health.service';

/**
 * Хянах самбарын хугацааны сонголт.
 * ⚠️ InsightsService-ийн RANGE_DAYS-тэй ЯГ ИЖИЛ байх ёстой — нэг сонголтоор
 * хоёр эх сурвалжийг зэрэг шүүдэг тул зөрвөл тоо таарахгүй.
 */
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
      providerBreakdown,
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
      /**
       * ⚠️⚠️ ОРЛОГО — ХЭТЭВЧ ЦЭНЭГЛЭЛТ (топап) ХАСНА.
       *
       * БОДИТ АСУУДАЛ: хэрэглэгч 13,000₮ хэтэвчээ цэнэглээд (PAID),
       * дараа тэр 13,000₮-өөр багц авбал (PAID) хоёулаа тоологдож
       * орлого 26,000₮ гэж ХОЁР ДАХИН харагдана. Гэтэл жинхэнэ орсон
       * мөнгө 13,000₮.
       *
       * Топап нь МӨНГӨ ШИЛЖҮҮЛЭГ (орлого биш) — жинхэнэ орлого нь
       * зарцуулалт (багц/кино/түрээс). Тиймээс бүх revenue-гээс
       * `isWalletTopup=false` шүүнэ. Топапыг тусад нь харуулж болно.
       */
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID, isWalletTopup: false },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID, isWalletTopup: false, paidAt: { gte: from } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.PAID,
          isWalletTopup: false,
          paidAt: { gte: prevFrom, lt: from },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.count({
        where: { status: PaymentStatus.PAID, isWalletTopup: false, paidAt: { gte: from } },
      }),
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
          /* ⚠️ Ширхэгээр түрээслэсэн киноны нэр — эс бөгөөс дашбоардын
             сүүлийн төлбөрт «—» гэж хоосон гарна */
          rentalTitle: { select: { title: true } },
        },
      }),
      this.prisma.title.findMany({
        orderBy: { views: 'desc' },
        take: 10,
        select: { id: true, title: true, type: true, views: true, rating: true },
      }),
      this.dailySeries(from, days),
      this.planBreakdown(now),
      this.providerBreakdown(from),
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
      /** Төлбөрийн аргаар задаргаа (QPay/карт/данс/хэтэвч) */
      providerBreakdown,
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
        /* ⚠️ Топап хасна — орлогын графикт давхар тоологдохгүй (dashboard-той нийцтэй) */
        where: { status: PaymentStatus.PAID, isWalletTopup: false, paidAt: { gte: from } },
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
  /**
   * ⚠️ Багц бүрийн ГҮЙЦЭТГЭЛ — олон үзүүлэлт (админ хүсэлт):
   *   • activeCount   — одоо идэвхтэй захиалагч
   *   • totalSold     — нийт хэдэн удаа зарагдсан (бүх PAID)
   *   • revenue       — тухайн багцаар олсон нийт орлого (₮)
   *   • expiredCount  — дууссан захиалга (сунгах боломжит хэрэглэгч)
   * ⚠️ Орлогод топап тоологдохгүй (planId-тэй PAID л).
   */
  /**
   * ТӨЛБӨРИЙН АРГААР задаргаа — сонгосон мужид (орлогод тоологдох
   * төлбөрүүд: топап ХАСНА, эс бөгөөс давхар тоологдоно).
   *
   * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: «карт нэмсэн нь үр дүнгээ өгч байна уу»,
   * «QPay хэдэн хувь вэ» гэдгийг админ хардаг байх ёстой. Bonum-ын
   * шимтгэл QPay-ээс өөр тул зардлын тооцоонд ч хэрэгтэй.
   *
   * ⚠️ Аргыг DB-д тусад нь хадгалдаггүй (нэхэмжлэлийн ID-аар дедукц
   * хийдэг) тул SQL-ээр биш, groupBy-гүй энгийн count-аар тооцно.
   */
  private async providerBreakdown(from: Date) {
    const base = {
      status: PaymentStatus.PAID,
      isWalletTopup: false,
      paidAt: { gte: from },
    } as const;

    const [qpay, card, bank, wallet] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { ...base, qpayInvoiceId: { not: null } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: { ...base, bonumInvoiceId: { not: null } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: { ...base, bankReference: { not: null } },
        _sum: { amount: true },
        _count: true,
      }),
      /* ⚠️ Хэтэвчээр төлсөн = гурвуулаа NULL. Энэ нь ШИНЭ мөнгө БИШ
         (өмнө нь цэнэглэсэн) — админд ялгаж харуулах нь чухал. */
      this.prisma.payment.aggregate({
        where: { ...base, qpayInvoiceId: null, bonumInvoiceId: null, bankReference: null },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return [
      { provider: 'QPAY' as const, label: 'QPay', amount: qpay._sum.amount ?? 0, count: qpay._count },
      { provider: 'CARD' as const, label: 'Карт', amount: card._sum.amount ?? 0, count: card._count },
      { provider: 'BANK' as const, label: 'Данс', amount: bank._sum.amount ?? 0, count: bank._count },
      {
        provider: 'WALLET' as const,
        label: 'Хэтэвч',
        amount: wallet._sum.amount ?? 0,
        count: wallet._count,
      },
    ];
  }

  private async planBreakdown(now: Date) {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
      select: {
        id: true,
        name: true,
        price: true,
        isVip: true,
        durationDays: true,
        _count: {
          select: {
            subscriptions: { where: { expiresAt: { gt: now } } },
          },
        },
      },
    });

    // Багц бүрийн борлуулалт + орлого (нэг query, groupBy)
    const sales = await this.prisma.payment.groupBy({
      by: ['planId'],
      where: { status: PaymentStatus.PAID, isWalletTopup: false, planId: { not: null } },
      _sum: { amount: true },
      _count: { _all: true },
    });
    const byPlan = new Map(
      sales.map((s) => [s.planId, { revenue: s._sum.amount ?? 0, sold: s._count._all }]),
    );

    // Дууссан захиалга (сунгах боломжит) багц бүрээр
    const expired = await this.prisma.subscription.groupBy({
      by: ['planId'],
      where: { expiresAt: { lte: now } },
      _count: { _all: true },
    });
    const expByPlan = new Map(expired.map((e) => [e.planId, e._count._all]));

    return plans.map((p) => {
      const s = byPlan.get(p.id);
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        isVip: p.isVip,
        durationDays: p.durationDays,
        activeCount: p._count.subscriptions,
        totalSold: s?.sold ?? 0,
        revenue: s?.revenue ?? 0,
        expiredCount: expByPlan.get(p.id) ?? 0,
      };
    });
  }
}

/**
 * ⚠️ Ханшийн хязгаар — буруу утга нь сая төгрөгийн ХУДАЛ тоо
 * гаргах ёсгүй. 500-20,000 нь бодит ханшийг бүрэн хамарна.
 */
class UsdRateDto {
  @IsInt()
  @Min(500)
  @Max(20000)
  usdMnt: number;
}

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AnalyticsController {
  constructor(
    private readonly svc: AnalyticsService,
    private readonly insights: InsightsService,
    private readonly storageUsage: StorageUsageService,
    private readonly health: ContentHealthService,
  ) {}

  /** Хэрэглэгчийн зан төлөвийн шинжилгээ (хандалт, юүлүүр, хайлт) */
  @Get('insights')
  insightsOverview(@Query('range') range?: string) {
    return this.insights.overview(range ?? '30d');
  }

  /**
   * Контентын гүйцэтгэл — хамгийн их түрээслэгдсэн/үзэгдсэн кино,
   * жанр бүрийн орлого. Админд «аль кино зарагдаж байна» гэдгийг харуулна.
   */
  @Get('content-insights')
  contentInsights() {
    return this.insights.contentInsights();
  }

  @Get('dashboard')
  dashboard(@Query('range') range?: string) {
    return this.svc.dashboard(range ?? '30d');
  }

  /**
   * Cloudflare R2 зай эзлэлт — кино тус бүр хэдэн GB эзэлж байгаа.
   * ⚠️ 10 минут кэштэй (бүрэн скан R2-д үнэтэй). `?refresh=1` — албадан.
   */
  @Get('storage')
  storage(@Query('refresh') refresh?: string) {
    return this.storageUsage.usage(refresh === '1' || refresh === 'true');
  }

  /**
   * USD→MNT ханш солих (R2 төлбөрийг төгрөгөөр харуулахад).
   *
   * ⚠️ Ханш байнга хөдөлдөг тул кодод хатуу бичихгүй. Тусдаа
   * тохиргооны хуудас байхгүй тул R2 картаас шууд засна — тэнд л
   * ашиглагддаг.
   */
  @Patch('storage/rate')
  setRate(@Body() dto: UsdRateDto) {
    return this.storageUsage.setUsdMntRate(dto.usdMnt);
  }

  /**
   * Контентын эрүүл мэнд — «мөнгө авчихаад үзүүлэх юмгүй» байдлыг илрүүлнэ.
   * ⚠️ Зөвхөн тайлан — юу ч автоматаар өөрчлөхгүй.
   */
  @Get('health')
  contentHealth() {
    return this.health.check();
  }
}

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    InsightsService,
    StorageUsageService,
    ContentHealthService,
    MetaCapiService,
  ],
  /* ⚠️ PaymentsModule нь Purchase илгээхэд ашиглана */
  exports: [MetaCapiService],
})
export class AnalyticsModule {}
