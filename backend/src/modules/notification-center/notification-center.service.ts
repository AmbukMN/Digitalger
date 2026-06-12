import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Аппликейшн доторх (in-app) мэдэгдэл — navbar 🔔 bell-д харагдана.
// ⚠️ Энэ нь имэйлийн NotificationsModule-аас ТУСДАА (in-app зөвхөн).
export type NotificationType = 'info' | 'order' | 'lesson' | 'coupon' | 'certificate';

export interface CreateNotificationInput {
  title: string;
  body: string;
  type?: NotificationType;
  link?: string | null;
}

@Injectable()
export class NotificationCenterService {
  private readonly logger = new Logger(NotificationCenterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Мэдэгдэл үүсгэх — бусад service дуудна (fire-and-forget зөвлөмжтэй).
   * userId буруу/байхгүй бол алдаа шиднэ; дуудагч тал .catch-аар барина.
   */
  async create(userId: string, input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId,
        title: input.title,
        body: input.body,
        type: input.type ?? 'info',
        link: input.link ?? null,
      },
    });
  }

  /** Сүүлийн N мэдэгдэл (createdAt буурахаар) — dropdown-д. */
  async listForUser(userId: string, limit = 20) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
    });
  }

  /** Уншаагүй мэдэгдлийн тоо (badge). */
  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  /** Нэг мэдэгдлийг уншсан болгох (зөвхөн өөрийн). */
  async markRead(userId: string, id: string) {
    // updateMany — өөр хэрэглэгчийн id өгсөн ч 0 мөр өөрчилнө (хамгаалалт).
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
    return { ok: true };
  }

  /** Бүх мэдэгдлийг уншсан болгох. */
  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { ok: true, count: res.count };
  }
}
