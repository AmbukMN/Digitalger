import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';

@Injectable()
export class ZipCleanupService {
  private readonly logger = new Logger(ZipCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Өдөр бүр 03:00-д — 7 хоногоос хуучин ZipJob + R2 zip файл устгана
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanOldZipJobs() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const old = await this.prisma.zipJob.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true, zipKey: true },
    });

    if (!old.length) return;

    // R2-с zip файлуудыг устгана
    let deleted = 0;
    for (const job of old) {
      if (job.zipKey) {
        try {
          await this.storage.delete(job.zipKey);
          deleted++;
        } catch {
          // File may already be gone
        }
      }
    }

    // DB-с устгана
    await this.prisma.zipJob.deleteMany({
      where: { id: { in: old.map((j) => j.id) } },
    });

    this.logger.log(`Cleanup: ${old.length} ZipJob records, ${deleted} R2 files deleted`);
  }

  // Цаг бүр — FAILED + PENDING-stuck (1 цагаас хуучин) job цэвэрлэнэ
  @Cron(CronExpression.EVERY_HOUR)
  async cleanStuckJobs() {
    const stuckCutoff = new Date(Date.now() - 60 * 60 * 1000);

    const result = await this.prisma.zipJob.updateMany({
      where: {
        status: { in: ['PENDING', 'PROCESSING'] },
        createdAt: { lt: stuckCutoff },
      },
      data: { status: 'FAILED', error: 'Timeout — автоматаар цэвэрлэгдлээ' },
    });

    if (result.count > 0) {
      this.logger.warn(`Marked ${result.count} stuck jobs as FAILED`);
    }
  }
}
