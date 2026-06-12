import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CouponType, OrderStatus, SubscriberStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { NotificationCenterService } from '../notification-center/notification-center.service';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Marketing-д ашиглах нийтийн coupon
const PUBLIC_COUPON_CODE = 'SUBSCRIBER10';
const PUBLIC_COUPON_PERCENT = 10;
const PUBLIC_COUPON_LABEL = '10% хөнгөлөлт';
// Reactivation (30 хоног идэвхгүй) — ТУСДАА coupon. Хэрэглэгч SUBSCRIBER10-ийг
// аль хэдийн ашигласан байж болзошгүй тул шинэ кодоор буцаан татна.
const REACTIVATION_COUPON_CODE = 'WELCOMEBACK10';
const REACTIVATION_COUPON_LABEL = '10% хөнгөлөлт';

// Reactivation нэг өдөрт хэдэн хэрэглэгчид явуулах хязгаар
const REACTIVATION_BATCH = 200;

// Зочин/хуурамч имэйлийг шүүх энгийн regex
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** canSendMarketing-д хэрэгтэй талбарууд */
type MarketingUser = {
  email: string | null;
  name?: string | null;
  isGuest: boolean;
  blocked: boolean;
  marketingOptOut: boolean;
};

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly notifications: NotificationCenterService,
  ) {}

  /**
   * Хэрэглэгчид MARKETING имэйл явуулж болох эсэх.
   * - email байх ба @guest.digitalger.mn биш (зочин хасах)
   * - isGuest === false
   * - blocked === false
   * - marketingOptOut === false (unsubscribe дарсан бол явуулахгүй)
   * - email regex valid
   */
  private canSendMarketing(user: MarketingUser | null | undefined): boolean {
    if (!user) return false;
    const email = (user.email ?? '').trim().toLowerCase();
    if (!email) return false;
    if (email.endsWith('@guest.digitalger.mn')) return false;
    if (user.isGuest) return false;
    if (user.blocked) return false;
    if (user.marketingOptOut) return false;
    if (!EMAIL_RE.test(email)) return false;
    return true;
  }

  /** Хэрэглэгч тухайн coupon-ийг PAID захиалгад аль хэдийн ашигласан эсэх. */
  private async userUsedCoupon(userId: string, code: string): Promise<boolean> {
    const found = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.PAID,
        OR: [
          { couponCode: { equals: code } },
          { couponCode: { startsWith: `${code},` } },
          { couponCode: { endsWith: `,${code}` } },
          { couponCode: { contains: `,${code},` } },
        ],
      },
      select: { id: true },
    });
    return !!found;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Цаг тутмын automation: 1) Cart abandonment 2) Discount push 3) Expiring coupon
  // ─────────────────────────────────────────────────────────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async hourlyMarketing() {
    await this.runCartAbandonment().catch((e) =>
      this.logger.error(`Cart abandonment cron failed: ${e?.message ?? e}`),
    );
    await this.runDiscountPush().catch((e) =>
      this.logger.error(`Discount push cron failed: ${e?.message ?? e}`),
    );
    await this.runExpiringCoupon().catch((e) =>
      this.logger.error(`Expiring coupon cron failed: ${e?.message ?? e}`),
    );
  }

  /**
   * 1. Cart abandonment (1ц): PENDING захиалга үүсээд 1-2 цаг болсон, эхний
   *    сануулга явуулаагүй (reminderSentAt=null) хэрэглэгчид сануулга явуулна.
   */
  private async runCartAbandonment() {
    const now = Date.now();
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        createdAt: { gte: new Date(now - 2 * HOUR), lt: new Date(now - 1 * HOUR) },
        reminderSentAt: null,
      },
      include: {
        user: {
          select: { email: true, name: true, isGuest: true, blocked: true, marketingOptOut: true },
        },
        items: { include: { product: { select: { title: true } } } },
      },
    });

    let sent = 0;
    for (const order of orders) {
      try {
        if (this.canSendMarketing(order.user)) {
          this.email.sendCartReminder({
            to: order.user.email as string,
            name: order.user.name ?? null,
            orderId: order.id,
            items: order.items.map((it) => ({
              title: it.product?.title ?? 'Бүтээгдэхүүн',
              price: Number(it.price),
            })),
            total: Number(order.total),
          });
          // In-app мэдэгдэл (navbar 🔔) — сагсаа дуусгаагүй сануулга. Fire-and-forget.
          this.notifications
            .create(order.userId, {
              title: 'Сагсаа дуусгаарай',
              body: 'Танд дуусгаагүй захиалга байна. Худалдан авалтаа үргэлжлүүлээрэй.',
              type: 'order',
              link: '/checkout',
            })
            .catch(() => null);
          sent++;
        }
      } catch (e: any) {
        this.logger.error(`Cart reminder failed (order=${order.id}): ${e?.message ?? e}`);
      } finally {
        // Явуулсан эсэхээс үл хамаарч тэмдэглэнэ — давхар оролдохгүй.
        await this.prisma.order
          .update({ where: { id: order.id }, data: { reminderSentAt: new Date() } })
          .catch(() => {});
      }
    }

    if (orders.length > 0) {
      this.logger.log(`Cart abandonment: processed ${orders.length}, sent ${sent}`);
    }
  }

  /**
   * 2. Discount push (24ц): PENDING хэвээр (одоо ч аваагүй), үүсээд 24-25 цаг
   *    болсон, эхний сануулга явсан (reminderSentAt NOT null), discount push
   *    явуулаагүй (discountPushSentAt=null) захиалгад 10% coupon follow-up.
   */
  private async runDiscountPush() {
    const now = Date.now();
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        createdAt: { gte: new Date(now - 25 * HOUR), lt: new Date(now - 24 * HOUR) },
        discountPushSentAt: null,
        reminderSentAt: { not: null },
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, isGuest: true, blocked: true, marketingOptOut: true },
        },
      },
    });

    let sent = 0;
    for (const order of orders) {
      try {
        // ⚠️ Хэрэглэгч энэ coupon-ийг аль хэдийн ашигласан (PAID) бол дахин coupon
        // явуулахгүй (өмнө аваад худалдсан хэрэглэгчид давхар бэлэглэхгүй).
        const usedCoupon = await this.userUsedCoupon(order.user.id, PUBLIC_COUPON_CODE);
        if (this.canSendMarketing(order.user) && !usedCoupon) {
          this.email.sendDiscountPush({
            to: order.user.email as string,
            name: order.user.name ?? null,
            orderId: order.id,
            couponCode: PUBLIC_COUPON_CODE,
            discountPercent: PUBLIC_COUPON_PERCENT,
          });
          // In-app мэдэгдэл (navbar 🔔) — хөнгөлөлтийн coupon. Fire-and-forget.
          this.notifications
            .create(order.user.id, {
              title: 'Танд хөнгөлөлт байна',
              body: `${PUBLIC_COUPON_PERCENT}% хөнгөлөлт авах "${PUBLIC_COUPON_CODE}" код таныг хүлээж байна.`,
              type: 'coupon',
              link: '/checkout',
            })
            .catch(() => null);
          sent++;
        }
      } catch (e: any) {
        this.logger.error(`Discount push failed (order=${order.id}): ${e?.message ?? e}`);
      } finally {
        await this.prisma.order
          .update({ where: { id: order.id }, data: { discountPushSentAt: new Date() } })
          .catch(() => {});
      }
    }

    if (orders.length > 0) {
      this.logger.log(`Discount push: processed ${orders.length}, sent ${sent}`);
    }
  }

  /**
   * 3. Expiring coupon (12ц өмнө): active coupon дуусахаас 0-12 цагийн дотор
   *    байгаа бол ACTIVE subscriber-уудад сануулна. Тухайн coupon-ийг аль
   *    хэдийн ашиглаж PAID болгосон хэрэглэгчдийн email-ийг хасна.
   */
  private async runExpiringCoupon() {
    const now = Date.now();
    const coupons = await this.prisma.coupon.findMany({
      where: {
        active: true,
        expiresAt: { gt: new Date(now), lte: new Date(now + 12 * HOUR) },
        reminderSentAt: null,
      },
    });

    for (const coupon of coupons) {
      try {
        // Тухайн coupon-ийг ашиглаж ХУДАЛДАН АВСАН (PAID) хэрэглэгчдийн email-ийг хасна.
        const usedOrders = await this.prisma.order.findMany({
          where: {
            status: OrderStatus.PAID,
            couponCode: { contains: coupon.code },
          },
          select: { user: { select: { email: true } } },
        });
        const usedEmails = new Set(
          usedOrders
            .map((o) => (o.user?.email ?? '').trim().toLowerCase())
            .filter(Boolean),
        );

        // ACTIVE subscriber бүрд (coupon ашиглах эрх шилдсэн) явуулна.
        const subscribers = await this.prisma.subscriber.findMany({
          where: { status: SubscriberStatus.ACTIVE },
          select: { email: true, firstName: true },
        });

        const discountLabel =
          coupon.type === CouponType.PERCENT
            ? `${Number(coupon.value)}% хөнгөлөлт`
            : `${Number(coupon.value)}₮ хөнгөлөлт`;

        let sent = 0;
        for (const sub of subscribers) {
          const email = (sub.email ?? '').trim().toLowerCase();
          if (!email) continue;
          // Зочин/хуурамч/ашигласан хэрэглэгчдийг шүүх.
          if (email.endsWith('@guest.digitalger.mn')) continue;
          if (!EMAIL_RE.test(email)) continue;
          if (usedEmails.has(email)) continue;
          try {
            this.email.sendExpiringCoupon({
              to: sub.email,
              name: null,
              couponCode: coupon.code,
              discountLabel,
              expiresAt: coupon.expiresAt as Date,
              couponId: coupon.id,
            });
            // ⚠️ In-app мэдэгдэл ЭНД нэмэхгүй — энэ нь БҮХ active subscriber-т
            // (email-ээр, userId-гүй) масс илгээдэг тул хэт олон мэдэгдэл (спам)
            // болохоос сэргийлж зөвхөн имэйлээр үлдээв.
            sent++;
          } catch (e: any) {
            this.logger.error(
              `Expiring coupon send failed (coupon=${coupon.code}, email=${email}): ${e?.message ?? e}`,
            );
          }
        }

        this.logger.log(
          `Expiring coupon ${coupon.code}: subscribers ${subscribers.length}, excluded ${usedEmails.size} used, sent ${sent}`,
        );
      } catch (e: any) {
        this.logger.error(`Expiring coupon failed (coupon=${coupon.code}): ${e?.message ?? e}`);
      } finally {
        // Нэг удаа л тэмдэглэнэ.
        await this.prisma.coupon
          .update({ where: { id: coupon.id }, data: { reminderSentAt: new Date() } })
          .catch(() => {});
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Өдөр тутам 10:00 — Reactivation (30 хоног идэвхгүй хэрэглэгч)
  // ─────────────────────────────────────────────────────────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async dailyReactivation() {
    try {
      const now = Date.now();
      const thirtyDaysAgo = new Date(now - 30 * DAY);

      const users = await this.prisma.user.findMany({
        where: {
          isGuest: false,
          blocked: false,
          marketingOptOut: false,
          reactivationSentAt: null,
          emailVerified: { not: null },
          // Шинэ хэрэглэгч биш (30 хоногоос өмнө бүртгүүлсэн)
          createdAt: { lt: thirtyDaysAgo },
          // 30 хоног захиалга хийгээгүй
          AND: [
            { OR: [{ lastOrderAt: { lt: thirtyDaysAgo } }, { lastOrderAt: null }] },
            // 30 хоног нэвтрээгүй
            { OR: [{ lastLoginAt: { lt: thirtyDaysAgo } }, { lastLoginAt: null }] },
          ],
        },
        select: {
          id: true,
          email: true,
          name: true,
          isGuest: true,
          blocked: true,
          marketingOptOut: true,
        },
        take: REACTIVATION_BATCH,
        orderBy: { createdAt: 'asc' },
      });

      let sent = 0;
      for (const user of users) {
        try {
          if (this.canSendMarketing(user)) {
            // ТУСДАА coupon (WELCOMEBACK10) — SUBSCRIBER10-ийг өмнө ашигласан байж
            // болзошгүй тул дахин ашиглаж болохуйц шинэ кодоор буцаан татна.
            this.email.sendReactivation({
              to: user.email,
              name: user.name ?? null,
              couponCode: REACTIVATION_COUPON_CODE,
              discountLabel: REACTIVATION_COUPON_LABEL,
            });
            // In-app мэдэгдэл (navbar 🔔) — буцаан татах coupon. Fire-and-forget.
            this.notifications
              .create(user.id, {
                title: 'Таныг санаж байна',
                body: `Эргэн тавтай морил! "${REACTIVATION_COUPON_CODE}" кодоор ${REACTIVATION_COUPON_LABEL} аваарай.`,
                type: 'coupon',
                link: '/products',
              })
              .catch(() => null);
            sent++;
          }
        } catch (e: any) {
          this.logger.error(`Reactivation send failed (user=${user.id}): ${e?.message ?? e}`);
        } finally {
          await this.prisma.user
            .update({ where: { id: user.id }, data: { reactivationSentAt: new Date() } })
            .catch(() => {});
        }
      }

      if (users.length > 0) {
        this.logger.log(`Reactivation: processed ${users.length}, sent ${sent}`);
      }
    } catch (e: any) {
      this.logger.error(`Reactivation cron failed: ${e?.message ?? e}`);
    }
  }
}
