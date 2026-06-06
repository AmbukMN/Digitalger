import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

// Хугацаа дууссан TransferState бичлэгүүдийг цэвэрлэнэ — эс бол DB-д хуримтлагдана.
@Injectable()
export class TransferCleanupService {
  private readonly logger = new Logger(TransferCleanupService.name);
  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanup() {
    try {
      const res = await this.prisma.transferState.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (res.count > 0) {
        this.logger.log(`Хугацаа дууссан ${res.count} transfer бичлэг устгав`);
      }
    } catch (err) {
      this.logger.error('TransferState цэвэрлэхэд алдаа', err);
    }
  }
}
