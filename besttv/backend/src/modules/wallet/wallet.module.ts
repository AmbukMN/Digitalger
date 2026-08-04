import { Module } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { Prisma, Role, WalletTxType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { TrackingService } from '../tracking/tracking.service';

class AdminAdjustDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracking: TrackingService,
  ) {}

  /**
   * ⚠️ Үлдэгдэл өөрчлөх ЦОРЫН ГАНЦ цэг — transaction дотор атомарт хийнэ.
   * Гүйлгээ бүрийг WalletTransaction-д бүртгэж, balanceAfter snapshot хадгална.
   * amount: эерэг = нэмэгдэнэ, сөрөг = хасагдана.
   */
  async applyTransaction(params: {
    userId: string;
    type: WalletTxType;
    amount: number;
    description?: string;
    paymentId?: string;
    planId?: string;
    actorUserId?: string;
    tx?: Prisma.TransactionClient;
  }) {
    const run = async (client: Prisma.TransactionClient) => {
      /**
       * ⚠️⚠️ АТОМИК ШИНЭЧЛЭЛТ — МӨНГӨ АЛДАХААС СЭРГИЙЛНЭ.
       *
       * Өмнө нь `read → calculate → write` байсан:
       *   уншина: balance = 10,000
       *   бодно:  next    = 10,000 - 5,000
       *   бичнэ:  balance = 5,000
       * Хоёр хүсэлт ЗЭРЭГ ирвэл хоёулаа 10,000 уншиж, хоёулаа 5,000 бичнэ
       * → 5,000₮ АЛГА БОЛНО. Транзакц дотор ч PostgreSQL-ийн default
       * READ COMMITTED түвшинд энэ хамгаалагдахгүй.
       *
       * Одоо: `updateMany` + `increment` — DB өөрөө одоогийн утган дээр
       * нэмнэ (уншилт байхгүй). Хасалт бол `walletBalance >= |amount|`
       * нөхцөлийг ЗААВАЛ тавина: нөхцөл хангагдаагүй бол `count = 0`
       * буцаж, гүйлгээ хийгдэхгүй.
       */
      const isDebit = params.amount < 0;
      const { count } = await client.user.updateMany({
        where: {
          id: params.userId,
          // Хасахад л үлдэгдлийн нөхцөл — нэмэхэд хязгаар хэрэггүй
          ...(isDebit ? { walletBalance: { gte: -params.amount } } : {}),
        },
        data: { walletBalance: { increment: params.amount } },
      });

      if (count === 0) {
        // Хэрэглэгч байхгүй эсвэл үлдэгдэл хүрэлцэхгүй — алийг нь ялгана
        const exists = await client.user.findUnique({
          where: { id: params.userId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('Хэрэглэгч олдсонгүй');
        throw new BadRequestException('Хэтэвчийн үлдэгдэл хүрэлцэхгүй байна');
      }

      /**
       * ⚠️ `balanceAfter`-ыг ШИНЭЧЛЭЛТИЙН ДАРАА уншина — өмнө нь өөрсдөө
       * бодож байсан тул зэрэг гүйлгээнд буруу snapshot үлддэг байв.
       */
      const after = await client.user.findUniqueOrThrow({
        where: { id: params.userId },
        select: { walletBalance: true },
      });

      return client.walletTransaction.create({
        data: {
          userId: params.userId,
          type: params.type,
          amount: params.amount,
          balanceAfter: after.walletBalance,
          description: params.description ?? '',
          paymentId: params.paymentId,
          planId: params.planId,
          actorUserId: params.actorUserId,
        },
      });
    };

    // Гаднаас transaction ирвэл түүн дотор нь, эс бөгөөс шинийг эхлүүлнэ
    return params.tx ? run(params.tx) : this.prisma.$transaction(run);
  }

  async balance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });
    return { balance: user?.walletBalance ?? 0 };
  }

  async transactions(userId: string, limit = 50) {
    const rows = await this.prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, limit),
    });

    // planId-тай гүйлгээнд багцын нэрийг нөхөж өгнө (UI-д "ямар багц" харуулах)
    const planIds = [...new Set(rows.map((r) => r.planId).filter((v): v is string => !!v))];
    const plans = planIds.length
      ? await this.prisma.plan.findMany({
          where: { id: { in: planIds } },
          select: { id: true, name: true },
        })
      : [];
    const planName = new Map(plans.map((p) => [p.id, p.name]));

    return rows.map((r) => ({
      ...r,
      planName: r.planId ? (planName.get(r.planId) ?? null) : null,
    }));
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async adminCredit(userId: string, dto: AdminAdjustDto, actorUserId: string) {
    const res = await this.applyTransaction({
      userId,
      type: WalletTxType.ADMIN_CREDIT,
      amount: dto.amount,
      description: dto.description || 'Админ цэнэглэлт',
      actorUserId,
    });
    // Аль админ хэзээ хэдээр цэнэглэснийг мөрдөнө
    await this.tracking.audit(userId, 'wallet_credit', {
      newValue: `+${dto.amount}₮`,
      actor: 'admin',
      actorId: actorUserId,
    });
    return res;
  }

  async adminDebit(userId: string, dto: AdminAdjustDto, actorUserId: string) {
    const res = await this.applyTransaction({
      userId,
      type: WalletTxType.ADMIN_DEBIT,
      amount: -Math.abs(dto.amount),
      description: dto.description || 'Админ хасалт',
      actorUserId,
    });
    await this.tracking.audit(userId, 'wallet_debit', {
      newValue: `-${Math.abs(dto.amount)}₮`,
      actor: 'admin',
      actorId: actorUserId,
    });
    return res;
  }
}

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly svc: WalletService) {}

  @Get()
  balance(@CurrentUser() user: JwtPayload) {
    return this.svc.balance(user.sub);
  }

  @Get('transactions')
  transactions(@CurrentUser() user: JwtPayload, @Query('limit') limit?: number) {
    return this.svc.transactions(user.sub, limit);
  }
}

@Controller('admin/wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class WalletAdminController {
  constructor(private readonly svc: WalletService) {}

  @Get(':userId/transactions')
  transactions(@Param('userId') userId: string, @Query('limit') limit?: number) {
    return this.svc.transactions(userId, limit);
  }

  /**
   * ⚠️ Rate limit — админы токен алдагдвал скриптээр хязгааргүй мөнгө
   * нэмэх/хасах эрсдэлтэй. Хүн гараар минутад 20-иос олон тохируулга
   * хийхгүй тул хэвийн ажилд саад болохгүй.
   */
  @Post(':userId/credit')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  credit(
    @Param('userId') userId: string,
    @Body() dto: AdminAdjustDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.svc.adminCredit(userId, dto, admin.sub);
  }

  @Post(':userId/debit')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  debit(
    @Param('userId') userId: string,
    @Body() dto: AdminAdjustDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.svc.adminDebit(userId, dto, admin.sub);
  }
}

@Module({
  controllers: [WalletController, WalletAdminController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
