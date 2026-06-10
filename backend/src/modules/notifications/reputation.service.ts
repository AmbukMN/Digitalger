import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { N8nService } from '../n8n/n8n.service';

// ⚠️ AWS SES reputation босго — энэ хэмжээнээс хэтэрвэл AWS account-ыг түр зогсоох
// (sending pause) эрсдэлтэй:
//   - bounce rate    > 5%   → DANGER (account suspend эрсдэл)
//   - complaint rate > 0.1% → DANGER (spam гомдол хэт их)
// AWS өөрөө: bounce >10% / complaint >0.5% бол шууд review/suspend.
export const BOUNCE_RATE_DANGER = 0.05; // 5%
export const COMPLAINT_RATE_DANGER = 0.001; // 0.1%
// Анхааруулах (warning) босго — danger-аас өмнө сэрэмжлүүлнэ.
export const BOUNCE_RATE_WARN = 0.03; // 3%
export const COMPLAINT_RATE_WARN = 0.0005; // 0.05%

export interface ReputationWindow {
  sent: number; // delivered/sent/bounced/complained — бодит илгээгдсэн (suppressed/failed хасна)
  bounced: number;
  complained: number;
  bounceRate: number;
  complaintRate: number;
  status: 'ok' | 'warning' | 'danger';
}

export interface ReputationStats {
  last24h: ReputationWindow;
  last7d: ReputationWindow;
  thresholds: {
    bounceDanger: number;
    complaintDanger: number;
    bounceWarn: number;
    complaintWarn: number;
  };
}

/**
 * SES reputation monitor — bounce/complaint rate-ийг EmailLog-оос тооцож,
 * danger босго хэтэрвэл alert (n8n /webhook/alert → Telegram) илгээнэ.
 *
 * EmailLog status: sent | delivered | bounced | complained | failed | suppressed.
 * Rate тооцоход бодит SES-д хүрсэн имэйлийг л (sent+delivered+bounced+complained)
 * хуваарь болгоно — failed/suppressed (SES-д хүрээгүй) тоонд оруулахгүй.
 */
