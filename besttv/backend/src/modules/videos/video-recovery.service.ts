import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { VIDEO_QUEUE, VideoHlsJob } from './video-queue.types';
import { currentSite } from '../../common/site/site-context';
import { forEachSite } from '../../common/site/site-cron';
import { N8nService } from '../n8n/n8n.service';

/**
 * ⚠️⚠️ Хэдэн минутын дараа "гацсан" гэж үзэх вэ.
 *
 * ⚠️ Тайлбар нь `-c copy` (30 мин) гэж байсан нь ХУУЧИРСАН — хөрвүүлэлт
 * ABR (3 түвшин re-encode) болсон. VPS-т 2 цагийн кино ДАНГААРАА ~36
 * минут, `concurrency: 4` үед CPU хуваагдаж 2+ ЦАГ болно.
 *
 * ⚠️ Гэхдээ энэ тоог ӨСГӨХ шаардлагагүй: доорх шүүлт нь дараалалд
 * (waiting/active/delayed) байгаа бүх ажлыг алгасдаг тул ЯВЖ БУЙ
 * хөрвүүлэлт хэзээ ч "гацсан" гэж тооцогдохгүй. Энэ хугацаа нь
 * зөвхөн ДАРААЛЛААС АЛГА болсон (worker унасан, Redis цэвэрлэгдсэн)
 * ажлыг олоход хэрэглэгдэнэ — түүнд 45 минут хангалттай.
 */
const STALE_MINUTES = 45;

/**
 * Гацсан HLS хөрвүүлэлтийг илрүүлж СЭРГЭЭНЭ.
 *
 * ⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ (бодит асуудал):
 * Redis дахин асахад (container restart, memory цэвэрлэлт) queue-д хүлээж
 * байсан ажил АЛГА болдог. Гэтэл DB нь `PROCESSING` хэвээр үлдэж, админ
 * панельд "Боловсруулж байна — 1-3 минут" гэж ҮҮРД харагддаг байсан.
 *
 * Энэ сервис:
 *   1. Хугацаа хэтэрсэн PROCESSING-ыг олно
 *   2. `videoRawKey` байвал → queue-д ДАХИН оруулна (автомат сэргээлт)
 *   3. Байхгүй бол → FAILED болгож шалтгааныг бичнэ (админ дахин upload хийнэ)
 */
@Injectable()
export class VideoRecoveryService {
  private readonly logger = new Logger(VideoRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(VIDEO_QUEUE) private readonly queue: Queue<VideoHlsJob>,
    private readonly n8n: N8nService,
  ) {}

  /**
   * ⚠️⚠️ `forEachSite` ЗААВАЛ — cron нь ХҮСЭЛТИЙН КОНТЕКСТГҮЙ.
   *
   * ⛔ БОДИТ АЛДАА (2026-09-09 аудит): энэ нь нүцгэн `@Cron` байсан
   * атал доорх код `currentSite()` дуудаж, тайлбартаа «контекст
   * `forEachSite`-аас ирнэ» гэж бичсэн байв. Бодит байдалд
   * `currentSite()` нь ҮРГЭЛЖ `besttv` буцаана.
   *
   * Үр дагавар: BestFilm-ийн гацсан кино сэргээхэд queue-д
   * `site:'besttv'` тамга тавигдаж, унасан үед Telegram-д
   * «⚠️ Хөрвүүлэлт амжилтгүй · BestTV» гэж БАТТАЙ ХУДАЛ очно.
   *
   * ⚠️ 17 `@Cron`-оос 7 нь л `forEachSite` ашигладаг байсан.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async recoverStalled() {
    await forEachSite('video-recovery', () => this.recoverForCurrentSite());
  }

  private async recoverForCurrentSite() {
    const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000);

    const [titles, episodes] = await Promise.all([
      this.prisma.title.findMany({
        where: {
          streamStatus: 'PROCESSING',
          OR: [{ streamStartedAt: { lt: cutoff } }, { streamStartedAt: null, updatedAt: { lt: cutoff } }],
        },
        select: { id: true, title: true, videoRawKey: true },
      }),
      this.prisma.episode.findMany({
        where: {
          streamStatus: 'PROCESSING',
          OR: [{ streamStartedAt: { lt: cutoff } }, { streamStartedAt: null, updatedAt: { lt: cutoff } }],
        },
        select: { id: true, number: true, videoRawKey: true },
      }),
    ]);

    if (!titles.length && !episodes.length) return;

    /**
     * ⚠️⚠️ ДАРААЛАЛД АЛЬ ХЭДИЙН БАЙГААГ ХАСНА.
     *
     * Бодит алдаа: 70+ видео нэг дор оруулахад worker нь `concurrency: 1`
     * тул сүүлийн кино 10+ цаг ЭЭЛЖ ХҮЛЭЭНЭ. Гэтэл `streamStartedAt` нь
     * upload үед тавигддаг тул 45 минутын дараа тэдгээрийг бүгдийг нь
     * "гацсан" гэж үзээд ДАХИН дараалалд нэмдэг байв.
     *
     * Үр дүн: 10 минут тутам давхардал нэмэгдэж, дараалал 98 → 128 болж
     * ӨСӨЖ, нэг кино 3 удаа хөрвүүлэгдэж, дуусах хугацаа 3 дахин уртсав.
     *
     * Тиймээс waiting/active/delayed дараалалд байгаа targetId-г алгасна —
     * тэдгээр нь гацаагүй, зүгээр л ээлж хүлээж байна.
     */
    const queued = new Set<string>();
    try {
      const jobs = await this.queue.getJobs(['waiting', 'active', 'delayed']);
      for (const j of jobs) {
        if (j?.data?.targetId) queued.add(j.data.targetId);
      }
    } catch (e) {
      // Redis уншиж чадсангүй — сэргээлтийг бүхэлд нь алгасах нь аюулгүй
      // (давхардал үүсгэхээс дараагийн 10 минутад хойшлуулах нь дээр)
      this.logger.warn(`Дараалал уншиж чадсангүй, сэргээлт алгаслаа: ${String(e)}`);
      return;
    }

