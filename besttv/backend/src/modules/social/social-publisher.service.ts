import { Injectable, Logger } from '@nestjs/common';
import { SocialChannel, SocialTargetStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { MetaGraphService } from '../crosspost/meta-graph.service';
import { SocialService } from './social.service';

/** IG container 24 цаг хүчинтэй (Meta баримт) — түүнээс хойш EXPIRED */
const IG_CONTAINER_TTL_MS = 24 * 3600_000;
/** Медиаг Meta татаж авахад хангалттай хугацаа */
const MEDIA_URL_TTL_SEC = 6 * 3600;

const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;

/**
 * НЭГ TARGET-ЫГ НИЙТЛЭХ.
 *
 * ⚠️⚠️ ЗАРЧИМ: суваг бүр ТУСДАА. Нэг нь унасан нь нөгөөг зогсоохгүй.
 * Дахин оролдохдоо ЗӨВХӨН унасныг — эс бөгөөс FB дээр ДАВХАР пост
 * үүснэ (салбарын хамгийн түгээмэл алдаа).
 */
@Injectable()
export class SocialPublisherService {
  private readonly logger = new Logger(SocialPublisherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly meta: MetaGraphService,
    private readonly social: SocialService,
  ) {}

  /**
   * Meta-гийн алдааны кодоос RETRY хийж болох эсэхийг шийднэ.
   *
   * ⚠️⚠️ Албан ёсны баримтаас (Graph API Error Handling):
   *   1, 2       — API түр доголдол
   *   4, 17, 32  — throttling (апп/хэрэглэгч/Page)
   *   341        — апп-ын хязгаар
   *   368        — түр блок (policy)
   *   80001/2    — BUC throttle
   * Эдгээр нь ТҮР ЗУУРЫН → дахин оролдоно.
   *
   *   10  — эрх олгогдоогүй
   *   190 — токен хүчингүй
   * Эдгээр нь БҮРМӨСӨН → дахин оролдох нь утгагүй, хүн оролцоно.
   */
  private isRetryable(err: unknown): boolean {
    const msg = String(err instanceof Error ? err.message : err);
    /* Бүрмөсөн — эрх/токен */
    if (/\(#10\)|\(#190\)|permission|token/i.test(msg)) return false;
    /* Түр зуурын — throttle/доголдол */
    if (/\(#(1|2|4|17|32|341|368|80001|80002)\)|throttl|rate limit|temporar/i.test(msg)) {
      return true;
    }
    /* Сүлжээ */
    if (/timeout|ECONN|fetch failed|socket/i.test(msg)) return true;
    /* Тодорхойгүй — retry хийхгүй (давхардлаас сэргийлнэ) */
    return false;
  }

  /** R2 key → Meta татаж чадах нийтийн URL */
  private async mediaUrls(keys: string[]): Promise<string[]> {
    return Promise.all(keys.map((k) => this.storage.publicAssetUrl(k, MEDIA_URL_TTL_SEC)));
  }

  // ─── FACEBOOK ───────────────────────────────────────────────────────────

  private async publishFacebook(params: {
    caption: string;
    mediaKeys: string[];
    /** FB өөрөө товлох UNIX timestamp (секунд). `null` = шууд. */
    scheduledUnix: number | null;
  }): Promise<string> {
    const urls = await this.mediaUrls(params.mediaKeys);
    const isVideo = params.mediaKeys.some((k) => VIDEO_EXT.test(k));

    if (isVideo) {
      /* ⚠️ `file_url` хангалттай — resumable upload ЗААВАЛ БИШ (Meta баримт) */
      return this.meta.createPageVideo({
        videoUrl: urls[0],
        description: params.caption,
        scheduledUnix: params.scheduledUnix,
      });
    }

    if (urls.length === 1) {
      return this.meta.createPagePhoto({
        imageUrl: urls[0],
        caption: params.caption,
        scheduledUnix: params.scheduledUnix,
      });
    }

    if (urls.length > 1) {
      /**
       * ⚠️⚠️ ОЛОН ЗУРАГ — `attached_media` урсгал нь Meta-гийн албан
       * ёсны баримтад ОРООГҮЙ. Практикт ажилладаг ч мэдэгдэлгүй
       * өөрчлөгдөж болзошгүй. Composer нь админд анхааруулдаг.
       */
      return this.meta.createPageMultiPhoto({
        imageUrls: urls,
        message: params.caption,
        scheduledUnix: params.scheduledUnix,
      });
    }

    /* Медиагүй — текст пост */
    return this.meta.createPagePost({
      message: params.caption,
      scheduledUnix: params.scheduledUnix,
    });
  }

  // ─── INSTAGRAM ──────────────────────────────────────────────────────────

  private async publishInstagram(params: {
    targetId: string;
    caption: string;
    mediaKeys: string[];
    /** Өмнөх оролдлогоос үлдсэн container */
    existingContainerId: string | null;
    existingContainerAt: Date | null;
  }): Promise<string> {
    /**
     * ⚠️⚠️ CONTAINER ДАХИН АШИГЛАХ — давхардлын ГОЛ хамгаалалт.
     *
     * Publish алхам сүлжээний алдаагаар унавал ШИНЭ container
     * үүсгэвэл IG дээр ХОЁР пост гарч болно. Meta нь idempotency
     * key дэмждэггүй тул `creation_id` нь тэр үүргийг гүйцэтгэнэ.
     *
     * ⚠️ 24 цаг хүчинтэй — хэтэрвэл `EXPIRED` тул шинээр үүсгэнэ.
     */
    let containerId = params.existingContainerId;
    const fresh =
      params.existingContainerAt &&
      Date.now() - params.existingContainerAt.getTime() < IG_CONTAINER_TTL_MS;

    if (!containerId || !fresh) {
      const urls = await this.mediaUrls(params.mediaKeys);
      const isVideo = params.mediaKeys.some((k) => VIDEO_EXT.test(k));

      if (urls.length > 1) {
        /* Carousel — гишүүн бүр тусдаа container */
        const children: string[] = [];
        for (const u of urls) {
          children.push(await this.meta.createContainer({ imageUrl: u, isCarouselItem: true }));
        }
        containerId = await this.meta.createCarouselContainer(children, params.caption);
      } else if (isVideo) {
        containerId = await this.meta.createContainer({
          videoUrl: urls[0],
          caption: params.caption,
        });
      } else {
        containerId = await this.meta.createContainer({
          imageUrl: urls[0],
          caption: params.caption,
        });
      }

      await this.prisma.socialPostTarget.update({
        where: { id: params.targetId },
        data: { igContainerId: containerId, igContainerAt: new Date() },
      });
    } else {
      this.logger.log(`IG container дахин ашиглав (давхардлаас сэргийлэв): ${containerId}`);
    }

    /* ⚠️ Видео боловсруулагдаж дуустал хүлээнэ — эс бөгөөс publish унана */
    await this.meta.waitForContainer(containerId);
    return this.meta.publishContainer(containerId);
  }

  // ─── Нийтлэх (нэг target) ───────────────────────────────────────────────

  async publishTarget(targetId: string): Promise<void> {
    const target = await this.prisma.socialPostTarget.findUnique({
      where: { id: targetId },
      include: { post: true },
    });
    if (!target) return;

    if (target.status === SocialTargetStatus.PUBLISHED) {
      this.logger.warn(`Аль хэдийн нийтлэгдсэн — алгаслаа (${targetId})`);
      return;
    }

    /* ⚠️ Суваг зогсоосон эсэх — pause үед явахгүй */
    const setting = await this.prisma.socialChannelSetting.findUnique({
      where: { channel: target.channel },
    });
    if (setting?.paused) {
      this.logger.log(`${target.channel} зогсоосон — постыг хойшлууллаа (${targetId})`);
      return;
    }

    const claimed = await this.social.claimTarget(targetId);
    if (!claimed) return;

    const caption = target.caption ?? target.post.body;

    try {
      if (!this.meta.isConfigured()) {
        throw new Error('Meta холболт тохируулаагүй байна (FB_PAGE_ACCESS_TOKEN дутуу)');
      }

      let externalId: string;

      if (target.channel === SocialChannel.FACEBOOK) {
        /**
         * ⚠️ FB ӨӨРӨӨ ТОВЛОХ — `fbNativeScheduled` бол ирээдүйн
         * цагийг Meta-д даалгана. Тэр үед пост ШУУД гарахгүй,
         * харин Meta товлосон цагт нь өөрөө нийтэлнэ.
         */
        const unix =
          target.fbNativeScheduled && target.post.scheduledAt
            ? Math.floor(target.post.scheduledAt.getTime() / 1000)
            : null;

        externalId = await this.publishFacebook({
          caption,
          mediaKeys: target.post.mediaKeys,
          scheduledUnix: unix,
        });
      } else {
        externalId = await this.publishInstagram({
          targetId,
          caption,
          mediaKeys: target.post.mediaKeys,
          existingContainerId: target.igContainerId,
          existingContainerAt: target.igContainerAt,
        });
      }

      await this.prisma.socialPostTarget.update({
        where: { id: targetId },
        data: {
          status: SocialTargetStatus.PUBLISHED,
          externalId,
          publishedAt: new Date(),
          error: null,
        },
      });
      this.logger.log(`${target.channel} нийтлэгдлээ: ${externalId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const retryable = this.isRetryable(e);

      await this.prisma.socialPostTarget.update({
        where: { id: targetId },
        data: {
          /**
           * ⚠️ Retry боломжтой бол `PENDING` руу буцаана — cron
           * дахин авна. Бүрмөсөн алдаа бол `FAILED` (админ засна).
           */
          status: retryable && target.attempts < 3
            ? SocialTargetStatus.PENDING
            : SocialTargetStatus.FAILED,
          error: msg.slice(0, 500),
        },
      });

      this.logger.error(
        `${target.channel} нийтлэх амжилтгүй (${retryable ? 'дахин оролдоно' : 'БҮРМӨСӨН'}): ${msg}`,
      );
    } finally {
      await this.social.syncPostStatus(target.postId);
    }
  }

  /**
   * ЗӨВХӨН УНАСАН сувгуудыг дахин илгээх.
   *
   * ⚠️⚠️ Нийтлэгдсэн сувгийг ХӨНДӨХГҮЙ — эс бөгөөс FB дээр ДАВХАР
   * пост үүснэ. Энэ бол хэсэгчилсэн амжилтын гол дүрэм.
   */
  async retryFailed(postId: string): Promise<number> {
    const failed = await this.prisma.socialPostTarget.findMany({
      where: { postId, status: SocialTargetStatus.FAILED },
      select: { id: true },
    });

    for (const t of failed) {
      await this.prisma.socialPostTarget.update({
        where: { id: t.id },
        data: { status: SocialTargetStatus.PENDING, error: null, attempts: 0 },
      });
    }
    return failed.length;
  }
}
