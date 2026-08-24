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
  Query,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { DiscountType, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';

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

  /**
   * ⚠️⚠️ ХУВИЙН КУПОНЫГ ЯЛГАЖ ХАРУУЛНА.
   *
   * Автомат имэйл (re-engagement) нь хүн бүрд `BTV4A9F2C` маягийн
   * ӨӨР код үүсгэдэг. Эзнийг нь харуулахгүй бол админ жагсаалтад
   * зуу зуун ойлгомжгүй код хуримтлагдаж, аль нь хэнийх, яагаад
   * үүссэн нь мэдэгдэхгүй болно.
   */
  /**
   * Server талын хуудаслалт + хайлт + төлөв шүүлт.
   *
   * ⚠️ Хувийн купон автоматаар үүсдэг тул хэдэн мянга болно — client-д
   * бүгдийг татаж шүүх нь боломжгүй. Хуудаслалт, хайлт, шүүлтийг ЭНД хийнэ.
   */
  async adminList(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'live' | 'expired' | 'used-up' | 'off';
  } = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const search = (params.search ?? '').trim();
    const now = new Date();

    const where: Prisma.CouponWhereInput = {};

    if (search) {
      /* ⚠️ Код, эзний имэйл/нэр, кампанит ажлаар хайна */
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { campaign: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    /* ⚠️ Төлөв нь тооцоолсон утга — isActive + expiresAt + usedCount/maxUses.
       Frontend statusOf-той ЯГ ижил логик (нэг suvag зөв, нөгөө буруу
       болохоос сэргийлнэ). */
    if (params.status === 'off') {
      where.isActive = false;
    } else if (params.status === 'expired') {
      where.isActive = true;
      where.expiresAt = { not: null, lt: now };
    } else if (params.status === 'used-up') {
      /* ⚠️ maxUses != null БА usedCount >= maxUses — Prisma талбар
         харьцуулалт дэмждэггүй тул raw filter ашиглана */
      where.isActive = true;
      where.maxUses = { not: null };
      where.usedCount = { gte: this.prisma.coupon.fields.maxUses };
    } else if (params.status === 'live') {
      where.isActive = true;
      where.OR = where.OR
        ? undefined // search-тэй давхцахаас сэргийлж доор AND-д хийнэ
        : undefined;
      where.AND = [
        { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
        {
          OR: [
            { maxUses: null },
            { usedCount: { lt: this.prisma.coupon.fields.maxUses } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * ⚠️⚠️ PERCENT нь 1-100 байх ЁСТОЙ.
   *
   * `@Max` декоратор нь `discountType`-аас хамаарсан шалгалт хийж
   * чаддаггүй (FIXED купон 50,000₮ байж БОЛНО). Тиймээс энд шалгана.
   */
  private assertValidAmount(discountType: DiscountType | undefined, amount: number | undefined) {
    if (discountType !== 'PERCENT' || amount == null) return;
    if (amount < 1 || amount > 100) {
      throw new BadRequestException('Хувиар хөнгөлөх купон 1-100 хооронд байна');
    }
  }

  async create(dto: CouponDto) {
    this.assertValidAmount(dto.discountType, dto.amount);
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
    /**
     * ⚠️ Хэсэгчилсэн засварт ЭЦСИЙН утгаар шалгана — админ зөвхөн
     * `discountType`-ыг FIXED→PERCENT болговол хуучин `amount`
     * (ж: 50000) хэвээр үлдэж 500 дахин хөнгөлөлт өгнө.
     */
    this.assertValidAmount(
      dto.discountType ?? coupon.discountType,
      dto.amount ?? coupon.amount,
    );
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

  /** Хямдрал тооцох (захиалга vүсгэхээс өмнө frontend талд шалгахад) — ашиглалт
   * ЗӨВХӨН энд нэмэгддэггүй, бодит incrementUse нь payment амжилттай болоход дуудагдана. */
  async validate(dto: ValidateCouponDto, userId?: string | null) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: dto.code.toUpperCase().trim() } });
    if (!coupon || !coupon.isActive) throw new BadRequestException('Хүчингүй купон код байна');
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException('Купон хугацаа дууссан байна');
    }

    /**
     * ⚠️⚠️ ХУВИЙН КУПОН — ЗӨВХӨН ЭЗЭН НЬ АШИГЛАНА.
     *
     * Re-engagement имэйлээр олгосон код (`Coupon.userId` утгатай) нь
     * тухайн НЭГ хүнд зориулагдсан. Шалгахгүй бол хэрэглэгч кодоо
     * Facebook бүлэгт тавьж, мянган хүн ашиглана — захиалгын бизнест
     * шууд алдагдал. Яг үүнээс сэргийлэхийн тулд хувийн код руу
     * шилжсэн тул энэ шалгалт нь тэр бүтэн санааны ТУЛГУУР.
     *
     * ⚠️ Тодорхой мессеж өгөхгүй — «энэ код өөр хүнийх» гэвэл кодыг
     * таамаглаж буй хүнд «энэ код БАЙНА» гэдгийг баталж өгнө.
     */
    if (coupon.userId && coupon.userId !== userId) {
      throw new BadRequestException('Хүчингүй купон код байна');
    }
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Купон дүүрсэн байна');
    }
    if (dto.price < coupon.minPrice) {
      throw new BadRequestException(`Хамгийн бага дүн ${coupon.minPrice}₮`);
    }

    /**
     * ⚠️⚠️ PERCENT-ийг 100-аар ТАСЛАНА (хоёр дахь хамгаалалт).
     *
     * БОДИТ ЭРСДЭЛ: `amount = 500` бүхий PERCENT купон үүсвэл
     * `discount = price × 5` болж `finalPrice = 0` гарна. Тэгвэл
     * `payments.service` нь `amount <= 0` салаагаар QPay-г ОГТ
     * дуудахгүй шууд `completePayment` хийж, багцыг ҮНЭГҮЙ нээнэ.
     *
     * DTO-д `@Max(100)` нэмсэн ч ӨМНӨ НЬ үүссэн буруу купон DB-д
     * үлдсэн байж болзошгүй тул тооцооны үед ч хамгаална.
     */
    const pct = Math.min(100, Math.max(0, coupon.amount));
    const discount =
      coupon.discountType === 'PERCENT'
        ? Math.round((dto.price * pct) / 100)
        : Math.min(coupon.amount, dto.price);
    const finalPrice = Math.max(0, dto.price - discount);

    /* ⚠️ `minPrice` ЗААВАЛ буцаана — frontend нь багц бүрд тусад нь
       шалгах ёстой (хямд багцад купон хүчингүй байж болно) */
    return {
      valid: true,
      discount,
      finalPrice,
      discountType: coupon.discountType,
      amount: coupon.amount,
      minPrice: coupon.minPrice,
    };
  }

  /**
   * Payments service дотроос дуудагдана (нэг удаагийн зарцуулалт бүртгэх).
   *
   * ⚠️ updateMany + maxUses нөхцөл — олон төлбөр ЗЭРЭГ баталгаажихад (webhook +
   * polling + reconcile) usedCount нь maxUses-аас ХЭТЭРЧ болохгүй. Нөхцөл нь
   * DB түвшинд шалгагдаж атомар инкремент хийгдэнэ.
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
      // Хязгаар дүүрсэн ч төлбөр аль хэдийн хийгдсэн тул эрхийг үгүйсгэхгүй —
      // зөвхөн бүртгэнэ (админ хожим шалгах боломжтой).
      this.logger.warn(`Купон "${normalized}" ашиглалт нэмэгдсэнгүй (хязгаар дүүрсэн байж болзошгүй)`);
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
  /**
   * ⚠️⚠️ `OptionalJwtAuthGuard` — нэвтрээгүй ч үнэ харах боломжтой
   * байх ёстой (зочин багц сонгож байхад). Гэвч нэвтэрсэн бол ХЭН
   * болохыг мэдэх нь ЗААВАЛ: хувийн купон (`Coupon.userId`) зөвхөн
   * эзэндээ хүчинтэй тул шалгахад хэрэглэгчийн ID хэрэгтэй.
   */
  @Post('validate')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  validate(@Body() dto: ValidateCouponDto, @CurrentUser() user?: JwtPayload) {
    return this.svc.validate(dto, user?.sub ?? null);
  }
}

@Controller('admin/coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class CouponsAdminController {
  constructor(private readonly svc: CouponsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: 'live' | 'expired' | 'used-up' | 'off',
  ) {
    return this.svc.adminList({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      status,
    });
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