@Injectable()
export class ReputationService implements OnModuleDestroy {
  private readonly logger = new Logger(ReputationService.name);
  private readonly redis: Redis;
  // Давтан alert-аас сэргийлэх flag (нэг л удаа alert, сэргэвэл reset).
  private readonly alertFlagKey = 'reputation:alerting';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly n8n: N8nService,
  ) {
    const redisUrl =
      this.config.get<string>('redisUrl') ??
      this.config.get<string>('REDIS_URL') ??
      'redis://localhost:6379';
    this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => {});
  }

  // ─── Нэг цонхны (window) rate тооцох ──────────────────────────────────────────
  private async computeWindow(since: Date): Promise<ReputationWindow> {
    // SES-д хүрсэн имэйлүүд (failed/suppressed хасна) — bounce/complaint хуваарь.
    const [delivered, bounced, complained] = await Promise.all([
      this.prisma.emailLog.count({
        where: { createdAt: { gte: since }, status: { in: ['sent', 'delivered'] } },
      }),
      this.prisma.emailLog.count({
        where: { createdAt: { gte: since }, status: 'bounced' },
      }),
      this.prisma.emailLog.count({
        where: { createdAt: { gte: since }, status: 'complained' },
      }),
    ]);

    const sent = delivered + bounced + complained;
    const bounceRate = sent > 0 ? bounced / sent : 0;
    const complaintRate = sent > 0 ? complained / sent : 0;

    let status: ReputationWindow['status'] = 'ok';
    if (bounceRate >= BOUNCE_RATE_DANGER || complaintRate >= COMPLAINT_RATE_DANGER) {
      status = 'danger';
    } else if (bounceRate >= BOUNCE_RATE_WARN || complaintRate >= COMPLAINT_RATE_WARN) {
      status = 'warning';
    }

    return { sent, bounced, complained, bounceRate, complaintRate, status };
  }

  /**
   * Admin dashboard-д харуулах reputation статистик (24ц + 7хоног).
   * bounceRate/complaintRate (0..1 бутархай), status (ok|warning|danger).
   */
  async getReputationStats(): Promise<ReputationStats> {
    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000);
    const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [last24h, last7d] = await Promise.all([
      this.computeWindow(since24h),
      this.computeWindow(since7d),
    ]);

    return {
      last24h,
      last7d,
      thresholds: {
        bounceDanger: BOUNCE_RATE_DANGER,
        complaintDanger: COMPLAINT_RATE_DANGER,
        bounceWarn: BOUNCE_RATE_WARN,
        complaintWarn: COMPLAINT_RATE_WARN,
      },
    };
  }

  // ─── Cron: цаг тутам reputation шалгаж danger бол alert ────────────────────────
  // ⚠️ Bounce/complaint удаан хуримтлагддаг тул цаг тутам хангалттай (хэт олон
  // удаа шалгах шаардлагагүй). 24ц цонхоор danger илрвэл alert.
  @Cron(CronExpression.EVERY_HOUR, { timeZone: 'Asia/Ulaanbaatar' })
  async checkReputation(): Promise<void> {
    let stats: ReputationStats;
    try {
      stats = await this.getReputationStats();
    } catch (err: any) {
      this.logger.warn(`Reputation шалгахад алдаа: ${err?.message ?? err}`);
      return;
    }

    const w = stats.last24h;
    // Хэт цөөн имэйл (< 50) дээр rate утгагүй (нэг bounce ч 5% давна) — алгасна.
    const MIN_SAMPLE = 50;
    if (w.sent < MIN_SAMPLE) {
      this.logger.debug?.(`Reputation: дээж бага (${w.sent} имэйл) — alert шалгахгүй`);
      return;
    }

    if (w.status === 'danger') {
      await this.handleDanger(w);
    } else {
      await this.handleRecovered(w);
    }
  }

  private async handleDanger(w: ReputationWindow): Promise<void> {
    const already = await this.redis.get(this.alertFlagKey).catch(() => null);
    if (already) {
      this.logger.warn('Reputation danger — alert аль хэдийн явсан, алгасав');
      return;
    }
    // Flag (6 цаг) — сэргэвэл reset. Давтан Telegram спам болгохгүй.
    await this.redis.set(this.alertFlagKey, '1', 'EX', 6 * 3600).catch(() => {});

    const bouncePct = (w.bounceRate * 100).toFixed(2);
    const complaintPct = (w.complaintRate * 100).toFixed(3);
    await this.n8n
      .emitAlert({
        level: 'critical',
        title: 'SES reputation АЮУЛТАЙ',
        message:
          `Сүүлийн 24ц: bounce ${bouncePct}% (${w.bounced}/${w.sent}), ` +
          `complaint ${complaintPct}% (${w.complained}/${w.sent}). ` +
          `AWS SES account түр зогсох эрсдэлтэй! Bulk имэйлийг зогсоож, хаягийн чанарыг шалгана уу.`,
        source: 'ses-reputation',
      })
      .catch(() => {});

    this.logger.error(
      `Reputation DANGER alert илгээв — bounce ${bouncePct}%, complaint ${complaintPct}%`,
    );
  }

  private async handleRecovered(w: ReputationWindow): Promise<void> {
    const wasAlerting = await this.redis.get(this.alertFlagKey).catch(() => null);
    if (!wasAlerting) return;
    await this.redis.del(this.alertFlagKey).catch(() => {});

    await this.n8n
      .emitAlert({
        level: 'warning',
        title: 'SES reputation сэргэлээ',
        message:
          `Bounce/complaint rate хэвийн боллоо (bounce ${(w.bounceRate * 100).toFixed(2)}%, ` +
          `complaint ${(w.complaintRate * 100).toFixed(3)}%).`,
        source: 'ses-reputation',
      })
      .catch(() => {});

    this.logger.log('Reputation сэргэлээ — alert flag reset');
  }
}
