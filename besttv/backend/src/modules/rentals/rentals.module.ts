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
  Put,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Role, WalletTxType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { WalletService } from '../wallet/wallet.module';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TitleMediaHelper } from '../titles/title-media.helper';
import { EmailService } from '../email/email.service';
import { WalletModule } from '../wallet/wallet.module';
import { TitlesModule } from '../titles/titles.module';

/** Сайтын нийтлэг тохиргоо (Settings.key = 'rent') */
const RENT_KEY = 'rent';
const DEFAULT_RENT_PRICE = 4900;
const DEFAULT_RENT_HOURS = 48;

export interface RentSettings {
  /** Нийтлэг үнэ (₮) — кинонд тусгайлан заагаагүй бол энэ */
  price: number;
  /** Хугацаа (цаг) */
  hours: number;
  /** Түрээсийн систем идэвхтэй эсэх */
  enabled: boolean;
}

class RentDto {
  @IsOptional()
  @IsString()
  couponCode?: string;
}

/** Админ — сайтын нийтлэг түрээсийн тохиргоо */
class RentSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  hours?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

/**
 * Кино ширхэгээр түрээслэх.
 *
 * ⚠️ Багц авахгүйгээр нэг киног хугацаатай үзэх боломж. Үнэ нь:
 *   1) Кинонд тусгайлан заасан `rentPrice` → 2) сайтын нийтлэг үнэ (4,900₮)
 */
@Injectable()
export class RentalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly subs: SubscriptionsService,
    private readonly media: TitleMediaHelper,
    private readonly email: EmailService,
  ) {}

  /** Сайтын нийтлэг түрээсийн тохиргоо */
  async settings(): Promise<RentSettings> {
    const row = await this.prisma.settings
      .findUnique({ where: { key: RENT_KEY } })
      .catch(() => null);
    const v = (row?.value ?? {}) as Partial<RentSettings>;
    return {
      price: v.price ?? DEFAULT_RENT_PRICE,
      hours: v.hours ?? DEFAULT_RENT_HOURS,
      enabled: v.enabled ?? true,
    };
  }

  async updateSettings(dto: Partial<RentSettings>) {
    const cur = await this.settings();
    const next: RentSettings = {
      price: dto.price != null ? Math.max(0, Math.round(dto.price)) : cur.price,
      hours: dto.hours != null ? Math.max(1, Math.round(dto.hours)) : cur.hours,
      enabled: dto.enabled ?? cur.enabled,
    };
    await this.prisma.settings.upsert({
      where: { key: RENT_KEY },
      create: { key: RENT_KEY, value: next as object },
      update: { value: next as object },
    });
    return next;
  }

  /**
   * Тухайн киноны бодит түрээсийн үнэ/хугацаа.
   * Кинонд заасан утга нийтлэгээс ДАВУУ.
   */
  async priceFor(titleId: string) {
    const [title, cfg] = await Promise.all([
      this.prisma.title.findUnique({
        where: { id: titleId },
        select: { id: true, title: true, isPremium: true, rentPrice: true, rentHours: true, rentEnabled: true },
      }),
      this.settings(),
    ]);
    if (!title) throw new NotFoundException('Кино олдсонгүй');

    return {
      titleId: title.id,
      titleName: title.title,
      price: title.rentPrice ?? cfg.price,
      hours: title.rentHours ?? cfg.hours,
      /** Түрээслэх боломжтой эсэх — үнэгүй кинонд хэрэггүй */
      available: cfg.enabled && title.rentEnabled && title.isPremium,
    };
  }

  /** Хэрэглэгчийн энэ кинонд байгаа идэвхтэй түрээс */
  async myRental(userId: string, titleId: string) {
    return this.subs.activeRental(userId, titleId);
  }

  /** Хэрэглэгчийн бүх идэвхтэй түрээс (профайлд) */
  async myRentals(userId: string) {
    const rows = await this.prisma.rental.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
      include: {
        title: {
          select: { id: true, title: true, slug: true, posterKey: true, type: true },
        },
      },
    });
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        amount: r.amount,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
        title: {
          ...r.title,
          posterUrl: await this.media.url(r.title.posterKey),
          posterKey: undefined,
        },
      })),
    );
  }

  /**
   * Хэтэвчээр түрээслэх — QPay дамжихгүй, шууд.
   * ⚠️ Үлдэгдэл хасах + түрээс үүсгэх нь НЭГ transaction дотор (атомар).
   */
  async rentWithWallet(userId: string, titleId: string) {
    const info = await this.priceFor(titleId);
    if (!info.available) {
      throw new BadRequestException('Энэ киног ширхэгээр түрээслэх боломжгүй');
    }

    // Аль хэдийн эрхтэй бол дахин төлүүлэхгүй
    const existing = await this.subs.activeRental(userId, titleId);
    if (existing) {
      return { ok: true, already: true, expiresAt: existing.expiresAt };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    if (user.walletBalance < info.price) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_BALANCE',
        message: `Үлдэгдэл хүрэлцэхгүй (${user.walletBalance.toLocaleString()}₮ / ${info.price.toLocaleString()}₮)`,
      });
    }

    const expiresAt = new Date(Date.now() + info.hours * 3600_000);

    const rental = await this.prisma.$transaction(async (tx) => {
      const r = await tx.rental.create({
        data: { userId, titleId, amount: info.price, expiresAt },
      });

      if (info.price > 0) {
        await this.wallet.applyTransaction({
          userId,
          type: WalletTxType.PURCHASE,
          amount: -info.price,
          description: `Түрээс: ${info.titleName} (${info.hours}ц)`,
          tx,
        });
      }
      return r;
    });

    // ── Түрээсийн баталгаажуулах имэйл ──
    const [renter, title] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
      this.prisma.title.findUnique({ where: { id: titleId }, select: { slug: true } }),
    ]);
    if (renter && title) {
      this.email.sendRentalConfirmation({
        to: renter.email,
        name: renter.name,
        titleName: info.titleName,
        titleSlug: title.slug,
        amount: info.price,
        expiresAt,
        hours: info.hours,
        userId,
      });
    }

    return { ok: true, rentalId: rental.id, expiresAt, hours: info.hours };
  }
}

