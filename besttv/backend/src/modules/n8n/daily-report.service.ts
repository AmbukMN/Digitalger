import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { N8nService } from './n8n.service';

/**
 * ӨДРИЙН ТАЙЛАН → Telegram.
 *
 * ⚠️ Зөвхөн ОРЛОГО (зарлага БИШ) — BestTV-д зардал бүртгэдэг хүснэгт
 * байхгүй тул «цэвэр ашиг» тооцох боломжгүй. Ирээдүйд Expense модел
 * нэмбэл энд нэмнэ.
 */
@Injectable()
export class DailyReportService implements OnModuleDestroy {
  private readonly logger = new Logger(DailyReportService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly n8n: N8nService,
    private readonly config: ConfigService,
  ) {
    const url = this.config.get<string>('redisUrl') ?? 'redis://localhost:6379';
    this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => null);
  }

  /**
   * ⚠️ 23:01 Улаанбаатарын цагаар — өдөр дуусахын өмнөхөн.
   *
   * Шөнө дунд (00:00) бол «өчигдрийн» тайлан болж, админ өглөө
   * сэрээд хуучирсан мэдээлэл уншина.
   *
   * ⚠️⚠️ 23:00 БИШ 23:01 — DigitalGer-ийн тайлан ЯГ 23:00-д ирдэг.
   * Хоёр тайлан нэг мөчид ирвэл Telegram дээр дараалж гарч, аль нь
   * аль сайтынх болох нь эргэлзээтэй болно. Нэг минут зөрүүлснээр
   * тодорхой ялгарна.
   */
  @Cron('1 23 * * *', { timeZone: 'Asia/Ulaanbaatar' })
  async send(): Promise<void> {
    /**
     * ⚠️⚠️ REDIS LOCK ЗААВАЛ — backend болон worker хоёул ижил код
     * ажиллуулдаг тул түгжээгүй бол тайлан ХОЁР УДАА илгээгдэнэ.
     */
    const key = `cron:besttv-daily-report:${this.dayKey()}`;
    const got = await this.redis.set(key, '1', 'EX', 3600, 'NX').catch(() => null);
    if (!got) {
      this.logger.log('Өдрийн тайлан: өөр process илгээсэн — алгасав');
      return;
    }

    try {
      await this.build();
    } catch (e) {
      this.logger.error(`Өдрийн тайлан бэлтгэхэд алдаа: ${String(e)}`);
    }
  }

  /** Улаанбаатарын өдрийн түлхүүр (YYYY-MM-DD) */
  private dayKey(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
  }

  /**
   * ⚠️⚠️ УЛААНБААТАРЫН ӨДРИЙН ХИЛ.
   *
   * Сервер нь UTC-д ажилладаг тул `setHours(0,0,0,0)` нь UTC шөнө
   * дундыг өгнө — Монголд 08:00. Тэр 8 цагийн зөрүү нь орлогыг
   * буруу өдөрт хамааруулна.
   */
  private dayRange(offsetDays = 0): { start: Date; end: Date } {
    const now = new Date();
    const ubToday = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Ulaanbaatar' }),
    );
    ubToday.setHours(0, 0, 0, 0);
    ubToday.setDate(ubToday.getDate() + offsetDays);

    /* UB нь UTC+8 — локал өдрийн эхлэлээс 8 цаг хасаж UTC болгоно */
    const start = new Date(ubToday.getTime() - 8 * 3600_000);
    const end = new Date(start.getTime() + 24 * 3600_000);
    return { start, end };
  }

  private async build(): Promise<void> {
    const { start, end } = this.dayRange();
    const prev = this.dayRange(-1);

    const [payments, prevPayments, newUsers, views, activeUsers, pendingBank] =
      await Promise.all([
        this.prisma.payment.findMany({
          where: { status: 'PAID', paidAt: { gte: start, lt: end } },
          select: {
            amount: true,
            isWalletTopup: true,
            planId: true,
            rentalTitleId: true,
            plan: { select: { name: true } },
          },
        }),
        this.prisma.payment.aggregate({
          where: { status: 'PAID', paidAt: { gte: prev.start, lt: prev.end } },
          _sum: { amount: true },
        }),
        this.prisma.user.count({ where: { createdAt: { gte: start, lt: end } } }),
        this.prisma.titleEvent.count({
          where: { type: 'play', createdAt: { gte: start, lt: end } },
        }),
        /* ⚠️ `distinct` биш `groupBy` — Prisma-д count+distinct
           хослуулах шууд арга байхгүй */
        this.prisma.watchProgress
          .groupBy({
            by: ['userId'],
            where: { updatedAt: { gte: start, lt: end } },
          })
          .then((r) => r.length),
        this.prisma.payment.count({
          where: { status: 'PENDING', bankReference: { not: null } },
        }),
      ]);

    let planRevenue = 0;
    let rentalRevenue = 0;
    let topupRevenue = 0;
    let planCount = 0;
    let rentalCount = 0;
    const planTally = new Map<string, number>();

    for (const p of payments) {
      if (p.isWalletTopup) {
        topupRevenue += p.amount;
      } else if (p.rentalTitleId) {
        rentalRevenue += p.amount;
        rentalCount++;
      } else if (p.planId) {
        planRevenue += p.amount;
        planCount++;
        const n = p.plan?.name ?? 'Тодорхойгүй';
        planTally.set(n, (planTally.get(n) ?? 0) + 1);
      }
    }

    const topPlanEntry = [...planTally.entries()].sort((a, b) => b[1] - a[1])[0];

    /* Хамгийн их үзэгдсэн кино */
    const topViews = await this.prisma.titleEvent.groupBy({
      by: ['titleId'],
      where: { type: 'play', createdAt: { gte: start, lt: end } },
      _count: { titleId: true },
      orderBy: { _count: { titleId: 'desc' } },
      take: 1,
    });
    let topTitle: { name: string; views: number } | null = null;
    if (topViews[0]) {
      const t = await this.prisma.title.findUnique({
        where: { id: topViews[0].titleId },
        select: { title: true },
      });
      if (t) topTitle = { name: t.title, views: topViews[0]._count.titleId };
    }

    this.n8n.emitDailyReport({
      date: this.dayKey(),
      totalRevenue: planRevenue + rentalRevenue + topupRevenue,
      planRevenue,
      rentalRevenue,
      topupRevenue,
      planCount,
      rentalCount,
      prevRevenue: prevPayments._sum.amount ?? 0,
      newUserCount: newUsers,
      viewCount: views,
      activeUserCount: activeUsers,
      topPlan: topPlanEntry ? { name: topPlanEntry[0], count: topPlanEntry[1] } : null,
      topTitle,
      pendingBankCount: pendingBank,
    });

    this.logger.log(
      `Өдрийн тайлан илгээв: ${planRevenue + rentalRevenue + topupRevenue}₮ · ${planCount} багц · ${rentalCount} түрээс`,
    );
  }
}
