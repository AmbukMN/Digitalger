import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const PENDING_EXPIRE_HOURS = 48;

@Injectable()
export class OrderCleanupService {
  private readonly logger = new Logger(OrderCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async autoCancelExpiredOrders() {
    const cutoff = new Date(Date.now() - PENDING_EXPIRE_HOURS * 60 * 60 * 1000);

    const result = await this.prisma.order.updateMany({
      where: {
        status: OrderStatus.PENDING,
        createdAt: { lt: cutoff },
      },
      data: { status: OrderStatus.CANCELLED },
    });

    if (result.count > 0) {
      this.logger.log(`Auto-cancelled ${result.count} expired PENDING orders (>${PENDING_EXPIRE_HOURS}h)`);
    }
  }
}