@Controller('rentals')
export class RentalsController {
  constructor(private readonly svc: RentalsService) {}

  /** Нийтэд — тухайн киноны түрээсийн үнэ (нэвтрэхгүйгээр ч харна) */
  @Get('price/:titleId')
  price(@Param('titleId') titleId: string) {
    return this.svc.priceFor(titleId);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: JwtPayload) {
    return this.svc.myRentals(user.sub);
  }

  @Get('mine/:titleId')
  @UseGuards(JwtAuthGuard)
  mineFor(@Param('titleId') titleId: string, @CurrentUser() user: JwtPayload) {
    return this.svc.myRental(user.sub, titleId);
  }

  /** Хэтэвчээр түрээслэх */
  @Post(':titleId/wallet')
  @UseGuards(JwtAuthGuard)
  rentWallet(
    @Param('titleId') titleId: string,
    @CurrentUser() user: JwtPayload,
    @Body() _dto: RentDto,
  ) {
    return this.svc.rentWithWallet(user.sub, titleId);
  }
}

/** Админ — нийтлэг түрээсийн үнэ/хугацаа (кино бүрийн үнийг title-аас заана) */
@Controller('admin/rentals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class RentalsAdminController {
  constructor(private readonly svc: RentalsService) {}

  @Get('settings')
  get() {
    return this.svc.settings();
  }

  @Put('settings')
  update(@Body() dto: RentSettingsDto) {
    return this.svc.updateSettings(dto);
  }
}

@Module({
  // ⚠️ WalletService, TitleMediaHelper нь өөр модулиудын export — imports-гүй
  // бол DI унана. SubscriptionsModule нь @Global() тул import шаардлагагүй.
  imports: [WalletModule, TitlesModule],
  controllers: [RentalsController, RentalsAdminController],
  providers: [RentalsService],
  exports: [RentalsService],
})
export class RentalsModule {}
