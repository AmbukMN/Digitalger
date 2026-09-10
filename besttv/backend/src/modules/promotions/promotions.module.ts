import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { DiscountType, Prisma, PromotionType, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PromotionsService } from './promotions.service';
import { assertSameSite } from '../../common/site/site-guard';

class PromotionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  shortText?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PromotionType)
  type: PromotionType;

  @IsOptional()
  @IsInt()
  @Min(1)
  bonusDays?: number;

  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @IsOptional()
  @IsInt()
  @Min(1)
  discountValue?: number;

  @IsOptional()
  @IsString()
  giftPlanId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  giftDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minTopup?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  bonusAmount?: number;

  /** Хоосон массив = БҮХ багцад */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  planIds?: string[];

  @IsString()
  startsAt: string;

  @IsString()
  endsAt: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerUser?: number;

  @IsOptional()
  @IsBoolean()
  newUsersOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  blockCoupons?: boolean;

  @IsOptional()
  @IsString()
  bannerKey?: string;

  @IsOptional()
  @IsString()
  bannerMobileKey?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}

/**
 * УРАМШУУЛЛЫН АДМИН ҮЙЛДЛҮҮД.
 *
 * ⚠️ Тооцооны логик нь `PromotionsService`-д — энд зөвхөн CRUD.
 */
