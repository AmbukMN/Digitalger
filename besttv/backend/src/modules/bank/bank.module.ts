import {
  BadRequestException,
  Body,
  Controller,
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
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaymentStatus, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from '../payments/payments.service';
import { PaymentsModule } from '../payments/payments.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { CouponsModule } from '../coupons/coupons.module';
import { PromotionsService } from '../promotions/promotions.service';
import { CouponsService } from '../coupons/coupons.module';
import { N8nService } from '../n8n/n8n.service';
import { EmailService } from '../email/email.service';

const BANK_KEY = 'bank';

/** Админаас удирдах дансны тохиргоо */
interface BankSettings {
  enabled: boolean;
  bankName: string;
  accountNumber: string;
  accountName: string;
  /** Модалд харагдах нэмэлт заавар (ж: «Ажлын цагаар 1 цагт баталгаажна») */
  note: string;
}

const DEFAULT_BANK: BankSettings = {
  enabled: false,
  bankName: '',
  accountNumber: '',
  accountName: '',
  note: 'Гүйлгээний утгыг ЗААВАЛ хуулж бичнэ үү. Ажлын цагаар 1 цагийн дотор баталгаажна.',
};

class BankSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  accountName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

class BankInitiateDto {
  @IsOptional()
  @IsString()
  planId?: string;

  /** Хэтэвч цэнэглэх бол дүн */
  @IsOptional()
  @IsInt()
  @Min(1000)
  topupAmount?: number;

  @IsOptional()
  @IsString()
  couponCode?: string;
}

class RejectDto {
  @IsString()
  @MaxLength(200)
  reason: string;
}

/**
 * ДАНСААР ШИЛЖҮҮЛЭХ ТӨЛБӨР.
 *
 * ⚠️⚠️ ГАРААР БАТАЛГААЖДАГ — QPay-ээс үндсэн ялгаа. Хэрэглэгч
 * шилжүүлээд «шилжүүлсэн» гэж мэдэгдэнэ, админ банкны хуулгаас
 * шалгаад баталгаажуулна.
 *
 * ⚠️ `bankReference` (гүйлгээний утга) нь ЦОРЫН ГАНЦ таних тэмдэг.
 * Хэрэглэгч түүнийг бичихгүй бол админ хэний мөнгө болохыг мэдэхгүй.
 */
@Injectable()
export class BankService {
  private readonly logger = new Logger(BankService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly promotions: PromotionsService,
    private readonly coupons: CouponsService,
    private readonly n8n: N8nService,
    private readonly email: EmailService,
  ) {}

  async settings(): Promise<BankSettings> {
    const row = await this.prisma.settings
      .findUnique({ where: { key: BANK_KEY } })
      .catch(() => null);
    return { ...DEFAULT_BANK, ...((row?.value as Partial<BankSettings>) ?? {}) };
  }

  /**
   * Нийтэд харуулах тохиргоо.
   *
   * ⚠️ Унтраалттай үед дансны дугаарыг ОГТ буцаахгүй — эс бөгөөс
   * хэрэглэгч DevTools-оор хараад хуучин данс руу шилжүүлнэ.
   */
  async publicSettings() {
    const s = await this.settings();
    if (!s.enabled) return { enabled: false };
    return s;
  }

  async updateSettings(dto: BankSettingsDto): Promise<BankSettings> {
    const cur = await this.settings();
    const next: BankSettings = {
      enabled: dto.enabled ?? cur.enabled,
      bankName: dto.bankName?.trim() ?? cur.bankName,
      accountNumber: dto.accountNumber?.trim() ?? cur.accountNumber,
      accountName: dto.accountName?.trim() ?? cur.accountName,
      note: dto.note?.trim() ?? cur.note,
    };

    /* ⚠️ Дутуу мэдээлэлтэй асаавал хэрэглэгч хаашаа шилжүүлэхээ мэдэхгүй */
    if (next.enabled && (!next.bankName || !next.accountNumber || !next.accountName)) {
      throw new BadRequestException('Асаахын өмнө банк, данс, эзэмшигчийн нэрийг бөглөнө үү');
    }

    await this.prisma.settings.upsert({
      where: { key: BANK_KEY },
      create: { key: BANK_KEY, value: next as object },
      update: { value: next as object },
    });
    return next;
  }

  /**
   * Гүйлгээний утга үүсгэнэ — «BTV-4F2A».
   *
   * ⚠️ Богино байх ЁСТОЙ: хэрэглэгч утсаараа банкны апп руу гараар
   * бичдэг. Урт код бичихдээ алдаа гаргаж, төлбөр танигдахгүй.
   * ⚠️ Андуурч уншихгүйн тулд O/0, I/1 хассан цагаан толгой.
   */
  private makeReference(): string {
    const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(4);
    let code = '';
    for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
    return `BTV-${code}`;
  }

  /**
   * Дансаар төлөх хүсэлт үүсгэнэ.
   *
   * ⚠️ Төлөв нь PENDING — эрх НЭЭГДЭХГҮЙ. Админ баталгаажуулмагц
   * `payments.completePayment` дуудагдаж багц идэвхжинэ.
   */
  async initiate(userId: string, dto: BankInitiateDto) {
    const cfg = await this.settings();
    if (!cfg.enabled) throw new BadRequestException('Дансаар төлөх боломж идэвхгүй байна');

    if (!dto.planId && !dto.topupAmount) {
      throw new BadRequestException('Багц эсвэл цэнэглэх дүнг заана уу');
    }

    /* ─── Хэтэвч цэнэглэх ─── */
    if (dto.topupAmount) {
      return this.createPending(userId, {
        amount: dto.topupAmount,
        isWalletTopup: true,
      });
    }

    /* ─── Багц авах ─── */
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Багц олдсонгүй');

    /**
     * ⚠️⚠️ ҮНИЙГ ЭНД БОДНО — QPay-тэй ЯГ ИЖИЛ дараалал
     * (урамшуулал → купон). Өөр үнэ гаргавал хэрэглэгч дансаар
     * илүү/дутуу төлж, гараар засах ажил үүснэ.
     */
    const promoMap = await this.promotions.forPlans(
      [{ id: plan.id, price: plan.price, durationDays: plan.durationDays }],
      userId,
    );
    const promo = promoMap.get(plan.id) ?? null;
    let amount = promo?.finalPrice ?? plan.price;

    let normalizedCoupon: string | undefined;
    if (dto.couponCode) {
      if (promo?.blockCoupons) {
        throw new BadRequestException(
          `«${promo.name}» урамшууллын үед купон код ашиглах боломжгүй`,
        );
      }
      const r = await this.coupons.validate({ code: dto.couponCode, price: amount });
      amount = r.finalPrice;
      normalizedCoupon = dto.couponCode.toUpperCase().trim();
    }

    return this.createPending(userId, {
      amount,
      planId: plan.id,
      promotionId: promo?.id ?? null,
      couponCode: normalizedCoupon,
      originalAmount: normalizedCoupon || promo ? plan.price : undefined,
    });
  }

  /** PENDING төлбөр + давтагдашгүй гүйлгээний утга */
  private async createPending(
    userId: string,
    data: {
      amount: number;
      planId?: string;
      isWalletTopup?: boolean;
      promotionId?: string | null;
      couponCode?: string;
      originalAmount?: number;
    },
  ) {
    /**
     * ⚠️ IDEMPOTENT — хэрэглэгч товчоо 2 удаа дарвал ХОЁР гүйлгээний
     * утга үүсч, аль нэгээр нь шилжүүлэхэд нөгөө нь мөнхөд PENDING
     * үлдэнэ. Сүүлийн 24 цагийн ижил хүсэлтийг ДАХИН ашиглана.
     */
    const existing = await this.prisma.payment.findFirst({
      where: {
        userId,
        status: PaymentStatus.PENDING,
        bankReference: { not: null },
        amount: data.amount,
        planId: data.planId ?? null,
        isWalletTopup: data.isWalletTopup ?? false,
        createdAt: { gte: new Date(Date.now() - 24 * 3600_000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return {
        paymentId: existing.id,
        reference: existing.bankReference,
        amount: existing.amount,
        claimed: existing.bankClaimedAt !== null,
      };
    }

    /* ⚠️ Давхардвал дахин оролдоно — `bankReference` нь unique */
    let payment: { id: string; bankReference: string | null; amount: number } | null = null;
    for (let i = 0; i < 5 && !payment; i++) {
      const reference = this.makeReference();
      payment = await this.prisma.payment
        .create({
          data: {
            userId,
            amount: data.amount,
            status: PaymentStatus.PENDING,
            planId: data.planId,
            isWalletTopup: data.isWalletTopup ?? false,
            promotionId: data.promotionId ?? null,
            couponCode: data.couponCode,
            originalAmount: data.originalAmount,
            bankReference: reference,
          },
          select: { id: true, bankReference: true, amount: true },
        })
        .catch(() => null);
    }
    if (!payment) throw new BadRequestException('Гүйлгээний утга үүсгэж чадсангүй, дахин оролдоно уу');

    return {
      paymentId: payment.id,
      reference: payment.bankReference,
      amount: payment.amount,
      claimed: false,
    };
  }

  /**
   * Хэрэглэгч «шилжүүлсэн» гэж мэдэгдэнэ.
   *
   * ⚠️ ЭРХ НЭЭГДЭХГҮЙ — зөвхөн админд дохио өгнө. Итгэлээр эрх
   * нээвэл шилжүүлээгүй хүн ч үнэгүй үзнэ.
   */
  async claim(userId: string, paymentId: string) {
    const p = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId, status: PaymentStatus.PENDING, bankReference: { not: null } },
      include: {
        plan: { select: { name: true } },
        rentalTitle: { select: { title: true } },
        user: { select: { name: true, email: true } },
      },
    });
    if (!p) throw new NotFoundException('Төлбөр олдсонгүй');

    /* ⚠️ Давтан дарахад мэдэгдэл дахин илгээхгүй */
    if (p.bankClaimedAt) return { ok: true, alreadyClaimed: true };

    await this.prisma.payment.update({
      where: { id: p.id },
      data: { bankClaimedAt: new Date() },
    });

    this.n8n.emitBankTransfer({
      paymentId: p.id,
      reference: p.bankReference!,
      userName: p.user?.name ?? null,
      userEmail: p.user?.email ?? '',
      amount: p.amount,
      planName: p.plan?.name ?? (p.isWalletTopup ? 'Хэтэвч цэнэглэх' : null),
      titleName: p.rentalTitle?.title ?? null,
      claimedAt: new Date().toISOString(),
    });

    this.logger.log(`Дансны төлбөр мэдэгдэв: ${p.bankReference} (${p.amount}₮) user=${userId}`);
    return { ok: true, alreadyClaimed: false };
  }

  /** Хэрэглэгчийн хүлээгдэж буй дансны төлбөрүүд */
  async mine(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId, bankReference: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        amount: true,
        status: true,
        bankReference: true,
        bankClaimedAt: true,
        bankRejectReason: true,
        createdAt: true,
        isWalletTopup: true,
        plan: { select: { name: true } },
      },
    });
  }

  // ─── АДМИН ───────────────────────────────────────────────────────────────

  /**
   * Админы жагсаалт.
   * ⚠️ Мэдэгдсэн (`claimed`) нь ЭХЭНД — тэдгээр нь хүлээж байгаа хүн.
   */
  async adminList(status?: string) {
    const where =
      status === 'pending'
        ? { status: PaymentStatus.PENDING, bankClaimedAt: { not: null } }
        : status === 'waiting'
          ? { status: PaymentStatus.PENDING, bankClaimedAt: null }
          : { bankReference: { not: null } };

    return this.prisma.payment.findMany({
      where: { bankReference: { not: null }, ...where },
      orderBy: [{ bankClaimedAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        amount: true,
        originalAmount: true,
        status: true,
        bankReference: true,
        bankClaimedAt: true,
        bankReviewedAt: true,
        bankRejectReason: true,
        couponCode: true,
        createdAt: true,
        isWalletTopup: true,
        plan: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Админ баталгаажуулна → эрх нээгдэнэ.
   *
   * ⚠️⚠️ `payments.completePayment` дуудна — тэр нь багц/түрээс/
   * цэнэглэлт бүх салааг зөв боловсруулж, урамшууллын бонус олгож,
   * имэйл илгээнэ. Энд дахин бичвэл логик хоёр газар зөрнө.
   */
  async approve(paymentId: string, adminId: string) {
    const p = await this.prisma.payment.findFirst({
      where: { id: paymentId, bankReference: { not: null } },
      select: { id: true, status: true, bankReference: true, amount: true },
    });
    if (!p) throw new NotFoundException('Төлбөр олдсонгүй');
    if (p.status === PaymentStatus.PAID) {
      return { ok: true, alreadyPaid: true };
    }
    if (p.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Энэ төлбөр цуцлагдсан эсвэл хугацаа дууссан байна');
    }

    await this.prisma.payment.update({
      where: { id: p.id },
      data: { bankReviewedAt: new Date(), bankRejectReason: null },
    });
    await this.payments.completePayment(p.id);

    this.logger.log(
      `Дансны төлбөр баталгаажлаа: ${p.bankReference} (${p.amount}₮) admin=${adminId}`,
    );
    return { ok: true, alreadyPaid: false };
  }

  /** Татгалзах — хэрэглэгчид шалтгаан имэйлээр очно */
  async reject(paymentId: string, reason: string, adminId: string) {
    const p = await this.prisma.payment.findFirst({
      where: { id: paymentId, bankReference: { not: null }, status: PaymentStatus.PENDING },
      include: { user: { select: { email: true, name: true } }, plan: { select: { name: true } } },
    });
    if (!p) throw new NotFoundException('Хүлээгдэж буй төлбөр олдсонгүй');

    await this.prisma.payment.update({
      where: { id: p.id },
      data: {
        status: PaymentStatus.CANCELLED,
        bankReviewedAt: new Date(),
        bankRejectReason: reason.trim(),
      },
    });

    /**
     * ⚠️ ИМЭЙЛ ЗААВАЛ — хэрэглэгч мөнгөө шилжүүлсэн гэж бодож
     * хүлээж байна. Чимээгүй татгалзвал гомдол болно.
     * ⚠️ `sendBankRejected` байхгүй бол чимээгүй алгасна (email
     * service-д нэмэгдэх хүртэл төлбөрийн урсгал зогсохгүй).
     */
    try {
      const svc = this.email as unknown as {
        sendBankRejected?: (a: unknown) => void;
      };
      svc.sendBankRejected?.({
        to: p.user?.email,
        name: p.user?.name,
        amount: p.amount,
        reference: p.bankReference,
        planName: p.plan?.name ?? null,
        reason: reason.trim(),
      });
    } catch (e) {
      this.logger.warn(`Татгалзсан имэйл илгээгдсэнгүй: ${String(e)}`);
    }

    this.logger.log(`Дансны төлбөр татгалзлаа: ${p.bankReference} admin=${adminId} — ${reason}`);
    return { ok: true };
  }
}

@Controller('bank')
export class BankController {
  constructor(private readonly svc: BankService) {}

  /** Дансны мэдээлэл — модалд харуулна */
  @Get('settings')
  settings() {
    return this.svc.publicSettings();
  }

  /**
   * ⚠️ Throttle — гүйлгээний утга үүсгэх нь DB бичилт хийдэг тул
   * хязгааргүй бол хэдэн мянган хоосон PENDING мөр үүсгэж болно.
   */
  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  initiate(@CurrentUser() user: JwtPayload, @Body() dto: BankInitiateDto) {
    return this.svc.initiate(user.sub, dto);
  }

  @Post(':id/claim')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  claim(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.claim(user.sub, id);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: JwtPayload) {
    return this.svc.mine(user.sub);
  }
}

@Controller('admin/bank')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class BankAdminController {
  constructor(private readonly svc: BankService) {}

  @Get('settings')
  settings() {
    return this.svc.settings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: BankSettingsDto) {
    return this.svc.updateSettings(dto);
  }

  @Get('payments')
  list(@Query('status') status?: string) {
    return this.svc.adminList(status);
  }

  @Post('payments/:id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.approve(id, user.sub);
  }

  @Post('payments/:id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectDto, @CurrentUser() user: JwtPayload) {
    return this.svc.reject(id, dto.reason, user.sub);
  }
}

@Module({
  /* ⚠️ PaymentsModule — `completePayment` дуудна (эрх нээх логик тэнд).
     CouponsModule/PromotionsModule — үнэ бодоход. */
  imports: [PaymentsModule, PromotionsModule, CouponsModule],
  controllers: [BankController, BankAdminController],
  providers: [BankService],
  exports: [BankService],
})
export class BankModule {}
