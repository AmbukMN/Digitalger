import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { EmailService } from '../notifications/email.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { computeOrderExpiresAt, isActiveOrder } from '../../common/access-expiry';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly email: EmailService,
  ) {}

  async findUserOrders(userId: string, page = 1, pageSize = 20) {
    const skip = (Math.max(1, page) - 1) * pageSize;

    const where: Prisma.OrderWhereInput = { userId };

    const [rawItems, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  compareAtPrice: true,
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                    select: { fileKey: true, variants: { select: { size: true, fileKey: true }, where: { size: 'thumbnail' }, take: 1 } },
                  },
                },
              },
            },
          },
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    const items = rawItems.map((order) => ({
      ...order,
      items: order.items.map((item) => {
        const { images, ...productRest } = item.product as any;
        return {
          ...item,
          product: {
            ...productRest,
            thumbnailUrl: images?.[0]
              ? this.storage.getAssetUrl(images[0].variants?.[0]?.fileKey ?? images[0].fileKey)
              : null,
          },
        };
      }),
    }));

    return { items, total, page, pageSize };
  }

  async createPending(userId: string, dto: CreateOrderDto) {
    const requestedIds = [...new Set(dto.productIds)]; // deduplicate input

    // ── Аль хэдийн эзэмшсэн (PAID + идэвхтэй) бүтээгдэхүүнийг хасах ──────────────
    // ⚠️ Нэг хэрэглэгч нэг бүтээгдэхүүнийг ЗӨВХӨН НЭГ УДАА авна. Аль хэдийн PAID
    // болж, хандалт нь ИДЭВХТЭЙ (expiresAt null эсвэл ирээдүйд) бол дахин захиалахыг
    // зөвшөөрөхгүй. Хугацаа дууссан (expired) эрхийг л дахин худалдаж авч болно.
    const paidOrders = await this.prisma.order.findMany({
      where: {
        userId,
        status: OrderStatus.PAID,
        items: { some: { productId: { in: requestedIds } } },
      },
      select: {
        expiresAt: true,
        items: { select: { productId: true } },
      },
    });
    const activeOwnedIds = new Set<string>();
    for (const o of paidOrders) {
      if (!isActiveOrder(o)) continue; // зөвхөн идэвхтэй эзэмшил давхардал болно
      for (const it of o.items) {
        if (requestedIds.includes(it.productId)) activeOwnedIds.add(it.productId);
      }
    }
    // Эзэмшсэнийг хасч зөвхөн ШИНЭ бүтээгдэхүүнийг үлдээнэ (cart-д хэсэгчилсэн
    // эзэмшил байж болно — эзэмшсэнийг чимээгүй хасна, бусдыг үргэлжлүүлнэ).
    const productIds = requestedIds.filter((id) => !activeOwnedIds.has(id));
    if (productIds.length === 0) {
      throw new BadRequestException(
        'Та эдгээр бүтээгдэхүүнийг аль хэдийн худалдаж авсан байна',
      );
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        published: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products are unavailable');
    }

    // ── Duplicate guard ────────────────────────────────────────────────────────
    // If this user already has a PENDING order that contains exactly these
    // products (no more, no less), return that order instead of creating a new one.
    const existingPending = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.PENDING,
        items: {
          every: { productId: { in: productIds } },
        },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    });

    if (existingPending) {
      // Verify exact match (same count of items)
      if (existingPending.items.length === productIds.length) {
        return { ...existingPending, _reused: true };
      }
    }

    const subtotal = products.reduce(
      (sum, p) => sum.add(p.price),
      new Prisma.Decimal(0),
    );

    // Apply coupons if provided
    let discountAmount = new Prisma.Decimal(0);
    const appliedCoupons: any[] = [];
    const codes = (dto.couponCodes ?? [])
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length > 0);
    const seen = new Set<string>();

    for (const code of codes) {
      if (seen.has(code)) continue;
      seen.add(code);
      const coupon = await this.prisma.coupon.findFirst({ where: { code } });
      if (
        !coupon ||
        !coupon.active ||
        (coupon.expiresAt && coupon.expiresAt <= new Date()) ||
        (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) ||
        (coupon.minPrice != null && subtotal.lt(coupon.minPrice))
      ) {
        continue;
      }

      // ⚠️ Нэг хэрэглэгч нэг купоныг ЗӨВХӨН НЭГ УДАА (бүх бүтээгдэхүүн дээр).
      // Зөвхөн PAID захиалгыг тооцно (PENDING нь төлөгдөөгүй тул хязгаарлахгүй).
      const alreadyUsed = await this.prisma.order.findFirst({
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
      });
      if (alreadyUsed) continue;

      const val = new Prisma.Decimal(coupon.value);
      const disc =
        coupon.type === 'PERCENT'
          ? subtotal.mul(val).div(100).toDecimalPlaces(2)
          : val;
      discountAmount = discountAmount.add(disc);
      appliedCoupons.push(coupon);
    }

    // Cap discount so total never goes below 0
    discountAmount = Prisma.Decimal.min(discountAmount, subtotal);
    const total = subtotal.sub(discountAmount);
    const isFree = total.isZero();
    const appliedCouponCodes = appliedCoupons.map((c) => c.code).join(',') || undefined;

    // Free order шууд PAID болох тул хандалтын хугацааг (expiresAt) энд тооцно.
    // Аль нэг бүтээгдэхүүн LIFETIME бол null (насан туршийн), бүгд DAYS бол MAX.
    const freePaidAt = isFree ? new Date() : null;
    const freeExpiresAt = isFree ? computeOrderExpiresAt(products, freePaidAt!) : null;

    const order = await this.prisma.order.create({
      data: {
        userId,
        total,
        // If total is 0, immediately mark as PAID (free order — no payment needed)
        status: isFree ? OrderStatus.PAID : OrderStatus.PENDING,
        ...(isFree && { paidAt: freePaidAt, expiresAt: freeExpiresAt }),
        couponCode: appliedCouponCodes,
        items: {
          create: products.map((p) => ({
            productId: p.id,
            price: p.price,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    });

    // usedCount-ийг CONDITIONAL increment — зэрэг (concurrent) 2 захиалга
    // maxUses хязгаараас давахаас сэргийлнэ. updateMany нь where нөхцөл
    // (usedCount < maxUses) хангагдсан үед Л increment хийнэ (атомик).
    if (appliedCoupons.length > 0) {
      await Promise.all(
        appliedCoupons.map((c) =>
          c.maxUses != null
            ? this.prisma.coupon.updateMany({
                where: { id: c.id, usedCount: { lt: c.maxUses } },
                data: { usedCount: { increment: 1 } },
              })
            : this.prisma.coupon.update({
                where: { id: c.id },
                data: { usedCount: { increment: 1 } },
              }),
        ),
      );
    }

    // Free order → send confirmation immediately
    if (isFree) {
      // Үнэгүй захиалга шууд PAID болсон тул User.lastOrderAt-г шинэчилнэ
      // (маркетингийн сегмент). Fire-and-forget — захиалгад саад болохгүй.
      this.prisma.user
        .update({ where: { id: userId }, data: { lastOrderAt: new Date() } })
        .catch(() => null);
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      if (user?.email) {
        this.email.sendOrderConfirmation({
          to: user.email,
          name: user.name,
          orderId: order.id,
          items: order.items.map((i) => ({ title: i.product.title, price: Number(i.price) })),
          total: Number(order.total),
          couponCode: order.couponCode,
        }).catch(() => null);
      }
    }

    return order;
  }

  async cancelOrder(orderId: string, userId: string) {
    // Цуцлах имэйлд items + user хэрэгтэй тул багцтай нь авна.
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: { include: { product: { select: { title: true } } } },
        user: { select: { email: true, name: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Зөвхөн хүлээгдэж буй захиалгыг цуцалж болно');
    }
    // Order CANCELLED болохдоо холбоотой PENDING Payment-уудыг → FAILED болгоно
    // (нэг захиалга 2 өөр статустай болохоос сэргийлнэ). Атомик транзакц.
    const [cancelled] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        // Цуцлалтын эх сурвалж: хэрэглэгч өөрөө цуцалсан (admin UI ялгаж харуулна).
        data: { status: OrderStatus.CANCELLED, cancelledBy: 'USER', cancelledAt: new Date() },
      }),
      this.prisma.payment.updateMany({
        where: { orderId, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED },
      }),
    ]);
    // Захиалгад хэрэглэсэн купоны usedCount-ийг буцаана — эс бол цуцалсан
    // захиалгын купон "хэрэглэгдсэн" хэвээр үлдэж maxUses-д буруу хүрнэ.
    await this.releaseOrderCoupons(order.couponCode);

    // Хэрэглэгч өөрөө цуцалсан тухай имэйл мэдэгдэл (invalid/guest хаягт явахгүй).
    // Fire-and-forget — цуцлалтад саад болохгүй.
    if (order.user?.email) {
      this.email
        .sendOrderCancelled({
          to: order.user.email,
          name: order.user.name,
          orderId: order.id,
          items: order.items.map((i) => ({ title: i.product.title, price: Number(i.price) })),
          total: Number(order.total),
          reason: 'user',
        })
        .catch(() => null);
    }
    return cancelled;
  }

  /** Захиалгын couponCode дотор бичигдсэн купонуудын usedCount-ийг decrement
   * хийнэ (захиалга цуцлах/устгахад дуудна). 0-ээс доош буурахгүй. */
  private async releaseOrderCoupons(couponCode: string | null | undefined) {
    if (!couponCode) return;
    const codes = couponCode.split(',').map((c) => c.trim()).filter(Boolean);
    if (!codes.length) return;
    await Promise.all(
      codes.map((code) =>
        this.prisma.coupon.updateMany({
          where: { code, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        }),
      ),
    );
  }

  async findById(id: string, userId?: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        ...(userId && { userId }),
      },
      include: {
        items: { include: { product: true } },
        payments: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async markPaid(orderId: string, qpayIdentifier?: string) {
    // Хандалтын хугацаа (expiresAt) тооцно — бүтээгдэхүүний accessType-аас хамаарч.
    const paidAt = new Date();
    const orderItems = await this.prisma.orderItem.findMany({
      where: { orderId },
      select: { product: { select: { accessType: true, accessDays: true } } },
    });
    const expiresAt = computeOrderExpiresAt(
      orderItems.map((i) => i.product),
      paidAt,
    );

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PAID,
        paidAt,
        expiresAt,
        ...(qpayIdentifier && { qpayIdentifier }),
      },
      include: {
        user: { select: { email: true, name: true } },
        items: { include: { product: { select: { title: true } } } },
      },
    });

    if (order.user?.email) {
      this.email.sendPaymentConfirmation({
        to: order.user.email,
        name: order.user.name,
        orderId: order.id,
        total: Number(order.total),
        items: order.items.map((i) => ({ title: i.product.title, price: Number(i.price) })),
      }).catch(() => null);
    }

    return order;
  }
}
