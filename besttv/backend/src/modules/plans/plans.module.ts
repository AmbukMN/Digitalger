import {
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
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaymentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class PlanDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  price: number;

  @IsInt()
  @Min(1)
  durationDays: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;

  /** VIP — бүх жанрын контент нээгдэнэ (genreIds үл хамааран) */
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  /** «Хамгийн ашигтай» тэмдэг — pricing хуудсанд онцолно (admin удирдана) */
  @IsOptional()
  @IsBoolean()
  isBestValue?: boolean;

  /** Badge текст (хоосон бол «Хамгийн ашигтай») */
  @IsOptional()
  @IsString()
  badgeText?: string;

  /** Badge/хүрээний өнгө HEX (хоосон бол premium алтан) */
  @IsOptional()
  @IsString()
  badgeColor?: string;

  /** Энэ багц ямар жанруудын контентыг нээхийг тодорхойлно */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genreIds?: string[];
}

const PLAN_INCLUDE = {
  genres: {
    select: { genre: { select: { id: true, name: true, slug: true, isAdult: true } } },
  },
} satisfies Prisma.PlanInclude;

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    /* ⚠️ `@Global()` тул импорт шаардлагагүй */
    private readonly cache: CacheService,
  ) {}

  private shape<T extends { genres: { genre: unknown }[] }>(plan: T) {
    return { ...plan, genres: plan.genres.map((g) => g.genre) };
  }

  /**
   * ⚠️⚠️ КЭШТЭЙ — багц нь өдөрт хэдхэн удаа л өөрчлөгддөг өгөгдөл атлаа
   * үнийн хуудас, төлбөрийн цонх, чатбот бүрээс дуудагддаг байв.
   * Админ засахад `cache-invalidate` interceptor цэвэрлэнэ.
   */
  async listActive() {
    return this.cache.wrap('plans:active:v1', 300, async () => {
      const plans = await this.prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
        include: PLAN_INCLUDE,
      });
      return plans.map((p) => this.shape(p));
    });
  }

  /**
   * АДМИН жагсаалт — багц бүрийн БОРЛУУЛАЛТЫН тоо/дүнтэй.
   *
   * ⚠️⚠️ ЗӨВХӨН `PAID` төлбөр тооцно. PENDING (QR гаргаад төлөөгүй) нь
   * борлуулалт БИШ — түүнийг оруулбал орлого хиймлээр өснө.
   *
   * ⚠️ `soldCount` = ХУДАЛДАН АВАЛТЫН тоо (нэг хүн 2 удаа сунгавал 2).
   *    `subscriberCount` = ОДОО идэвхтэй эрхтэй ХҮНИЙ тоо (давхардалгүй).
   *    Хоёулаа хэрэгтэй: эхнийх нь нийт эрэлт, хоёр дахь нь идэвхтэй бааз.
   *
   * ⚠️ `revenue` нь ХӨНГӨЛӨЛТ ХАССАН бодит төлсөн дүн (`amount`) —
   *    `originalAmount` БИШ (купон/урамшуулалтай бол зөрнө).
   */
  async listAll() {
    const now = new Date();
    const [plans, sales, active] = await Promise.all([
      this.prisma.plan.findMany({ orderBy: { order: 'asc' }, include: PLAN_INCLUDE }),
      this.prisma.payment.groupBy({
        by: ['planId'],
        where: { status: PaymentStatus.PAID, planId: { not: null } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      /* Идэвхтэй захиалагч — нэг хүн олон мөртэй байж болох тул
         ХҮНЭЭР давхардлыг арилгана (доор Set-ээр) */
      this.prisma.subscription.findMany({
        where: { expiresAt: { gt: now } },
        select: { planId: true, userId: true },
      }),
    ]);

    const salesBy = new Map(sales.map((r) => [r.planId as string, r]));
    const usersBy = new Map<string, Set<string>>();
    for (const s of active) {
      if (!usersBy.has(s.planId)) usersBy.set(s.planId, new Set());
      usersBy.get(s.planId)!.add(s.userId);
    }

    return plans.map((p) => ({
      ...this.shape(p),
      soldCount: salesBy.get(p.id)?._count._all ?? 0,
      revenue: salesBy.get(p.id)?._sum.amount ?? 0,
      subscriberCount: usersBy.get(p.id)?.size ?? 0,
    }));
  }

  async create(dto: PlanDto) {
    const { genreIds, ...data } = dto;
    const plan = await this.prisma.plan.create({ data });
    if (genreIds?.length) {
      await this.prisma.planGenre.createMany({
        data: genreIds.map((genreId) => ({ planId: plan.id, genreId })),
        skipDuplicates: true,
      });
    }
    return plan;
  }

  async update(id: string, dto: Partial<PlanDto>) {
    const { genreIds, ...data } = dto;
    const plan = await this.prisma.plan.update({ where: { id }, data });

    // genreIds ирсэн бол холбоосыг БҮРЭН дахин тохируулна (идемпотент)
    if (genreIds !== undefined) {
      await this.prisma.planGenre.deleteMany({ where: { planId: id } });
      if (genreIds.length) {
        await this.prisma.planGenre.createMany({
          data: genreIds.map((genreId) => ({ planId: id, genreId })),
          skipDuplicates: true,
        });
      }
    }
    return plan;
  }

  /**
   * Багц устгах.
   *
   * ⚠️ Төлбөр/захиалгатай багцыг УСТГАХГҮЙ — гүйлгээний түүх, хэрэглэгчийн
   * идэвхтэй эрх алдагдана. Оронд нь идэвхгүй болгоно (шинэ хүн худалдаж
   * авахгүй, хуучин эзэмшигчид эрхээ хадгална).
   *
   * `force: true` бол ХҮЧЭЭР устгана — захиалга/төлбөрийн planId нь NULL болж,
   * түүх нь "багц устсан" гэж харагдана. Зөвхөн админ ухамсартай сонгоход.
   */
  async remove(id: string, force = false) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!plan) return { ok: true, notFound: true };

    const [payments, subs] = await Promise.all([
      this.prisma.payment.count({ where: { planId: id } }),
      this.prisma.subscription.count({ where: { planId: id } }),
    ]);
    const used = payments + subs;

    if (used > 0 && !force) {
      await this.prisma.plan.update({ where: { id }, data: { isActive: false } });
      return {
        ok: true,
        deactivated: true,
        payments,
        subscriptions: subs,
        message: `"${plan.name}" багцад ${payments} төлбөр, ${subs} захиалга холбоотой тул устгалгүй ИДЭВХГҮЙ болголоо.`,
      };
    }

    if (force && used > 0) {
      // Түүхийг үлдээж зөвхөн холбоосыг тасална
      await this.prisma.$transaction([
        this.prisma.payment.updateMany({ where: { planId: id }, data: { planId: null } }),
        this.prisma.subscription.deleteMany({ where: { planId: id } }),
        this.prisma.planGenre.deleteMany({ where: { planId: id } }),
      ]);
    }

    // ⚠️ `.catch(() => null)` БАЙХГҮЙ — алдаа нуувал хэрэглэгч "устгагдлаа"
    // гэсэн мэдэгдэл авах мөртлөө мөр хэвээр үлдэж эргэлздэг
    const exists = await this.prisma.plan.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Багц олдсонгүй');
    await this.prisma.plan.delete({ where: { id } });
    return { ok: true, deleted: true, forced: force && used > 0 };
  }
}

@Controller('plans')
export class PlansController {
  constructor(private readonly svc: PlansService) {}

  @Get()
  list() {
    return this.svc.listActive();
  }
}

@Controller('admin/plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PlansAdminController {
  constructor(private readonly svc: PlansService) {}

  @Get()
  list() {
    return this.svc.listAll();
  }

  @Post()
  create(@Body() dto: PlanDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<PlanDto>) {
    return this.svc.update(id, dto);
  }

  /** `?force=1` — төлбөртэй багцыг ч ХҮЧЭЭР устгана (админ ухамсартай сонгоно) */
  @Delete(':id')
  remove(@Param('id') id: string, @Query('force') force?: string) {
    return this.svc.remove(id, force === '1' || force === 'true');
  }
}

@Module({
  controllers: [PlansController, PlansAdminController],
  providers: [PlansService],
})
export class PlansModule {}