@Injectable()
class PromotionsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    /* ⚠️ Баннерын R2 key → URL (preview харуулахад) */
    private readonly storage: StorageService,
  ) {}

  /**
   * ⚠️⚠️ ТӨРӨЛ БҮРД ЗААВАЛ БАЙХ ТАЛБАРУУДЫГ ШАЛГАНА.
   *
   * DTO-гийн `@IsOptional` нь бүх талбарыг сонгомол болгодог (өөр
   * төрөлд хэрэггүй тул). Гэвч EXTRA_DAYS нь `bonusDays`-гүй бол
   * ХООСОН урамшуулал болж, хэрэглэгчид «бэлэг» гэж харагдаад юу ч
   * өгөхгүй — итгэл алдана.
   */
  private assertValid(type: PromotionType, dto: Partial<PromotionDto>) {
    if (type === PromotionType.EXTRA_DAYS && !dto.bonusDays) {
      throw new BadRequestException('Нэмэлт хоногийн урамшуулалд «хэдэн хоног» заавал');
    }
    if (type === PromotionType.DISCOUNT) {
      if (!dto.discountType || !dto.discountValue) {
        throw new BadRequestException('Хямдралын төрөл болон утга заавал');
      }
      /* ⚠️ PERCENT нь 1-100 — 500% бол үнэ сөрөг болно */
      if (dto.discountType === DiscountType.PERCENT && (dto.discountValue < 1 || dto.discountValue > 100)) {
        throw new BadRequestException('Хувиар хямдрах утга 1-100 хооронд байна');
      }
    }
    if (type === PromotionType.GIFT_PLAN && !dto.giftPlanId) {
      throw new BadRequestException('Бэлэг багцыг сонгоно уу');
    }
    if (type === PromotionType.WALLET_BONUS && (!dto.minTopup || !dto.bonusAmount)) {
      throw new BadRequestException('Хэтэвчийн бонусд доод дүн болон бонус заавал');
    }
  }

  /** ⚠️ Огноо буруу дараалалтай бол урамшуулал ХЭЗЭЭ Ч идэвхжихгүй */
  private assertDates(startsAt: string, endsAt: string) {
    const s = new Date(startsAt);
    const e = new Date(endsAt);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      throw new BadRequestException('Огноо буруу байна');
    }
    if (e <= s) throw new BadRequestException('Дуусах огноо нь эхлэхээс хойш байх ёстой');
  }

  /**
   * ⚠️ `bannerUrl` ЗААВАЛ буцаана — админ зургаа PREVIEW харах ёстой.
   * Зөвхөн R2 key буцаавал админ юу оруулснаа мэдэхгүй (муу UX).
   *
   * Server талын хуудаслалт + хайлт (нэр / товч тайлбар).
   *
   * ⚠️ Урамшуулал олноороо хуримтлагдвал client-д бүгдийг татаж шүүх нь
   * хүнд болно — хуудаслалт, хайлтыг ЭНД хийнэ. `order` эрэмбэ ХЭВЭЭР
   * (isActive desc → order asc → createdAt desc), pagination нь эрэмбийг
   * дагаад хуудаслана.
   */
  /**
   * ⚠️⚠️ `status`/`type` шүүлт SERVER талд — өмнө нь client талд
   * ЗӨВХӨН ТУХАЙН ХУУДСАН дээр үйлчилдэг байв. Үр дүнд админ
   * «идэвхтэй урамшуулал 3» гэж хараад бодит нь 12 байж болох ба
   * 2-р хуудас огт өөр дэд олонлог харуулдаг байв. Статистикийн
   * картууд ч ижил алдаатай.
   */
  async list(
    params: { page?: number; limit?: number; search?: string; status?: string; type?: string } = {},
  ) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const search = (params.search ?? '').trim();
    const now = new Date();

    const where: Prisma.PromotionWhereInput = {};
    if (search) {
      /* ⚠️ Нэр болон товч тайлбараар хайна */
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { shortText: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (params.type) where.type = params.type as PromotionType;

    /**
     * ⚠️ `status` нь БАГАНА БИШ — `isActive` + огноо + `usedCount`-оос
     * тооцогддог. Админы `statusOf()`-той ЯГ ИЖИЛ дараалал байх ёстой
     * (эс бөгөөс шүүлтийн үр дүн шошготой зөрнө):
     *   off → scheduled → expired → used-up → live
     *
     * ⚠️ `usedCount >= maxUses` нь БАГАНА ХАРЬЦУУЛАЛТ — Prisma-д
     * `fields` referencing-ээр хийнэ.
     */
    const usedUp: Prisma.PromotionWhereInput = {
      maxUses: { not: null },
      usedCount: { gte: this.prisma.promotion.fields.maxUses },
    };
    const notUsedUp: Prisma.PromotionWhereInput = {
      OR: [{ maxUses: null }, { usedCount: { lt: this.prisma.promotion.fields.maxUses } }],
    };
    switch (params.status) {
      case 'off':
        where.isActive = false;
        break;
      case 'scheduled':
        where.isActive = true;
        where.startsAt = { gt: now };
        break;
      case 'expired':
        where.isActive = true;
        where.startsAt = { lte: now };
        where.endsAt = { lt: now };
        break;
      case 'used-up':
        where.isActive = true;
        where.startsAt = { lte: now };
        where.endsAt = { gte: now };
        where.AND = [usedUp];
        break;
      case 'live':
        where.isActive = true;
        where.startsAt = { lte: now };
        where.endsAt = { gte: now };
        where.AND = [notUsedUp];
        break;
      default:
        break;
    }

    const [rows, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          plans: { select: { planId: true } },
          giftPlan: { select: { id: true, name: true } },
          /* ⚠️ Үр дүн харуулах — хэдэн хүн ашигласан */
          _count: { select: { redemptions: true } },
        },
      }),
      this.prisma.promotion.count({ where }),
    ]);

    /* ⚠️ bannerUrl / bannerMobileUrl preview enrich ХЭВЭЭР — items дотор */
    const items = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        bannerUrl: r.bannerKey ? await this.storage.publicAssetUrl(r.bannerKey, 7200) : null,
        bannerMobileUrl: r.bannerMobileKey
          ? await this.storage.publicAssetUrl(r.bannerMobileKey, 7200)
          : null,
      })),
    );

    /**
     * ⚠️⚠️ СТАТИСТИК нь БҮХ урамшуулалаар — тухайн хуудсаар БИШ.
     *
     * Өмнө нь admin талд `items.filter(...)` гэж зөвхөн ирсэн хуудсыг
     * тоолдог байсан тул «идэвхтэй 3» гэж хараад бодит нь 12 байж
     * болдог байв.
     *
     * ⚠️ `search`-ыг хамруулна (хайлтын үр дүнгийн статистик), гэхдээ
     * `status`/`type` шүүлтийг хамруулахгүй — эдгээр карт нь ерөнхий
     * зураглал өгөх зорилготой.
     */
    const statsWhere: Prisma.PromotionWhereInput = search ? { OR: where.OR } : {};
    const [live, scheduled, agg] = await Promise.all([
      this.prisma.promotion.count({
        where: {
          ...statsWhere,
          isActive: true,
          startsAt: { lte: now },
          endsAt: { gte: now },
          OR: [{ maxUses: null }, { usedCount: { lt: this.prisma.promotion.fields.maxUses } }],
        },
      }),
      this.prisma.promotion.count({
        where: { ...statsWhere, isActive: true, startsAt: { gt: now } },
      }),
      this.prisma.promotion.aggregate({ where: statsWhere, _sum: { usedCount: true } }),
    ]);
    const totalPeople = await this.prisma.promotionRedemption.count({
      where: search ? { promotion: { OR: where.OR } } : {},
    });

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        live,
        scheduled,
        totalUsed: agg._sum.usedCount ?? 0,
        totalPeople,
      },
    };
  }

  async create(dto: PromotionDto) {
    this.assertValid(dto.type, dto);
    this.assertDates(dto.startsAt, dto.endsAt);

    return this.prisma.promotion.create({
      data: {
        name: dto.name.trim(),
        shortText: dto.shortText?.trim() ?? '',
        description: dto.description?.trim() ?? '',
        type: dto.type,
        bonusDays: dto.bonusDays ?? null,
        discountType: dto.discountType ?? null,
        discountValue: dto.discountValue ?? null,
        giftPlanId: dto.giftPlanId ?? null,
        giftDays: dto.giftDays ?? null,
        minTopup: dto.minTopup ?? null,
        bonusAmount: dto.bonusAmount ?? null,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        isActive: dto.isActive ?? true,
        maxUses: dto.maxUses ?? null,
        maxPerUser: dto.maxPerUser ?? 1,
        newUsersOnly: dto.newUsersOnly ?? false,
        blockCoupons: dto.blockCoupons ?? false,
        bannerKey: dto.bannerKey || null,
        bannerMobileKey: dto.bannerMobileKey || null,
        order: dto.order ?? 0,
        ...(dto.planIds?.length
          ? { plans: { create: dto.planIds.map((planId) => ({ planId })) } }
          : {}),
      },
      include: { plans: { select: { planId: true } } },
    });
  }

  async update(id: string, dto: Partial<PromotionDto>) {
    const cur = await this.prisma.promotion.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('Урамшуулал олдсонгүй');

    /**
     * ⚠️ ЭЦСИЙН УТГААР шалгана — админ зөвхөн `type`-ыг өөрчилвөл
     * шинэ төрөлд шаардлагатай талбар дутуу үлдэж болно.
     */
    const type = dto.type ?? cur.type;
    this.assertValid(type, { ...cur, ...dto } as Partial<PromotionDto>);
    if (dto.startsAt || dto.endsAt) {
      this.assertDates(
        dto.startsAt ?? cur.startsAt.toISOString(),
        dto.endsAt ?? cur.endsAt.toISOString(),
      );
    }

    const data: Prisma.PromotionUpdateInput = {
      ...(dto.name != null ? { name: dto.name.trim() } : {}),
      ...(dto.shortText != null ? { shortText: dto.shortText.trim() } : {}),
      ...(dto.description != null ? { description: dto.description.trim() } : {}),
      ...(dto.type != null ? { type: dto.type } : {}),
      ...(dto.bonusDays !== undefined ? { bonusDays: dto.bonusDays ?? null } : {}),
      ...(dto.discountType !== undefined ? { discountType: dto.discountType ?? null } : {}),
      ...(dto.discountValue !== undefined ? { discountValue: dto.discountValue ?? null } : {}),
      ...(dto.giftDays !== undefined ? { giftDays: dto.giftDays ?? null } : {}),
      ...(dto.minTopup !== undefined ? { minTopup: dto.minTopup ?? null } : {}),
      ...(dto.bonusAmount !== undefined ? { bonusAmount: dto.bonusAmount ?? null } : {}),
      ...(dto.startsAt ? { startsAt: new Date(dto.startsAt) } : {}),
      ...(dto.endsAt ? { endsAt: new Date(dto.endsAt) } : {}),
      ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
      ...(dto.maxUses !== undefined ? { maxUses: dto.maxUses ?? null } : {}),
      ...(dto.maxPerUser != null ? { maxPerUser: dto.maxPerUser } : {}),
      ...(dto.newUsersOnly != null ? { newUsersOnly: dto.newUsersOnly } : {}),
      ...(dto.blockCoupons != null ? { blockCoupons: dto.blockCoupons } : {}),
      ...(dto.bannerKey !== undefined ? { bannerKey: dto.bannerKey || null } : {}),
      ...(dto.bannerMobileKey !== undefined
        ? { bannerMobileKey: dto.bannerMobileKey || null }
        : {}),
      ...(dto.order != null ? { order: dto.order } : {}),
      ...(dto.giftPlanId !== undefined
        ? dto.giftPlanId
          ? { giftPlan: { connect: { id: dto.giftPlanId } } }
          : { giftPlan: { disconnect: true } }
        : {}),
    };

    /* ⚠️ Багцын жагсаалт өөрчлөгдвөл БҮГДИЙГ дахин үүсгэнэ —
       нэмэгдсэн/хасагдсаныг ялгах нь илүү нарийн, ашиггүй */
    if (dto.planIds !== undefined) {
      await this.prisma.promotionPlan.deleteMany({ where: { promotionId: id } });
      if (dto.planIds.length) {
        await this.prisma.promotionPlan.createMany({
          data: dto.planIds.map((planId) => ({ promotionId: id, planId })),
          skipDuplicates: true,
        });
      }
    }

    /* ⚠️ САЙТ ХООРОНД БИЧИХЭЭС — `site-guard.ts` тайлбарыг үз */
    await assertSameSite(this.prisma.promotion, id, 'Урамшуулал олдсонгүй');
    return this.prisma.promotion.update({
      where: { id },
      data,
      include: { plans: { select: { planId: true } } },
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.promotion.findUnique({
      where: { id },
      select: {
        /* ⚠️ `site` — өргөтгөлийн post-filter ажиллахад ЗААВАЛ */
        site: true, id: true, _count: { select: { redemptions: true } } },
    });
    if (!exists) throw new NotFoundException('Урамшуулал олдсонгүй');

    /**
     * ⚠️⚠️ АШИГЛАГДСАН УРАМШУУЛЛЫГ УСТГАХГҮЙ.
     *
     * `PromotionRedemption` нь Cascade тул устгавал ХЭН ЮУ АВСАН
     * түүх алга болно. Санхүүгийн маргаан гарвал баталгаа үгүй.
     * Оронд нь идэвхгүй болгоно.
     */
    if (exists._count.redemptions > 0) {
      throw new BadRequestException(
        `Энэ урамшууллыг ${exists._count.redemptions} хүн ашигласан тул устгах боломжгүй. Идэвхгүй болгоно уу.`,
      );
    }

    await this.prisma.promotion.delete({ where: { id } });
    return { ok: true };
  }

  /** Үр дүнгийн тайлан — хэдэн хүн, хэдэн төгрөг, хэдэн хоног */
  async stats(id: string) {
    const promo = await this.prisma.promotion.findUnique({
      where: { id },
      select: {
        /* ⚠️ `site` — өргөтгөлийн post-filter ажиллахад ЗААВАЛ */
        site: true, id: true, name: true, usedCount: true, maxUses: true },
    });
    if (!promo) throw new NotFoundException('Урамшуулал олдсонгүй');

    const agg = await this.prisma.promotionRedemption.aggregate({
      where: { promotionId: id },
      _sum: { valueGiven: true, daysGiven: true },
      _count: { id: true },
    });

    /**
     * ⚠️ Урамшуулалтай төлбөрийн НИЙТ орлого — «хэдэн төгрөг авчирсан»
     *
     * ⚠️⚠️ `isWalletTopup: false` — ХЭТЭВЧ ЦЭНЭГЛЭЛТИЙГ ХАСНА.
     *
     * ⛔ Энэ шүүлт ДУТУУ байсан. Топапын БОНУС урамшуулал нь
     *    (`payments.service.ts` дэх топапын урамшуулал) `promotionId`
     *    -тэй холбогддог тул топапын Payment мөр `PromotionRedemption`
     *    -д орж, орлогод ДАВХАР тоологдож байв:
     *      · цэнэглэсэн 20,000₮ → энд тоологдоно
     *      · тэр 20,000₮-өөр багц авсан → БАС тоологдоно
     *    ⇒ урамшуулал 2 дахин үр дүнтэй мэт харагдана.
     *
     * ⚠️ Бусад бүх орлогын тооцоо (`analytics`, `insights`, `plans`)
     *    топапыг хасдаг — энэ нь тэдгээртэй НИЙЦЭХ ёстой.
     */
    const revenue = await this.prisma.payment.aggregate({
      where: {
        status: 'PAID',
        isWalletTopup: false,
        id: {
          in: (
            await this.prisma.promotionRedemption.findMany({
              where: { promotionId: id, paymentId: { not: null } },
              select: { paymentId: true },
            })
          )
            .map((r) => r.paymentId)
            .filter((x): x is string => x !== null),
        },
      },
      _sum: { amount: true },
    });

    return {
      ...promo,
      usedBy: agg._count.id,
      totalValueGiven: agg._sum.valueGiven ?? 0,
      totalDaysGiven: agg._sum.daysGiven ?? 0,
      revenueGenerated: revenue._sum.amount ?? 0,
    };
  }
}

/** Нийтэд нээлттэй — багцын хуудас, нүүр баннер */
@Controller('promotions')
export class PromotionsController {
  constructor(
    private readonly svc: PromotionsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Багц бүрд тохирох урамшуулал.
   *
   * ⚠️ `OptionalJwtAuthGuard` — ЗОЧИН ч харна. Нэвтрээгүй хүнд
   * урамшууллыг НУУВАЛ тэр өндөр үнэ хараад буцна.
   */
  @Get('for-plans')
  @UseGuards(OptionalJwtAuthGuard)
  async forPlans(@CurrentUser() user?: JwtPayload) {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      select: { id: true, price: true, durationDays: true },
    });
    const map = await this.svc.forPlans(plans, user?.sub ?? null);
    /* ⚠️ Map нь JSON-д хувирдаггүй — объект болгоно */
    return Object.fromEntries(map);
  }

  /** Нүүр хуудасны урамшууллын баннерууд */
  @Get('banners')
  banners() {
    return this.svc.banners();
  }

  /** Хэтэвч цэнэглэх бонус — дүн оруулахад шалгана */
  @Get('wallet-bonus')
  @UseGuards(OptionalJwtAuthGuard)
  walletBonus(@Query('amount') amount: string, @CurrentUser() user?: JwtPayload) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return null;
    return this.svc.walletBonusFor(Math.floor(n), user?.sub ?? null);
  }
}

@Controller('admin/promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PromotionsAdminController {
  constructor(private readonly svc: PromotionsAdminService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.svc.list({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      status,
      type,
    });
  }

  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.svc.stats(id);
  }

  @Post()
  create(@Body() dto: PromotionDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<PromotionDto>) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

@Module({
  controllers: [PromotionsController, PromotionsAdminController],
  /* ⚠️ StorageService нэмэхгүй — StorageModule нь @Global */
  providers: [PromotionsService, PromotionsAdminService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
