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

    // Цуцлахаас ӨМНӨ купонтой захиалгуудыг авна — usedCount буцаахын тулд.
    const expiring = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        createdAt: { lt: cutoff },
        couponCode: { not: null },
      },
      select: { couponCode: true },
    });

    const result = await this.prisma.order.updateMany({
      where: {
        status: OrderStatus.PENDING,
        createdAt: { lt: cutoff },
      },
      // Систем (cron) автоматаар цуцалсан — admin UI ялгаж харуулна.
      data: { status: OrderStatus.CANCELLED, cancelledBy: 'SYSTEM', cancelledAt: new Date() },
    });

    // Цуцалсан захиалгуудын купоны usedCount-ийг буцаана (0-ээс доош буурахгүй).
    const codes = expiring
      .flatMap((o) => (o.couponCode ?? '').split(','))
      .map((c) => c.trim())
      .filter(Boolean);
    for (const code of codes) {
      await this.prisma.coupon
        .updateMany({ where: { code, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } })
        .catch(() => {});
    }

    if (result.count > 0) {
      this.logger.log(`Auto-cancelled ${result.count} expired PENDING orders (>${PENDING_EXPIRE_HOURS}h)`);
    }
  }
}
