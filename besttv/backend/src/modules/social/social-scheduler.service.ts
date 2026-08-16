import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, SocialPostStatus, SocialTargetStatus } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { SocialPublisherService } from './social-publisher.service';
import { SocialService } from './social.service';

/**
 * ⚠️⚠️ ХУВААРИЙН CRON — минут тутам.
 *
 * ЯАГААД BullMQ `delay` БИШ ВЭ: пост 2 долоо хоногийн дараа
 * товлогдож болно. BullMQ-ийн хойшлуулсан ажил нь Redis-д амьдардаг
 * бөгөөд Redis цэвэрлэгдэх / restart болоход АЛГА болно. DB + cron
 * нь дахин эхлүүлэхэд даана — товлосон пост хэзээ ч алдагдахгүй.
 */
@Injectable()
export class SocialSchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(SocialSchedulerService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: SocialPublisherService,
    private readonly social: SocialService,
    config: ConfigService,
  ) {
    /* ⚠️ `lifecycle.service.ts`-тэй ИЖИЛ загвар (батлагдсан) */
    const url = config.get<string>('redisUrl') ?? 'redis://localhost:6379';
    this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => null);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    /**
     * ⚠️⚠️ REDIS ТҮГЖЭЭ — backend хэвтээ scale хийгдвэл олон
     * instance зэрэг ажиллаж НЭГ постыг ХОЁР удаа нийтэлнэ.
     * TTL 55 сек — дараагийн tick-ээс өмнө суларна.
     */
    const lock = await this.redis
      .set('social:scheduler:lock', '1', 'EX', 55, 'NX')
      .catch(() => null);
    if (!lock) return;

    try {
      await this.publishDue();
      await this.retryPending();
    } catch (e) {
      this.logger.error(`Хуваарийн cron алдаа: ${String(e)}`);
    }
  }

  /** Цаг нь болсон постуудыг илгээнэ */
  private async publishDue() {
    const due = await this.prisma.socialPost.findMany({
      where: {
        status: SocialPostStatus.SCHEDULED,
        scheduledAt: { not: null, lte: new Date() },
      },
      include: { targets: true },
      /* ⚠️ Минутад 10 пост — илүү бол дараагийн tick авна
         (IG-ийн 24 цагийн 100 постын хязгаарт ойртохгүй) */
      take: 10,
      orderBy: { scheduledAt: 'asc' },
    });

    for (const post of due) {
      /**
       * ⚠️ FB нь ӨӨРӨӨ товлосон бол тэр target-ыг ОДОО илгээхгүй —
       * Meta автоматаар нийтэлнэ. IG-д ийм боломж БАЙХГҮЙ тул
       * тэр нь энэ мөчид явна.
       */
      const pending = post.targets.filter(
        (t) => t.status === SocialTargetStatus.PENDING && !t.fbNativeScheduled,
      );

      if (!pending.length) {
        await this.social.syncPostStatus(post.id);
        continue;
      }

      await this.prisma.socialPost.update({
        where: { id: post.id },
        data: { status: SocialPostStatus.PUBLISHING },
      });

      for (const t of pending) {
        await this.publisher.publishTarget(t.id);
      }
    }

    if (due.length) this.logger.log(`${due.length} товлосон постыг илгээв`);
  }

  /**
   * Түр зуурын алдаагаар `PENDING` руу буцсан target-уудыг дахин.
   *
   * ⚠️ Зөвхөн нийтлэгдэх ёстой байсан постуудынх — draft-ынхыг
   * хөндөхгүй (тэдгээр хараахан товлогдоогүй).
   */
  private async retryPending() {
    const stuck = await this.prisma.socialPostTarget.findMany({
      where: {
        status: SocialTargetStatus.PENDING,
        attempts: { gt: 0, lt: 3 },
        post: {
          status: { in: [SocialPostStatus.PUBLISHING, SocialPostStatus.PARTIAL] },
        },
        /* ⚠️ 2 минут хүлээнэ — шууд давтвал ижил алдаа гарна */
        updatedAt: { lt: new Date(Date.now() - 2 * 60_000) },
      },
      take: 5,
      select: { id: true },
    });

    for (const t of stuck) await this.publisher.publishTarget(t.id);
    if (stuck.length) this.logger.log(`${stuck.length} амжилтгүй постыг дахин оролдов`);
  }

  /**
   * ДАХИН НИЙТЛЭХ (recycle) — өдөрт нэг удаа.
   *
   * ⚠️ Publer-ийн загвар: `{ gap, freq, expireCount, done }`.
   * Хугацаа болсон evergreen постыг ШИНЭ draft болгож хуулаад
   * дараагийн сул slot руу товлоно.
   *
   * ⚠️ Анхны постыг ХӨНДӨХГҮЙ — түүх, аналитик хадгалагдана.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async recycleTick() {
    const lock = await this.redis
      .set('social:recycle:lock', '1', 'EX', 3600, 'NX')
      .catch(() => null);
    if (!lock) return;

    const candidates = await this.prisma.socialPost.findMany({
      where: {
        status: SocialPostStatus.PUBLISHED,
        /* ⚠️ Nullable JSON-д `DbNull` — `JsonNull` нь JSON доторх
           `null` утгыг заадаг, багана хоосон эсэхийг БИШ */
        recycle: { not: Prisma.DbNull },
      },
      take: 50,
    });

    for (const post of candidates) {
      const r = post.recycle as {
        gap?: number;
        freq?: 'DAY' | 'WEEK' | 'MONTH';
        expireCount?: number;
        done?: number;
      } | null;
      if (!r?.gap || !r.freq) continue;

      const done = r.done ?? 0;
      /* ⚠️ Хязгаарт хүрсэн — дахин давтахгүй */
      if (r.expireCount && done >= r.expireCount) continue;

      const ms =
        r.freq === 'DAY' ? 86400_000 : r.freq === 'WEEK' ? 7 * 86400_000 : 30 * 86400_000;
      if (Date.now() - post.updatedAt.getTime() < r.gap * ms) continue;

      try {
        const copy = await this.social.duplicate(post.id);
        await this.social.schedule({ postId: copy.id, at: null });

        await this.prisma.socialPost.update({
          where: { id: post.id },
          data: { recycle: { ...r, done: done + 1 } },
        });
        this.logger.log(`Recycle: ${post.id} → ${copy.id} (${done + 1} дэх удаа)`);
      } catch (e) {
        /* ⚠️ Нэг пост унасан нь бусдыг зогсоох ёсгүй */
        this.logger.warn(`Recycle амжилтгүй (${post.id}): ${String(e)}`);
      }
    }
  }
}
