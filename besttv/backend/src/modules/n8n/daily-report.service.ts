import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { N8nService } from './n8n.service';
import { ubDayRange } from '../../common/ub-date';
import { forEachSite } from '../../common/site/site-cron';
import { currentSite } from '../../common/site/site-context';

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
   * ⚠️⚠️ 00:00 Улаанбаатарын цагаар — ӨНГӨРСӨН өдрийн тайлан.
   *
   * БОДИТ АЛДАА: өмнө нь 23:01-д илгээдэг байсан атлаа тайлан нь
   * `ubDayRange()` буюу 00:00–23:59:59 хамардаг байв. Улмаас өдрийн
   * СҮҮЛИЙН ~59 МИНУТЫН БОРЛУУЛАЛТ тайланд огт орохгүй, орлого
   * дутуу харагдаж байв (хэрэглэгч илрүүлэв).
   *
   * Одоо шинэ өдрийн эхэнд ажиллаж `dayRange(-1)`-ээр ӨМНӨХ өдрийг
   * БҮТНЭЭР хамруулна — нэг ч гүйлгээ алдагдахгүй.
   *
   * ⚠️ ЯГ 00:00:00 — хэрэглэгчийн сонголт. Тайлангийн муж нь
   * `< 00:00:00` тул яг тэр агшинд бичигдэж буй гүйлгээ (QPay
   * callback) АЛДАГДАХГҮЙ — маргаашийн тайланд орно.
   *
   * ⚠️ Давхцал шалгасан: DigitalGer 23:00, auto-renew 01:00,
   * errors cleanup 04:00 — аль нь ч давхцахгүй.
   */
  /**
   * ⚠️⚠️ САЙТ БҮРД ТУСДАА ТАЙЛАН.
   *
   * Хоёр сайтын борлуулалтыг нэг тайланд нийлүүлбэл аль нь хэдэн
   * төгрөг олсныг мэдэхгүй. Тиймээс сайт бүрд ТУСАД НЬ илгээнэ.
   */
  @Cron('0 0 * * *', { timeZone: 'Asia/Ulaanbaatar' })
  async send(): Promise<void> {
    await forEachSite('daily-report', () => this.sendForCurrentSite());
  }

  private async sendForCurrentSite(): Promise<void> {
    /**
     * ⚠️⚠️ REDIS LOCK ЗААВАЛ — backend болон worker хоёул ижил код
     * ажиллуулдаг тул түгжээгүй бол тайлан ХОЁР УДАА илгээгдэнэ.
     */
    /* ⚠️ Түлхүүр нь ТАЙЛАНГИЙН өдрөөр (өчигдөр) — өнөөдрөөр биш.
       Эс бөгөөс гар аргаар дахин ажиллуулахад түлхүүр зөрж, ижил
       тайлан ХОЁР УДАА илгээгдэнэ.
       ⚠️ САЙТ ч түлхүүрт орно — эс бөгөөс BestTV илгээсний дараа
       BestFilm «аль хэдийн илгээсэн» гэж алгасна. */
    const key = `cron:daily-report:${currentSite()}:${this.dayKey(-1)}`;
    const got = await this.redis.set(key, '1', 'EX', 3600, 'NX').catch(() => null);
    if (!got) {
      this.logger.log(`Өдрийн тайлан (${currentSite()}): өөр process илгээсэн — алгасав`);
      return;
    }

    try {
      await this.build();
    } catch (e) {
      this.logger.error(`Өдрийн тайлан бэлтгэхэд алдаа: ${String(e)}`);
    }
  }

  /**
   * Улаанбаатарын өдрийн түлхүүр (YYYY-MM-DD).
   *
   * ⚠️ `offsetDays: -1` нь ӨМНӨХ өдөр — тайлан шинэ өдрийн эхэнд
   * ажиллаж өчигдрийг хамардаг тул түгжээ ч тэр өдрөөр байх ёстой.
   */
  private dayKey(offsetDays = 0): string {
    const d = new Date(Date.now() + offsetDays * 86_400_000);
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
  }

  /**
   * ⚠️⚠️ УЛААНБААТАРЫН ӨДРИЙН ХИЛ.
   *
   * Сервер нь UTC-д ажилладаг тул `setHours(0,0,0,0)` нь UTC шөнө
   * дундыг өгнө — Монголд 08:00. Тэр 8 цагийн зөрүү нь орлогыг
   * буруу өдөрт хамааруулна.
   */
  /**
   * WARN Single source: common/ub-date.ts (ubDayRange).
   * Duplicating this math is what produced the 8h-off report bug.
   */
  private dayRange(offsetDays = 0): { start: Date; end: Date } {
    return ubDayRange(undefined, offsetDays);
  }

  private async build(): Promise<void> {
    /* ⚠️⚠️ Тайлан нь ӨЧИГДРИЙН БҮТЭН өдрийг хамарна (00:00–23:59:59).
       Харьцуулалт нь түүнээс өмнөх өдөр. */
    const { start, end } = this.dayRange(-1);
    const prev = this.dayRange(-2);

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
          /* ⚠️ Топап хасна — өнөөдрийн орлоготой (доор мөн топапгүй) ижил суурьтай харьцуулна */
          where: { status: 'PAID', isWalletTopup: false, paidAt: { gte: prev.start, lt: prev.end } },
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
      /* ⚠️⚠️ ӨЧИГДРИЙН огноо — тайлан 00:05-д ажилладаг тул
         `dayKey()` (өнөөдөр) бол дата ба гарчиг ЗӨРНӨ. */
      date: this.dayKey(-1),
      /* ⚠️ Орлого = багц + түрээс (ТОПАП ХАСНА — давхар тооцоо болно).
         Топапыг тусдаа `topupRevenue`-д мэдээлэл болгож харуулна. */
      totalRevenue: planRevenue + rentalRevenue,
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
      `Өдрийн тайлан илгээв: ${planRevenue + rentalRevenue}₮ орлого (+${topupRevenue}₮ топап) · ${planCount} багц · ${rentalCount} түрээс`,
    );
  }
}
