import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { VideoHlsService } from '../../storage/video-hls.service';
import { VIDEO_QUEUE, VideoHlsJob } from './video-queue.types';

// ⚠️ Worker container — VIDEO_QUEUE-ийн CONSUMER. R2-аас raw видео татаж HLS
// (m3u8 + ts) болгож R2-руу буцаан хадгална. HelpVideo.videoKey=m3u8, streamStatus.
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
    const { target, targetId, rawKey, folder } = job.data;
    this.logger.log(`HLS хөрвүүлэлт эхэллээ: ${target}/${targetId} (${rawKey})`);

    try {
      // 1+2) R2 raw → диск (stream, memory-гүй) → HLS (m3u8+ts, -c copy чанар хадгална)
      // → R2. ⚠️ Том видео (246MB) memory-д татвал OOM тул key-аар шууд stream.
      const result = await this.hls.convertKeyAndUpload(rawKey, folder);

      // 3) Entity шинэчлэх — videoKey=m3u8 public URL, poster, статус ready
      const playlistUrl = this.storage.getAssetUrl(result.playlistKey);
      const posterUrl = this.storage.getAssetUrl(result.posterKey);
      const durationLabel = this.fmtDuration(result.durationSec);

      if (target === 'helpVideo') {
        await this.prisma.helpVideo.update({
          where: { id: targetId },
          data: {
            videoKey: playlistUrl,
            posterKey: posterUrl,
            durationLabel,
            streamStatus: 'ready',
          },
        });
      }

      // 4) Raw түр файл устгах (HLS бэлэн тул хэрэггүй)
      await this.storage.delete(rawKey).catch(() => null);

      this.logger.log(`HLS бэлэн: ${target}/${targetId} (${result.segmentCount} segment, ${durationLabel})`);
    } catch (e) {
      this.logger.error(`HLS хөрвүүлэлт амжилтгүй: ${target}/${targetId} — ${String(e).slice(0, 300)}`);
      // Алдаа гарвал статус 'error' — admin дахин оролдож болно. Raw үлдээнэ (debug).
      if (target === 'helpVideo') {
        await this.prisma.helpVideo
          .update({ where: { id: targetId }, data: { streamStatus: 'error' } })
          .catch(() => null);
      }
      throw e; // BullMQ retry хийнэ
    }
  }

  private fmtDuration(sec: number): string {
    const s = Math.max(0, Math.round(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }
}
