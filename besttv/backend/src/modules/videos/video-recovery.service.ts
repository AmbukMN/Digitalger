import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { VIDEO_QUEUE, VideoHlsJob } from './video-queue.types';

/**
 * ⚠️ Хэдэн минутын дараа "гацсан" гэж үзэх вэ.
 * `-c copy` тул хамгийн том видео ч 30 минутад дуусна. 45 минут хэтэрвэл
 * worker унасан / Redis цэвэрлэгдсэн / ffmpeg гацсан гэсэн үг.
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
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async recoverStalled() {
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
        { target, targetId, rawKey },
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
      await this.setStatus(target, targetId, {
        streamStatus: 'FAILED',
        streamError: `${STALE_MINUTES} минут хэтэрсэн — түр файл алга (дахин upload хийнэ үү)`,
      });
      this.logger.error(`Гацсан хөрвүүлэлт СЭРГЭЭГДЭХГҮЙ: ${label}`);
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
