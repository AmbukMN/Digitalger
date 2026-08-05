import { Module } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import * as bcrypt from 'bcrypt';
import { Role, Prisma, AuthProvider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

class UpdateUserDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  role?: Role;
}

class SetPasswordDto {
  @IsString()
  @MinLength(8)
  password: string;
}

class GrantSubscriptionDto {
  @IsString()
  planId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  days?: number;
}

class BulkDeleteDto {
  /** Устгах хэрэглэгчийн ID-ууд (нэг удаад дээд тал нь 200) */
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  ids: string[];
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Хэрэглэгчийн шүүлт — НЭГ цэгээс (жагсаалт, тоолол, export ижил).
   *
   * ⚠️ `sub` шүүлт: 'active' = идэвхтэй багцтай, 'none' = багцгүй.
   * Prisma-д `some`/`none` нь relation дээр ажиллана.
   */
  private buildWhere(params: {
    q?: string;
    role?: string;
    status?: string;
    sub?: string;
    provider?: string;
    from?: string;
    to?: string;
  }): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    const term = params.q?.trim();
    if (term) {
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
        { id: term },
      ];
    }

    if (params.role && params.role !== 'ALL') where.role = params.role as Role;
    if (params.status === 'active') where.isActive = true;
    else if (params.status === 'blocked') where.isActive = false;
    if (params.provider && params.provider !== 'ALL') {
      where.provider = params.provider as AuthProvider;
    }

    const now = new Date();
    if (params.sub === 'active') {
      where.subscriptions = { some: { expiresAt: { gt: now } } };
    } else if (params.sub === 'none') {
      where.subscriptions = { none: { expiresAt: { gt: now } } };
    }

    // ⚠️ `to` нь тухайн ӨДРИЙГ бүтнээр хамруулна
    if (params.from || params.to) {
      const range: Prisma.DateTimeFilter = {};
      if (params.from) range.gte = new Date(params.from);
      if (params.to) {
        const end = new Date(params.to);
        end.setHours(23, 59, 59, 999);
        range.lte = end;
      }
      where.createdAt = range;
    }

    return where;
  }

  /**
   * Табын badge-д зориулсан тоолол.
   * ⚠️ Хайлт/огнооны шүүлтийг ХҮНДЭТГЭНЭ — эс бөгөөс "хайлт хийсэн ч
   * тоо өөрчлөгдөхгүй" гэсэн эвгүй байдал үүснэ.
   */
  async counts(params: { q?: string; from?: string; to?: string }) {
    const base = this.buildWhere(params);
    const now = new Date();
    const [all, active, blocked, withSub, admins] = await Promise.all([
      this.prisma.user.count({ where: base }),
      this.prisma.user.count({ where: { ...base, isActive: true } }),
      this.prisma.user.count({ where: { ...base, isActive: false } }),
      this.prisma.user.count({
        where: { ...base, subscriptions: { some: { expiresAt: { gt: now } } } },
      }),
      this.prisma.user.count({ where: { ...base, role: Role.ADMIN } }),
    ]);
    return { ALL: all, active, blocked, withSub, admins };
  }

  async list(params: {
    q?: string;
    role?: string;
    status?: string;
    sub?: string;
    provider?: string;
    from?: string;
    to?: string;
    sort?: string;
    dir?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(200, Number(params.limit) || 20);
    const where = this.buildWhere(params);
    const orderBy = {
      [params.sort ?? 'createdAt']: params.dir ?? 'desc',
    } as Prisma.UserOrderByWithRelationInput;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          provider: true,
          emailVerified: true,
          walletBalance: true,
          createdAt: true,
          subscriptions: {
            where: { expiresAt: { gt: new Date() } },
            orderBy: { expiresAt: 'desc' },
            take: 1,
            select: { expiresAt: true, plan: { select: { name: true } } },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        ...u,
        activeSubscription: u.subscriptions[0]
          ? { planName: u.subscriptions[0].plan.name, expiresAt: u.subscriptions[0].expiresAt }
          : null,
        subscriptions: undefined,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        provider: true,
        emailVerified: true,
        isGuest: true,
        walletBalance: true,
        createdAt: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, amount: true, status: true, createdAt: true, plan: { select: { name: true } } },
        },
        subscriptions: {
          orderBy: { expiresAt: 'desc' },
          take: 10,
          select: {
            id: true,
            startsAt: true,
            expiresAt: true,
            /** null = админ гараар олгосон (төлбөргүй) */
            paymentId: true,
            plan: {
              select: {
                id: true,
                name: true,
                isVip: true,
                genres: { select: { genre: { select: { id: true, name: true } } } },
              },
            },
          },
        },
        myList: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { createdAt: true, title: { select: { id: true, title: true, slug: true, posterKey: true } } },
        },
        watchProgress: {
          orderBy: { updatedAt: 'desc' },
          take: 10,
          select: {
            positionSec: true,
            durationSec: true,
            updatedAt: true,
            title: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    return this.prisma.user.update({ where: { id }, data: dto });
  }

  async setPassword(id: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { ok: true };
  }

  /**
   * Админаас багц олгох.
   *
   * ⚠️ VIP-ийн ОНЦГОЙ ДҮРЭМ:
   *   - VIP олгоход → бусад БҮХ идэвхтэй багц ХҮЧИНГҮЙ болно (VIP нь бүх
   *     контентыг нээдэг тул тэдгээр илүүдэл)
   *   - VIP байхад ӨӨР багц олгоход → VIP ХҮЧИНГҮЙ болно (админ зориуд
   *     "зөвхөн энэ жанр" болгож бууруулж байна гэсэн үг)
   *
   * Өмнө нь хоёулаа зэрэг идэвхтэй үлдэж, VIP дарж бүх кино үнэгүй болдог
   * АЛДААТАЙ байсан.
   *
   * ⚠️ Мөн хугацаа: ЗӨВХӨН ижил багцын үлдэгдэл дээр залгана (өмнө нь өөр
   * багцын дуусах огнооноос эхлүүлж, хугацаа буруу уртасдаг байсан).
   */
  async grantSubscription(id: string, dto: GrantSubscriptionDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new BadRequestException('Багц олдсонгүй');

    const now = new Date();
    const days = dto.days ?? plan.durationDays;

    // Ижил багцын идэвхтэй эрх байвал ТҮҮН дээр залгаж сунгана
    const sameActive = await this.prisma.subscription.findFirst({
      where: { userId: id, planId: dto.planId, expiresAt: { gt: now } },
      orderBy: { expiresAt: 'desc' },
    });
    const startsAt = sameActive ? sameActive.expiresAt : now;
    const expiresAt = new Date(startsAt.getTime() + days * 86400_000);

    return this.prisma.$transaction(async (tx) => {
      // ── VIP ↔ энгийн багцыг харилцан ХҮЧИНГҮЙ болгоно ──
      if (plan.isVip) {
        // VIP олгож байна → бусад бүх багц илүүдэл
        await tx.subscription.updateMany({
          where: { userId: id, expiresAt: { gt: now }, plan: { isVip: false } },
          data: { expiresAt: now },
        });
      } else {
        // Энгийн багц олгож байна → VIP хүчингүй (админ зориуд бууруулж байна)
        await tx.subscription.updateMany({
          where: { userId: id, expiresAt: { gt: now }, plan: { isVip: true } },
          data: { expiresAt: now },
        });
      }

      return tx.subscription.create({
        data: { userId: id, planId: dto.planId, startsAt, expiresAt },
      });
    });
  }

  /**
   * ⚠️⚠️ БӨӨНӨӨР УСТГАХ — тест хэрэглэгч цэвэрлэхэд.
   *
   * УСТГАЛТ БУЦААГДАХГҮЙ тул 3 ХАМГААЛАЛТ:
   *   1. ӨӨРИЙГӨӨ устгахгүй (админ өөрийгөө хаачихвал системд орох аргагүй)
   *   2. ADMIN эрхтэйг устгахгүй (санамсаргүй бусад админыг арилгахаас)
   *   3. ТӨЛБӨР ТӨЛСӨН хэрэглэгчийг устгахгүй — санхүүгийн бүртгэл
   *      (Payment/WalletTransaction) алдагдвал тайлан эвдэрнэ. Тэднийг
   *      устгахын оронд `isActive: false` болгож хаах ёстой.
   *
   * Устгагдсанаар Prisma `onDelete: Cascade`-аар холбоотой мөрүүд
   * (subscription, myList, watchProgress, review...) автоматаар цэвэрлэгдэнэ.
   */
  async bulkDelete(ids: string[], actorId: string) {
    const unique = [...new Set(ids)].filter(Boolean);
    if (unique.length === 0) throw new BadRequestException('ID сонгоогүй байна');

    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        email: true,
        role: true,
        _count: { select: { payments: true, walletTxs: true } },
      },
    });

    const skipped: { email: string; reason: string }[] = [];
    const deletable: string[] = [];

    for (const u of users) {
      if (u.id === actorId) {
        skipped.push({ email: u.email, reason: 'Өөрийгөө устгах боломжгүй' });
      } else if (u.role === Role.ADMIN) {
        skipped.push({ email: u.email, reason: 'Админ эрхтэй' });
      } else if (u._count.payments > 0 || u._count.walletTxs > 0) {
        skipped.push({ email: u.email, reason: 'Төлбөрийн бүртгэлтэй — хаах хэрэгтэй' });
      } else {
        deletable.push(u.id);
      }
    }

    const { count } = deletable.length
      ? await this.prisma.user.deleteMany({ where: { id: { in: deletable } } })
      : { count: 0 };

    return { deleted: count, skipped };
  }
}

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('sub') sub?: string,
    @Query('provider') provider?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: string,
    @Query('dir') dir?: 'asc' | 'desc',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.list({ q, role, status, sub, provider, from, to, sort, dir, page, limit });
  }

  /** Шүүлтэд тохирсон тоолол — табын badge */
  @Get('counts')
  counts(
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.counts({ q, from, to });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.svc.update(id, dto);
  }

  @Post(':id/password')
  setPassword(@Param('id') id: string, @Body() dto: SetPasswordDto) {
    return this.svc.setPassword(id, dto.password);
  }

  @Post(':id/grant-subscription')
  grantSubscription(@Param('id') id: string, @Body() dto: GrantSubscriptionDto) {
    return this.svc.grantSubscription(id, dto);
  }

  /**
   * ⚠️⚠️ БӨӨНӨӨР УСТГАХ — тест хэрэглэгч цэвэрлэхэд.
   *
   * `@Post` ашигласан шалтгаан: `@Delete` нь body-г найдвартай дэмждэггүй
   * (зарим proxy/browser хаядаг). ID жагсаалт body-гоор явна.
   */
  @Post('bulk-delete')
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() actor: JwtPayload) {
    return this.svc.bulkDelete(dto.ids, actor.sub);
  }
}

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
