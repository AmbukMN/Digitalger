import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { VideoHlsService, type HlsProgress } from '../../storage/video-hls.service';
import { VIDEO_QUEUE, VideoHlsJob } from './video-queue.types';

/** Явцыг DB-д хэт олон удаа бичихгүй — 2 секундэд нэг */
const PROGRESS_THROTTLE_MS = 2000;

/**
 * ⚠️ Worker container — VIDEO_QUEUE-ийн CONSUMER.
 * R2 raw видео → диск (stream, OOM-гүй) → ffmpeg HLS (-c copy, чанар 100%)
 * → R2. Дараа нь entity-д videoKey (R2 KEY — URL БИШ, private bucket!).
 *
 * ⚠️ Энэ файлыг өөрчилбөл worker-ийг ЗААВАЛ rebuild/restart!
 */
@Processor(VIDEO_QUEUE)
export class VideoProcessor {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly hls: VideoHlsService,
  ) {}

  @Process({ name: 'convert', concurrency: 1 })
  async handle(job: Job<VideoHlsJob>) {
    const { target, targetId, rawKey } = job.data;
    this.logger.log(`HLS хөрвүүлэлт эхэллээ: ${target}/${targetId} (${rawKey})`);

    // ⚠️ Эхлэх мөчийг тэмдэглэнэ — гацсан ажлыг илрүүлэхэд ХЭРЭГТЭЙ
    await this.setState(target, targetId, {
      streamStatus: 'PROCESSING',
      streamProgress: 0,
      streamStartedAt: new Date(),
      streamError: null,
    });

    let lastWrite = 0;

    try {
      const folder =
        target === 'trailer' ? 'trailers' : target === 'episode' ? 'episodes' : 'movies';

      const result = await this.hls.convertKeyAndUpload(rawKey, folder, (p: HlsProgress) => {
        // Bull-ийн явц (админ queue хардаг бол)
        void job.progress(p.percent).catch(() => null);

        // ⚠️ DB бичилтийг throttle — segment бүрд бичвэл DB дүүрнэ
        const now = Date.now();
        if (now - lastWrite < PROGRESS_THROTTLE_MS) return;
        lastWrite = now;
        void this.setState(target, targetId, { streamProgress: p.percent }).catch(() => null);
      });

      // ⚠️ videoKey = R2 KEY (URL биш) — stream gate presign хийж өгнө
      if (target === 'trailer') {
        await this.prisma.title.update({
          where: { id: targetId },
          data: { trailerKey: result.playlistKey },
        });
      } else {
        await this.setState(target, targetId, {
          videoKey: result.playlistKey,
          durationSec: result.durationSec,
          streamStatus: 'READY',
          streamProgress: 100,
          streamError: null,
          videoRawKey: null,
        });
      }

      // Raw түр файл устгах (HLS бэлэн)
      await this.storage.delete(rawKey).catch(() => null);
      this.logger.log(
        `HLS бэлэн: ${target}/${targetId} — ${result.segmentCount} segment, ${result.durationSec}s`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`HLS хөрвүүлэлт амжилтгүй: ${target}/${targetId} — ${msg}`);

      // ⚠️ Алдааны шалтгааныг DB-д бичнэ — админ юу болсныг ХАРНА
      await this.setState(target, targetId, {
        streamStatus: 'FAILED',
        streamError: msg.slice(0, 500),
      }).catch(() => null);

      throw err;
    }
  }

  /**
   * Title/Episode-ийн төлөв шинэчлэх — нэг цэгээс.
   * ⚠️ trailer нь Title-ийн streamStatus-ыг хөндөхгүй (кинонд зориулагдсан).
   */
  private async setState(
    target: VideoHlsJob['target'],
    targetId: string,
    data: Record<string, unknown>,
  ) {
    if (target === 'trailer') return;
    if (target === 'movie') {
      await this.prisma.title.update({ where: { id: targetId }, data }).catch(() => null);
    } else {
      await this.prisma.episode.update({ where: { id: targetId }, data }).catch(() => null);
    }
  }
}