    const stalledTitles = titles.filter((t) => !queued.has(t.id));
    const stalledEpisodes = episodes.filter((e) => !queued.has(e.id));

    const skipped = titles.length - stalledTitles.length + (episodes.length - stalledEpisodes.length);
    if (skipped > 0) {
      this.logger.log(`${skipped} ажил дараалалд хүлээж байна — сэргээхгүй (гацаагүй)`);
    }

    for (const t of stalledTitles) {
      await this.recover('movie', t.id, t.videoRawKey, `Кино "${t.title}"`);
    }
    for (const e of stalledEpisodes) {
      await this.recover('episode', e.id, e.videoRawKey, `Анги #${e.number}`);
    }
  }

  private async recover(
    target: 'movie' | 'episode',
    targetId: string,
    rawKey: string | null,
    label: string,
  ) {
    if (rawKey) {
      // ── Raw файл байгаа → ДАХИН оролдоно ──
      await this.queue.add(
        'convert',
        /* ⚠️ `site` — унасан мэдэгдэл зөв брэндээр явахад ЗААВАЛ.
           ⚠️ Контекст нь дээрх `forEachSite`-аас ирнэ (2026-09-09-нд
           нэмэгдсэн; өмнө нь нүцгэн @Cron тул үргэлж `besttv` байв). */
        { target, targetId, rawKey, site: currentSite() },
        { attempts: 2, removeOnComplete: true, removeOnFail: false },
      );
      await this.setStatus(target, targetId, {
        streamProgress: 0,
        streamStartedAt: new Date(),
        streamError: null,
      });
      this.logger.warn(`Гацсан хөрвүүлэлтийг ДАХИН эхлүүллээ: ${label}`);
    } else {
      // ── Raw байхгүй → сэргээх боломжгүй ──
      const reason = `${STALE_MINUTES} минут хэтэрсэн — түр файл алга (дахин upload хийнэ үү)`;
      await this.setStatus(target, targetId, {
        streamStatus: 'FAILED',
        streamError: reason,
      });
      this.logger.error(`Гацсан хөрвүүлэлт СЭРГЭЭГДЭХГҮЙ: ${label}`);
      /**
       * ⚠️⚠️ МЭДЭГДЭЛ ЗААВАЛ — эс бөгөөс ЧИМЭЭГҮЙ үхнэ.
       *
       * ⛔ Аудитаар илэрсэн (2026-09-09): `video.processor.ts:259` нь
       * унасан хөрвүүлэлтэд `emitVideoFailed` дууддаг атал ЭНЭ зам
       * (recovery) орхигдсон байв. Админ кино хөрвүүлэгдээгүйг зөвхөн
       * гараар шалгаж мэдэх байсан.
       */
      try {
        this.n8n.emitVideoFailed({
          titleName: label,
          /* ⚠️ `label` нь ангийн мэдээллийг аль хэдийн агуулдаг тул
             давхардуулахгүй — recovery замд тусад нь салгах дата алга */
          episodeLabel: target === 'episode' ? label : null,
          reason,
          /* ⚠️ `attempts: 0` — recovery нь queue-ийн оролдлогыг
             мэдэхгүй (гацсаныг олж авсан), 0 нь «тодорхойгүй» гэсэн үг */
          attempts: 0,
          failedAt: new Date().toISOString(),
        });
      } catch (e) {
        this.logger.warn(`Мэдэгдэл илгээж чадсангүй: ${String(e).slice(0, 100)}`);
      }
    }
  }

  private async setStatus(
    target: 'movie' | 'episode',
    targetId: string,
    data: Record<string, unknown>,
  ) {
    if (target === 'movie') {
      await this.prisma.title.update({ where: { id: targetId }, data }).catch(() => null);
    } else {
      await this.prisma.episode.update({ where: { id: targetId }, data }).catch(() => null);
    }
  }
}
