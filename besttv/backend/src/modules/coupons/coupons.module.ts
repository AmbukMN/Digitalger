import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { DiscountType, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class CouponDto {
  @IsString()
  code: string;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class ValidateCouponDto {
  @IsString()
  code: string;

  @IsInt()
  @Min(0)
  price: number;
}

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(private readonly prisma: PrismaService) {}

  adminList() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(dto: CouponDto) {
    const code = dto.code.toUpperCase().trim();
    const exists = await this.prisma.coupon.findUnique({ where: { code } });
    if (exists) throw new BadRequestException('Энэ код аль хэдийн бүртгэлтэй байна');

    return this.prisma.coupon.create({
      data: {
        code,
        discountType: dto.discountType,
        amount: dto.amount,
        maxUses: dto.maxUses,
        minPrice: dto.minPrice ?? 0,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: Partial<CouponDto>) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Купон олдсонгүй');
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code.toUpperCase().trim() } : {}),
        ...(dto.discountType ? { discountType: dto.discountType } : {}),
        ...(dto.amount != null ? { amount: dto.amount } : {}),
        ...(dto.maxUses !== undefined ? { maxUses: dto.maxUses } : {}),
        ...(dto.minPrice != null ? { minPrice: dto.minPrice } : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
          : {}),
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: string) {
    // ⚠️ `.catch(() => null)` БАЙХГҮЙ — алдаа нуувал хэрэглэгч "устгагдлаа"
    // гэсэн мэдэгдэл авах мөртлөө мөр хэвээр үлдэж эргэлздэг
    const exists = await this.prisma.coupon.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Купон олдсонгүй');
    await this.prisma.coupon.delete({ where: { id } });
    return { ok: true };
  }

  /** Хямдрал тооцох (захиалга vvсгэхээс өмнө frontend талд шалгахад) — ашиглалт
   * ЗӨВХӨН энд нэмэгддэггvй, бодит incrementUse нь payment амжилттай болоход дуудагдана. */
  async validate(dto: ValidateCouponDto) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: dto.code.toUpperCase().trim() } });
    if (!coupon || !coupon.isActive) throw new BadRequestException('Хvчингvй купон код байна');
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException('Купон хугацаа дууссан байна');
    }
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Купон дvvрсэн байна');
    }
    if (dto.price < coupon.minPrice) {
      throw new BadRequestException(`Хамгийн бага дvн ${coupon.minPrice}₮`);
    }

    const discount =
      coupon.discountType === 'PERCENT'
        ? Math.round((dto.price * coupon.amount) / 100)
        : Math.min(coupon.amount, dto.price);
    const finalPrice = Math.max(0, dto.price - discount);

    return { valid: true, discount, finalPrice, discountType: coupon.discountType, amount: coupon.amount };
  }

  /**
   * Payments service дотроос дуудагдана (нэг удаагийн зарцуулалт бvртгэх).
   *
   * ⚠️ updateMany + maxUses нөхцөл — олон төлбөр ЗЭРЭГ баталгаажихад (webhook +
   * polling + reconcile) usedCount нь maxUses-аас ХЭТЭРЧ болохгvй. Нөхцөл нь
   * DB тvвшинд шалгагдаж атомар инкремент хийгдэнэ.
   */
  async incrementUse(code: string) {
    const normalized = code.toUpperCase().trim();
    const res = await this.prisma.coupon
      .updateMany({
        where: {
          code: normalized,
          OR: [{ maxUses: null }, { usedCount: { lt: this.prisma.coupon.fields.maxUses } }],
        },
        data: { usedCount: { increment: 1 } },
      })
      .catch(() => null);

    if (!res || res.count === 0) {
      // Хязгаар дvvрсэн ч төлбөр аль хэдийн хийгдсэн тул эрхийг vгvйсгэхгvй —
      // зөвхөн бvртгэнэ (админ хожим шалгах боломжтой).
      this.logger.warn(`Купон "${normalized}" ашиглалт нэмэгдсэнгvй (хязгаар дvvрсэн байж болзошгvй)`);
    }
  }
}

@Controller('coupons')
export class CouponsController {
  constructor(private readonly svc: CouponsService) {}

  /**
   * ⚠️ Rate limit ЗААВАЛ — купоны код нь богино тэмдэгт (ж: "ZUN2026") тул
   * хязгааргүй бол скриптээр таах боломжтой. Минутад 15 нь хүн гараар
   * оролдоход хангалттай, автомат таалтад хангалтгүй.
   */
  @Post('validate')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  validate(@Body() dto: ValidateCouponDto) {
    return this.svc.validate(dto);
  }
}

@Controller('admin/coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class CouponsAdminController {
  constructor(private readonly svc: CouponsService) {}

  @Get()
  list() {
    return this.svc.adminList();
  }

  @Post()
  create(@Body() dto: CouponDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CouponDto>) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

@Module({
  controllers: [CouponsController, CouponsAdminController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
