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

    for (const t of titles) {
      await this.recover('movie', t.id, t.videoRawKey, `Кино "${t.title}"`);
    }
    for (const e of episodes) {
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
