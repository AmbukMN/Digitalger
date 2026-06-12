import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { NotificationCenterService } from '../notification-center/notification-center.service';

const PENDING_EXPIRE_HOURS = 48;

@Injectable()
export class OrderCleanupService {
  private readonly logger = new Logger(OrderCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly notifications: NotificationCenterService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async autoCancelExpiredOrders() {
    const cutoff = new Date(Date.now() - PENDING_EXPIRE_HOURS * 60 * 60 * 1000);

    // Цуцлахаас ӨМНӨ хугацаа дууссан захиалгуудыг авна:
    //   - id     → холбоотой PENDING Payment-уудыг FAILED болгож синк хийхэд
    //   - купон  → usedCount буцаахад
    //   - items/user/total → цуцлалтын имэйл мэдэгдэл явуулахад
    const expiring = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        userId: true,
        couponCode: true,
        total: true,
        user: { select: { email: true, name: true } },
        items: { select: { price: true, product: { select: { title: true } } } },
      },
    });
    const expiringIds = expiring.map((o) => o.id);

    if (expiringIds.length === 0) {
      return;
    }

    // Order CANCELLED + холбоотой PENDING Payment → FAILED-ийг хамт (атомик) хийнэ —
    // нэг захиалга 2 өөр статустай (Order CANCELLED / Payment PENDING) болохоос сэргийлнэ.
    const [result] = await this.prisma.$transaction([
      this.prisma.order.updateMany({
        where: { id: { in: expiringIds } },
        // Систем (cron) автоматаар цуцалсан — admin UI ялгаж харуулна.
        data: { status: OrderStatus.CANCELLED, cancelledBy: 'SYSTEM', cancelledAt: new Date() },
      }),
      this.prisma.payment.updateMany({
        where: { orderId: { in: expiringIds }, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED },
      }),
    ]);

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

      // Цуцлагдсан захиалга бүрт имэйл мэдэгдэл (invalid/guest хаягт явахгүй —
      // sendOrderCancelled дотор isValidEmail шалгана). Fire-and-forget.
      for (const o of expiring) {
        // In-app мэдэгдэл (navbar 🔔) — захиалга автоматаар цуцлагдсан. Fire-and-forget.
        this.notifications
          .create(o.userId, {
            title: 'Захиалга цуцлагдлаа',
            body: `Таны төлбөр хүлээгдэж байсан захиалга (${o.total}₮) хугацаа дуусч автоматаар цуцлагдлаа.`,
            type: 'order',
            link: '/orders',
          })
          .catch(() => null);

        if (!o.user?.email) continue;
        this.email
          .sendOrderCancelled({
            to: o.user.email,
            name: o.user.name,
            orderId: o.id,
            items: o.items.map((i) => ({ title: i.product.title, price: Number(i.price) })),
            total: Number(o.total),
            reason: 'auto',
          })
          .catch(() => null);
      }
    }
  }
}
