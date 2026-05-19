import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  generateCode(length = 12): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async findAll() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Купон олдсонгүй');
    return coupon;
  }

  async create(dto: {
    code?: string;
    type: 'PERCENT' | 'FIXED';
    value: number;
    minPrice?: number;
    maxUses?: number;
    active?: boolean;
    expiresAt?: string | null;
  }) {
    const code = dto.code?.trim().toUpperCase() || this.generateCode();

    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) throw new BadRequestException('Купон код давхцаж байна');

    return this.prisma.coupon.create({
      data: {
        code,
        type: dto.type as any,
        value: new Prisma.Decimal(dto.value),
        minPrice: dto.minPrice != null ? new Prisma.Decimal(dto.minPrice) : null,
        maxUses: dto.maxUses ?? null,
        active: dto.active ?? true,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async update(
    id: string,
    dto: Partial<{
      code: string;
      type: 'PERCENT' | 'FIXED';
      value: number;
      minPrice: number | null;
      maxUses: number | null;
      active: boolean;
      expiresAt: string | null;
    }>,
  ) {
    await this.findOne(id);

    if (dto.code) {
      const conflict = await this.prisma.coupon.findFirst({
        where: { code: dto.code.trim().toUpperCase(), NOT: { id } },
      });
      if (conflict) throw new BadRequestException('Купон код давхцаж байна');
    }

    const data: Record<string, unknown> = {};
    if (dto.code !== undefined) data.code = dto.code.trim().toUpperCase();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.value !== undefined) data.value = new Prisma.Decimal(dto.value);
    if ('minPrice' in dto) data.minPrice = dto.minPrice != null ? new Prisma.Decimal(dto.minPrice) : null;
    if ('maxUses' in dto) data.maxUses = dto.maxUses;
    if (dto.active !== undefined) data.active = dto.active;
    if ('expiresAt' in dto) data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    return this.prisma.coupon.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.coupon.delete({ where: { id } });
  }

  async validate(
    code: string,
    price: number,
    userId?: string,
    productIds?: string[],
  ): Promise<{
    valid: boolean;
    code: string;
    type: string;
    value: number;
    discount: number;
    finalPrice: number;
    message?: string;
  }> {
    const normalizedCode = code.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findFirst({
      where: { code: normalizedCode },
    });

    if (!coupon) {
      return { valid: false, code: normalizedCode, type: '', value: 0, discount: 0, finalPrice: price, message: 'Купон код буруу байна' };
    }
    if (!coupon.active) {
      return { valid: false, code: normalizedCode, type: '', value: 0, discount: 0, finalPrice: price, message: 'Купон идэвхгүй байна' };
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return { valid: false, code: normalizedCode, type: '', value: 0, discount: 0, finalPrice: price, message: 'Купоны хугацаа дууссан' };
    }
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, code: normalizedCode, type: '', value: 0, discount: 0, finalPrice: price, message: 'Купон ашиглах хязгаарт хүрсэн' };
    }
    if (coupon.minPrice != null && price < Number(coupon.minPrice)) {
      return {
        valid: false,
        code: normalizedCode,
        type: coupon.type,
        value: Number(coupon.value),
        discount: 0,
        finalPrice: price,
        message: `Купон хэрэглэхийн тулд дүн ${Number(coupon.minPrice).toLocaleString()}₮-с дээш байх шаардлагатай`,
      };
    }

    // Per-user-per-product check: one specific coupon per user per product
    if (userId && productIds && productIds.length > 0) {
      const alreadyUsed = await this.prisma.order.findFirst({
        where: {
          userId,
          status: { in: [OrderStatus.PAID, OrderStatus.PENDING] },
          items: { some: { productId: { in: productIds } } },
          OR: [
            { couponCode: { equals: normalizedCode } },
            { couponCode: { startsWith: `${normalizedCode},` } },
            { couponCode: { endsWith: `,${normalizedCode}` } },
            { couponCode: { contains: `,${normalizedCode},` } },
          ],
        },
      });
      if (alreadyUsed) {
        return {
          valid: false,
          code: normalizedCode,
          type: coupon.type,
          value: Number(coupon.value),
          discount: 0,
          finalPrice: price,
          message: 'Та энэ купоныг аль хэдийн ашигласан байна',
        };
      }
    }

    const val = Number(coupon.value);
    const discount =
      coupon.type === 'PERCENT'
        ? Math.round(price * (val / 100))
        : Math.min(val, price);
    const finalPrice = Math.max(0, price - discount);

    return {
      valid: true,
      code: coupon.code,
      type: coupon.type,
      value: val,
      discount,
      finalPrice,
    };
  }
}
