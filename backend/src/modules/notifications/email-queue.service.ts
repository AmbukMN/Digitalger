import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bull';
import Redis from 'ioredis';
import { EMAIL_QUEUE, EmailJobPayload } from './email-queue.types';

// Кампанит ажлын прогрессыг хадгалах Redis key prefix-үүд. Bulk имэйл queue-д
// нэмэгдэхэд "total", илгээгдэх/амжилтгүй бүрд "sent"/"failed" тоологдоно.
// Admin "N илгээгдсэн / M үлдсэн"-г эндээс уншина (EmailLog-оос хамаарахгүй).
const CAMPAIGN_TOTAL  = (c: string) => `email:campaign:${c}:total`;
const CAMPAIGN_SENT   = (c: string) => `email:campaign:${c}:sent`;
const CAMPAIGN_FAILED = (c: string) => `email:campaign:${c}:failed`;
const CAMPAIGN_TTL = 60 * 60 * 24 * 7; // 7 хоног хадгална

export interface CampaignProgress {
  campaign: string;
  total: number;
  sent: number;
  failed: number;
  remaining: number;
  done: boolean;
}

/**
 * BullMQ email queue PRODUCER. Bulk + automated имэйлийг background queue-д нэмнэ.
 *
 * - Durable: Redis-д хадгалагдана (restart-д амьд үлдэнэ).
 * - Rate limit: queue-ийн limiter (max 10/сек) SES 14/сек-ийг хэзээ ч давахгүй.
 * - Retry: транзиент алдаа (SES throttle/5xx) → attempts:3 exponential backoff.
 *   Permanent (4xx/suppression) → processor алдаа шиддэггүй тул retry хийгдэхгүй.
 *
 * ⚠️ Processor (EmailProcessor) нь зөвхөн WORKER container-д бүртгэгдэнэ. Энэ
 *    service нь зөвхөн producer (job нэмэх) — API + worker хоёуланд хэрэглэгдэнэ.
 */
@Injectable()
export class EmailQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailQueueService.name);
  private readonly redis: Redis;

  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<EmailJobPayload>,
    private readonly config: ConfigService,
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

  // Bull job-ийн нийтлэг тохиргоо — retry (transient) + амжилттай/амжилтгүй
  // болсон job-ийг автоматаар цэвэрлэнэ (Redis хэт томрохоос сэргийлнэ).
  private jobOpts() {
    return {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    };
  }

  /** Нэг имэйлийг queue-д нэмнэ (background). Шууд буцна (хэрэглэгч хүлээхгүй). */
  async enqueue(job: EmailJobPayload): Promise<void> {
    await this.queue.add(job, this.jobOpts());
  }

  /**
   * Олон имэйлийг (bulk/marketing) queue-д нэг нэгээр нэмнэ. Хэрэглэгч хүлээхгүй —
   * job-ууд background-д rate limit-тэйгээр явна.
   *
   * @returns queue-д нэмэгдсэн job-ийн тоо ({ queued, campaign }).
   */
  async enqueueBulk(
    jobs: EmailJobPayload[],
    campaign: string,
  ): Promise<{ queued: number; campaign: string }> {
    if (!jobs.length) return { queued: 0, campaign };

    // Кампанит ажлын тоолуурыг шинээр эхлүүлнэ (өмнөх ижил нэртэйг дарж бичнэ).
    await this.resetCampaign(campaign, jobs.length).catch(() => {});

    // Bull addBulk — нэг round-trip-аар бүх job-ийг нэмнэ (хурдан, durable).
    await this.queue.addBulk(
      jobs.map((data) => ({ data: { ...data, campaign }, opts: this.jobOpts() })),
    );

    this.logger.log(`Bulk имэйл queue-д нэмэв → ${jobs.length} job | campaign=${campaign}`);
    return { queued: jobs.length, campaign };
  }

  // ─── Кампанит ажлын прогресс (Redis тоолуур) ───────────────────────────────

  private async resetCampaign(campaign: string, total: number): Promise<void> {
    const pipe = this.redis.multi();
    pipe.set(CAMPAIGN_TOTAL(campaign), total, 'EX', CAMPAIGN_TTL);
    pipe.set(CAMPAIGN_SENT(campaign), 0, 'EX', CAMPAIGN_TTL);
    pipe.set(CAMPAIGN_FAILED(campaign), 0, 'EX', CAMPAIGN_TTL);
    await pipe.exec();
  }

  /** Processor дуудна — нэг имэйл амжилттай явсны дараа. */
  async markSent(campaign?: string): Promise<void> {
    if (!campaign) return;
    await this.redis.incr(CAMPAIGN_SENT(campaign)).catch(() => {});
    await this.redis.expire(CAMPAIGN_SENT(campaign), CAMPAIGN_TTL).catch(() => {});
  }

  /** Processor дуудна — нэг имэйл бүрэн амжилтгүй болсны дараа (retry дууссан). */
  async markFailed(campaign?: string): Promise<void> {
    if (!campaign) return;
    await this.redis.incr(CAMPAIGN_FAILED(campaign)).catch(() => {});
    await this.redis.expire(CAMPAIGN_FAILED(campaign), CAMPAIGN_TTL).catch(() => {});
  }

  /** Admin status endpoint — "N илгээгдсэн / M үлдсэн" харуулна. */
  async getCampaignProgress(campaign: string): Promise<CampaignProgress> {
    const [totalRaw, sentRaw, failedRaw] = await Promise.all([
      this.redis.get(CAMPAIGN_TOTAL(campaign)).catch(() => null),
      this.redis.get(CAMPAIGN_SENT(campaign)).catch(() => null),
      this.redis.get(CAMPAIGN_FAILED(campaign)).catch(() => null),
    ]);
    const total = totalRaw ? parseInt(totalRaw, 10) : 0;
    const sent = sentRaw ? parseInt(sentRaw, 10) : 0;
    const failed = failedRaw ? parseInt(failedRaw, 10) : 0;
    const processed = sent + failed;
    return {
      campaign,
      total,
      sent,
      failed,
      remaining: Math.max(0, total - processed),
      done: total > 0 && processed >= total,
    };
  }
}
