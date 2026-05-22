import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
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
                    select: { fileKey: true },
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
            thumbnailUrl: images?.[0]?.fileKey ? this.storage.getAssetUrl(images[0].fileKey) : null,
          },
        };
      }),
    }));

    return { items, total, page, pageSize };
  }

  async createPending(userId: string, dto: CreateOrderDto) {
    const productIds = [...new Set(dto.productIds)]; // deduplicate input

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

      // Per-user-per-product: skip if this user already used this coupon on any of these products
      const alreadyUsed = await this.prisma.order.findFirst({
        where: {
          userId,
          status: { in: [OrderStatus.PAID, OrderStatus.PENDING] },
          items: { some: { productId: { in: productIds } } },
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

    const order = await this.prisma.order.create({
      data: {
        userId,
        total,
        // If total is 0, immediately mark as PAID (free order — no payment needed)
        status: isFree ? OrderStatus.PAID : OrderStatus.PENDING,
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

    // Increment usedCount for all applied coupons
    if (appliedCoupons.length > 0) {
      await Promise.all(
        appliedCoupons.map((c) =>
          this.prisma.coupon.update({
            where: { id: c.id },
            data: { usedCount: { increment: 1 } },
          }),
        ),
      );
    }

    return order;
  }

  async cancelOrder(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Зөвхөн хүлээгдэж буй захиалгыг цуцалж болно');
    }
    return this.prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } });
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
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PAID,
        ...(qpayIdentifier && { qpayIdentifier }),
      },
    });
  }
}
