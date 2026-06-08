import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudflareStreamService } from '../../storage/cloudflare-stream.service';
import { N8nService } from '../n8n/n8n.service';

/**
 * Cloudflare Stream orphan видео цэвэрлэгч (cron).
 *
 * Orphan гэдэг нь Cloudflare Stream дээр байгаа ч ямар ч Lesson.videoStreamId-д
 * ХОЛБОГДООГҮЙ видео (хичээл устгасан/видео сольсон үед үлдсэн хог).
 *
 * ⚠️ Хамгаалалт: saяхан (DELETE_AFTER_HOURS дотор) upload хийсэн видеог
 * устгахгүй — admin одоо upload хийж байж магадгүй (created дата шалгана).
 *
 * ⚠️ ScheduleModule.forRoot() нь app.module-д НЭГ удаа. Энд @Cron л ашиглана.
 * ⚠️ Redis distributed lock — олон process-т зөвхөн нэг удаа ажиллана.
 */
@Injectable()
export class StreamCleanupService implements OnModuleDestroy {
  private readonly logger = new Logger(StreamCleanupService.name);
  private readonly redis: Redis;
  // Saяхан upload-ийг хамгаалах цонх — энэ хугацаанаас ШИНЭ видеог битгий устга.
  private readonly DELETE_AFTER_HOURS = 2;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly stream: CloudflareStreamService,
    private readonly n8n: N8nService,
  ) {
    const redisUrl = this.config.get<string>('redisUrl') ?? 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => {});
  }

  // Өдөр бүр 04:30 Улаанбаатарын цагаар (DB backup 04:00-аас хойш).
  @Cron('30 4 * * *', { timeZone: 'Asia/Ulaanbaatar' })
  async runOrphanCleanup(): Promise<void> {
    if (!this.stream.configured) {
      this.logger.log('Stream orphan cleanup: Cloudflare Stream тохируулаагүй — алгасав');
      return;
    }

    // Redis distributed lock — олон process-т зөвхөн нэг удаа ажиллана.
    const date = new Date().toISOString().split('T')[0];
    const lockKey = `cron:stream-orphan-cleanup:${date}`;
    const acquired = await this.redis.set(lockKey, '1', 'EX', 3600, 'NX').catch(() => null);
    if (!acquired) {
      this.logger.log('Stream orphan cleanup: өөр process аль хэдийн ажиллуулсан — алгасав');
      return;
    }

    this.logger.log('Stream orphan cleanup эхэлж байна...');

    try {
      // 1) Cloudflare-ийн БҮХ видео
      const videos = await this.stream.listVideos();
      if (videos.length === 0) {
        this.logger.log('Stream orphan cleanup: Cloudflare дээр видео алга — дуусгав');
        return;
      }

      // 2) DB-ийн БҮХ lesson.videoStreamId (Set)
      const lessons = await this.prisma.lesson.findMany({
        where: { videoStreamId: { not: null } },
        select: { videoStreamId: true },
      });
      const linked = new Set<string>();
      for (const l of lessons) {
        if (l.videoStreamId) linked.add(l.videoStreamId);
      }

      // 3) Cloudflare дээр байгаа ч DB-д холбогдоогүй (orphan) + 2+ цагийн өмнөх
      const cutoff = Date.now() - this.DELETE_AFTER_HOURS * 60 * 60 * 1000;
      let deleted = 0;
      let skippedRecent = 0;

      for (const v of videos) {
        if (linked.has(v.uid)) continue; // хичээлд холбоотой — хадгална

        // Saяхан upload-ийг хамгаалах: created байхгүй бол аюулгүй талд нь алгасна.
        const createdMs = v.created ? new Date(v.created).getTime() : NaN;
        if (!Number.isFinite(createdMs) || createdMs > cutoff) {
          skippedRecent += 1;
          continue;
        }

        await this.stream.deleteVideo(v.uid);
        deleted += 1;
        this.logger.log(`Orphan Stream видео устгав: ${v.uid} (created ${v.created})`);
      }

      this.logger.log(
        `Stream orphan cleanup дууслаа — нийт ${videos.length} видео, ` +
          `${deleted} orphan устгав, ${skippedRecent} saяхан/тодорхойгүй хамгаалав`,
      );
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      this.logger.error(`Stream orphan cleanup алдаа: ${msg}`);
      await this.n8n
        .emitAlert({
          level: 'warning',
          title: 'Stream orphan cleanup амжилтгүй',
          message: `Cloudflare видео цэвэрлэх үед алдаа гарлаа: ${msg.slice(0, 300)}`,
          source: 'stream-cleanup',
        })
        .catch(() => {});
    }
  }
}
