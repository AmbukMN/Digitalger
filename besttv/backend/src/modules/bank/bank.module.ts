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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { NotificationType, PaymentStatus, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
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
import { NotificationsService } from '../notifications/notifications.module';
import { EmailService } from '../email/email.service';

const BANK_KEY = 'bank';

/**
 * ⚠️ Дансны ЖАГСААЛТ нь `BankAccount` хүснэгтэд. Энд зөвхөн
 * НИЙТЛЭГ тохиргоо (асаах/унтраах, заавар, баримт шаардах эсэх).
 */
interface BankSettings {
  enabled: boolean;
  note: string;
  /** ⚠️ Баримт (screenshot) заавал эсэх — админ шийднэ */
  requireReceipt: boolean;
}

const DEFAULT_BANK: BankSettings = {
  enabled: false,
  note: 'Гүйлгээний утгыг ЗААВАЛ бичнэ үү. Ажлын цагаар 1-3 цагийн дотор баталгаажна.',
  requireReceipt: false,
};

class BankSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsOptional()
  @IsBoolean()
  requireReceipt?: boolean;
}

class BankAccountDto {
  @IsString()
  @MaxLength(60)
  bankName: string;

  @IsOptional()
  @IsString()
  logoKey?: string;

  @IsString()
  @MaxLength(40)
  accountNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  iban?: string;

  @IsString()
  @MaxLength(80)
  accountName: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;
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

  /** Аль данс руу шилжүүлэх (хоосон бол эхний идэвхтэй) */
  @IsOptional()
  @IsString()
  bankAccountId?: string;
}

class ClaimDto {
  /** Төлбөрийн баримтын R2 key (upload хийсний дараа) */
  @IsOptional()
  @IsString()
  receiptKey?: string;
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
 * 6 оронтой ТОО — утсан дээр тоон гараар шууд бичигдэнэ.
 */
@Injectable()
export class BankService {
  private readonly logger = new Logger(BankService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly payments: PaymentsService,
    private readonly promotions: PromotionsService,
    private readonly coupons: CouponsService,
    private readonly n8n: N8nService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
  ) {}

  // ─── ТОХИРГОО ────────────────────────────────────────────────────────────

  async settings(): Promise<BankSettings> {
    const row = await this.prisma.settings
      .findUnique({ where: { key: BANK_KEY } })
      .catch(() => null);
    return { ...DEFAULT_BANK, ...((row?.value as Partial<BankSettings>) ?? {}) };
  }

  async updateSettings(dto: BankSettingsDto): Promise<BankSettings> {
    const cur = await this.settings();
    const next: BankSettings = {
      enabled: dto.enabled ?? cur.enabled,
      note: dto.note?.trim() ?? cur.note,
      requireReceipt: dto.requireReceipt ?? cur.requireReceipt,
    };

    /* ⚠️ Данс огт байхгүй байхад асаавал хэрэглэгч хаашаа шилжүүлэхээ
       мэдэхгүй ХООСОН модал харна */
    if (next.enabled) {
      const count = await this.prisma.bankAccount.count({ where: { isActive: true } });
      if (count === 0) {
        throw new BadRequestException('Асаахын өмнө дор хаяж нэг идэвхтэй данс нэмнэ үү');
      }
    }

    await this.prisma.settings.upsert({
      where: { key: BANK_KEY },
      create: { key: BANK_KEY, value: next as object },
      update: { value: next as object },
    });
    return next;
  }

  // ─── ДАНСНУУД ────────────────────────────────────────────────────────────

  /** Логоны URL нэмж буцаана */
  private async withLogo<T extends { logoKey: string | null }>(row: T) {
    return {
      ...row,
      logoUrl: row.logoKey ? await this.storage.publicAssetUrl(row.logoKey, 7200) : null,
    };
  }

  /**
   * Нийтэд харагдах данснууд.
   *
   * ⚠️ Унтраалттай үед ХООСОН — эс бөгөөс хэрэглэгч DevTools-оор
   * хараад хуучин данс руу шилжүүлнэ.
   */
  async publicAccounts() {
    const cfg = await this.settings();
    if (!cfg.enabled) {
      return { enabled: false, note: '', requireReceipt: false, accounts: [] };
    }

    const rows = await this.prisma.bankAccount.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      enabled: true,
      note: cfg.note,
      requireReceipt: cfg.requireReceipt,
      accounts: await Promise.all(rows.map((r) => this.withLogo(r))),
    };
  }

  async adminAccounts() {
    const rows = await this.prisma.bankAccount.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { payments: true } } },
    });
    return Promise.all(rows.map((r) => this.withLogo(r)));
  }

  createAccount(dto: BankAccountDto) {
    return this.prisma.bankAccount.create({
      data: {
        bankName: dto.bankName.trim(),
        logoKey: dto.logoKey || null,
        accountNumber: dto.accountNumber.trim(),
        /* ⚠️ IBAN-аас ЗАЙГ хасна — хэрэглэгч хуулахад зай орвол
           банкны апп татгалзана */
        iban: dto.iban?.replace(/\s+/g, '').toUpperCase() || null,
        accountName: dto.accountName.trim(),
        isActive: dto.isActive ?? true,
        order: dto.order ?? 0,
      },
    });
  }

  async updateAccount(id: string, dto: Partial<BankAccountDto>) {
    const exists = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Данс олдсонгүй');

    return this.prisma.bankAccount.update({
      where: { id },
      data: {
        ...(dto.bankName != null ? { bankName: dto.bankName.trim() } : {}),
        ...(dto.logoKey !== undefined ? { logoKey: dto.logoKey || null } : {}),
        ...(dto.accountNumber != null ? { accountNumber: dto.accountNumber.trim() } : {}),
        ...(dto.iban !== undefined
          ? { iban: dto.iban?.replace(/\s+/g, '').toUpperCase() || null }
          : {}),
        ...(dto.accountName != null ? { accountName: dto.accountName.trim() } : {}),
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
        ...(dto.order != null ? { order: dto.order } : {}),
      },
    });
  }

  async removeAccount(id: string) {
    const acc = await this.prisma.bankAccount.findUnique({
      where: { id },
      select: { id: true, _count: { select: { payments: true } } },
    });
    if (!acc) throw new NotFoundException('Данс олдсонгүй');

    /**
     * ⚠️⚠️ ТӨЛБӨРТЭЙ ДАНСЫГ УСТГАХГҮЙ — `Payment.bankAccountId` нь
     * SetNull тул устгавал «аль данс руу төлсөн» түүх алга болно.
     * Санхүүгийн маргаанд баталгаа үгүй болно.
     */
    if (acc._count.payments > 0) {
      throw new BadRequestException(
        `Энэ данс руу ${acc._count.payments} төлбөр хийгдсэн тул устгах боломжгүй. Идэвхгүй болгоно уу.`,
      );
    }

    await this.prisma.bankAccount.delete({ where: { id } });
    return { ok: true };
  }

  // ─── ТӨЛБӨР ──────────────────────────────────────────────────────────────

  /**
   * Гүйлгээний утга — «482913» (6 ОРОНТОЙ ТОО).
   *
   * ⚠️⚠️ ЗӨВХӨН ТОО. Өмнө нь «BTV-MPQD» байсан нь бодит хэрэглээнд
   * хэцүү байв: банкны апп утсан дээр, үсэг бичихэд гар солино,
   * M/N, P/Q андуурагдана. Тоон гар нь шууд, OTP-той адил танил.
   *
   * ⚠️ 100000-999999 — эхлээд 0 гарахгүй (банкны апп таслаж мэднэ).
   */
  private makeReference(): string {
    /* ⚠️ `Math.random` БИШ — таамаглах боломжгүй байх ёстой */
    const n = randomBytes(4).readUInt32BE(0);
    return String(100000 + (n % 900000));
  }

  async initiate(userId: string, dto: BankInitiateDto) {
    const cfg = await this.settings();
    if (!cfg.enabled) throw new BadRequestException('Дансаар төлөх боломж идэвхгүй байна');

    if (!dto.planId && !dto.topupAmount) {
      throw new BadRequestException('Багц эсвэл цэнэглэх дүнг заана уу');
    }

    /* ⚠️ Данс сонгоогүй бол эхний идэвхтэйг авна */
    const account = dto.bankAccountId
      ? await this.prisma.bankAccount.findFirst({
          where: { id: dto.bankAccountId, isActive: true },
        })
      : await this.prisma.bankAccount.findFirst({
          where: { isActive: true },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        });
    if (!account) throw new BadRequestException('Идэвхтэй данс олдсонгүй');

    /* ─── Хэтэвч цэнэглэх ─── */
    if (dto.topupAmount) {
      return this.createPending(userId, {
        amount: dto.topupAmount,
        isWalletTopup: true,
        bankAccountId: account.id,
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
      /* ⚠️ `userId` ЗААВАЛ — хувийн купоныг өөр хүн ашиглахаас хамгаална */
      const r = await this.coupons.validate({ code: dto.couponCode, price: amount }, userId);
      amount = r.finalPrice;
      normalizedCoupon = dto.couponCode.toUpperCase().trim();
    }

    return this.createPending(userId, {
      amount,
      planId: plan.id,
      bankAccountId: account.id,
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
      bankAccountId: string;
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
        /**
         * ⚠️⚠️ МЭДЭГДСЭНИЙГ ДАХИН АШИГЛАХГҮЙ.
         *
         * Хэрэглэгч «Шилжүүлсэн» дараад дараа нь ДАХИН «Дансаар
         * шилжүүлэх» дарвал өмнөх (claimed) захиалга буцаж, модал нь
         * шууд «Хүлээн авлаа» дэлгэц харуулдаг байв — шинэ гүйлгээ
         * хийх боломжгүй (хэрэглэгчийн скриншот).
         *
         * `bankClaimedAt: null` нөхцөл нь ЗӨВХӨН хараахан мэдэгдээгүй
         * захиалгыг дахин ашиглана. Мэдэгдсэн бол ШИНЭ утга үүснэ.
         */
        bankClaimedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      /* ⚠️ Хэрэглэгч ӨӨР данс сонгосон бол шинэчилнэ (шинэ утга биш) */
      if (existing.bankAccountId !== data.bankAccountId) {
        await this.prisma.payment.update({
          where: { id: existing.id },
          data: { bankAccountId: data.bankAccountId },
        });
      }
      return {
        paymentId: existing.id,
        reference: existing.bankReference,
        amount: existing.amount,
        claimed: existing.bankClaimedAt !== null,
      };
    }

    /* ⚠️ Давхардвал дахин оролдоно — `bankReference` нь unique */
    let payment: { id: string; bankReference: string | null; amount: number } | null = null;
    for (let i = 0; i < 6 && !payment; i++) {
      const reference = this.makeReference();
      payment = await this.prisma.payment
        .create({
          data: {
            userId,
            amount: data.amount,
            status: PaymentStatus.PENDING,
            planId: data.planId,
            isWalletTopup: data.isWalletTopup ?? false,
            bankAccountId: data.bankAccountId,
            promotionId: data.promotionId ?? null,
            couponCode: data.couponCode,
            originalAmount: data.originalAmount,
            bankReference: reference,
          },
          select: { id: true, bankReference: true, amount: true },
        })
        .catch(() => null);
    }
    if (!payment) {
      throw new BadRequestException('Гүйлгээний утга үүсгэж чадсангүй, дахин оролдоно уу');
    }

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
   * ⚠️ ЭРХ НЭЭГДЭХГҮЙ — зөвхөн админд дохио өгнө.
   */
  async claim(userId: string, paymentId: string, receiptKey?: string) {
    const cfg = await this.settings();

    const p = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        userId,
        status: PaymentStatus.PENDING,
        bankReference: { not: null },
      },
      include: {
        plan: { select: { name: true } },
        rentalTitle: { select: { title: true } },
        user: { select: { name: true, email: true } },
      },
    });
    if (!p) throw new NotFoundException('Төлбөр олдсонгүй');

    /* ⚠️ Баримт заавал бол шалгана — админы шийдвэрийг хүндэтгэнэ */
    if (cfg.requireReceipt && !receiptKey && !p.bankReceiptKey) {
      throw new BadRequestException('Төлбөрийн баримтын зургаа хавсаргана уу');
    }

    /* ⚠️ Давтан дарахад мэдэгдэл дахин илгээхгүй, гэхдээ баримт
       нэмж хавсаргаж БОЛНО (эхлээд мартсан байж болно) */
    const alreadyClaimed = p.bankClaimedAt !== null;

    await this.prisma.payment.update({
      where: { id: p.id },
      data: {
        bankClaimedAt: p.bankClaimedAt ?? new Date(),
        ...(receiptKey ? { bankReceiptKey: receiptKey } : {}),
      },
    });

    if (!alreadyClaimed) {
      /* ⚠️ Баримттай эсэхийг Telegram-д хэлнэ — админ баримтгүйг
         илүү нягт шалгах хэрэгтэй гэдгээ шууд мэднэ */
      const hasReceipt = !!(receiptKey || p.bankReceiptKey);
      this.n8n.emitBankTransfer({
        paymentId: p.id,
        reference: p.bankReference!,
        userName: p.user?.name ?? null,
        userEmail: p.user?.email ?? '',
        amount: p.amount,
        planName:
          (p.plan?.name ?? (p.isWalletTopup ? 'Хэтэвч цэнэглэх' : null)) +
          (hasReceipt ? '' : ' ⚠️ БАРИМТГҮЙ'),
        titleName: p.rentalTitle?.title ?? null,
        claimedAt: new Date().toISOString(),
      });

      this.notifications.create(
        userId,
        NotificationType.INFO,
        'Шилжүүлгийг хүлээн авлаа',
        `${p.amount.toLocaleString()}₮ шилжүүлгийг шалгаж байна. Баталгаажмагц эрх тань нээгдэнэ.`,
        '/profile?tab=orders',
      );

      this.logger.log(`Дансны төлбөр мэдэгдэв: ${p.bankReference} (${p.amount}₮) user=${userId}`);
    }

    return { ok: true, alreadyClaimed };
  }

  /**
   * ТӨЛБӨРИЙН БАРИМТ (screenshot) upload.
   *
   * ⚠️⚠️ ЭНЭ НЬ ХЭРЭГЛЭГЧИЙН endpoint — `admin/uploads` нь зөвхөн
   * админд нээлттэй тул тэрийг ашиглах БОЛОМЖГҮЙ.
   *
   * ⚠️ Зургийг WebP болгож ШАХНА (1200px) — банкны апп-ын screenshot
   * нь 2-4 MB байдаг, шахахгүй бол R2 зай хурдан дүүрнэ.
   *
   * ⚠️ Хэрэглэгч ЗӨВХӨН ӨӨРИЙН PENDING төлбөрт хавсаргана —
   * `paymentId` шалгалт нь бусдын баримтыг солихоос хамгаална.
   */
  async uploadReceipt(
    userId: string,
    paymentId: string,
    file: { buffer: Buffer; mimetype: string },
  ) {
    const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
    if (!ALLOWED.has(file.mimetype)) {
      throw new BadRequestException('Зөвхөн зураг хавсаргана уу (JPG, PNG, WebP)');
    }

    const p = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        userId,
        status: PaymentStatus.PENDING,
        bankReference: { not: null },
      },
      select: { id: true },
    });
    if (!p) throw new NotFoundException('Төлбөр олдсонгүй');

    const sharp = (await import('sharp')).default;
    const buf = await sharp(file.buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();

    const key = `images/receipt/${randomBytes(16).toString('hex')}.webp`;
    await this.storage.upload(key, buf, 'image/webp');

    await this.prisma.payment.update({
      where: { id: p.id },
      data: { bankReceiptKey: key },
    });

    return { key, url: await this.storage.publicAssetUrl(key, 7200) };
  }

  /** Хэрэглэгчийн дансны төлбөрүүд */
  async mine(userId: string) {
    const rows = await this.prisma.payment.findMany({
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
        bankReceiptKey: true,
        createdAt: true,
        isWalletTopup: true,
        plan: { select: { name: true } },
        bankAccount: { select: { bankName: true } },
      },
    });

    return Promise.all(
      rows.map(async (r) => ({
        ...r,
        receiptUrl: r.bankReceiptKey
          ? await this.storage.publicAssetUrl(r.bankReceiptKey, 7200)
          : null,
      })),
    );
  }

  // ─── АДМИН ───────────────────────────────────────────────────────────────

  /**
   * Шүүлтийн нөхцөлийг НЭГ цэгээс — жагсаалт, статистик, export
   * бүгд ижил дүрмээр ажиллана.
   *
   * ⚠️ Гурав тусад нь бичвэл нэгийг засахад бусад нь зөрж, «жагсаалт
   * 5 мөр харуулж байхад статистик 12 гэж бичих» гэсэн итгэл алдах
   * зөрчил үүснэ.
   */
  private bankWhere(o: { status?: string; from?: string; to?: string; q?: string }) {
    const base: Record<string, unknown> = { bankReference: { not: null } };

    /**
     * ⚠️⚠️ ХАЙЛТ СЕРВЕР ТАЛД — өмнө нь ЗӨВХӨН client талд байсан.
     *
     * БОДИТ АЛДАА: жагсаалт нь `take: 200`-аар таслагддаг байсан тул
     * админ 200 дахь мөрнөөс ХОЙШХИ гүйлгээг хайхад «олдсонгүй» гэж
     * гарна — гэтэл DB-д БАЙГАА. Банкны хуулгатай тулгаж байхад
     * «энэ гүйлгээ манайд ирээгүй» гэж буруу дүгнэх эрсдэлтэй.
     */
    if (o.q?.trim()) {
      const q = o.q.trim();
      base.OR = [
        { bankReference: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        /* Дүнгээр хайх — «50000» гэж бичихэд олдоно */
        ...(Number.isFinite(Number(q)) && q !== '' ? [{ amount: Number(q) }] : []),
      ];
    }

    if (o.status === 'pending') {
      base.status = PaymentStatus.PENDING;
      base.bankClaimedAt = { not: null };
    } else if (o.status === 'waiting') {
      base.status = PaymentStatus.PENDING;
      base.bankClaimedAt = null;
    } else if (o.status === 'paid') {
      base.status = PaymentStatus.PAID;
    } else if (o.status === 'cancelled') {
      base.status = PaymentStatus.CANCELLED;
    }

    /* ⚠️ `to` нь ТУХАЙН ӨДРИЙГ ОРУУЛНА — «08-13 хүртэл» гэвэл
       08-13-ны 23:59 хүртэл. Эс бөгөөс тэр өдрийн төлбөр алга болно. */
    if (o.from || o.to) {
      const range: { gte?: Date; lt?: Date } = {};
      if (o.from) range.gte = new Date(o.from);
      if (o.to) {
        const end = new Date(o.to);
        end.setDate(end.getDate() + 1);
        range.lt = end;
      }
      base.createdAt = range;
    }
    return base;
  }

  /**
   * Дансны төлбөрийн статистик.
   *
   * ⚠️⚠️ Мөнгөний хуудас атлаа «өнөөдрийн баталгаажуулсан дүн хэд вэ»
   * гэсэн энгийн асуултад хариулах боломжгүй байв.
   */
  async adminStats(o: { status?: string; from?: string; to?: string }) {
    const where = this.bankWhere(o);

    const [pending, paid, cancelled, waiting] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.PENDING, bankClaimedAt: { not: null } },
        _count: { id: true },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.PAID },
        _count: { id: true },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.CANCELLED },
        _count: { id: true },
        _sum: { amount: true },
      }),
      this.prisma.payment.count({
        where: { ...where, status: PaymentStatus.PENDING, bankClaimedAt: null },
      }),
    ]);

    return {
      pendingCount: pending._count.id,
      pendingAmount: pending._sum.amount ?? 0,
      paidCount: paid._count.id,
      paidAmount: paid._sum.amount ?? 0,
      cancelledCount: cancelled._count.id,
      cancelledAmount: cancelled._sum.amount ?? 0,
      waitingCount: waiting,
    };
  }

  /**
   * CSV export — шүүсэн БҮХ мөр (хуудаслалтгүй).
   * ⚠️ 20,000-аар хязгаарлана — санах ой хамгаална.
   */
  async adminExport(o: { status?: string; from?: string; to?: string; q?: string }) {
    const rows = await this.prisma.payment.findMany({
      where: this.bankWhere(o),
      orderBy: { createdAt: 'desc' },
      take: 20_000,
      select: {
        bankReference: true,
        amount: true,
        originalAmount: true,
        status: true,
        isWalletTopup: true,
        couponCode: true,
        bankClaimedAt: true,
        bankReviewedAt: true,
        bankRejectReason: true,
        bankReceiptKey: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
        plan: { select: { name: true } },
        bankAccount: { select: { bankName: true } },
      },
    });

    const esc = (v: unknown) => {
      const str = v == null ? '' : String(v);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const header = [
      'Гүйлгээний утга',
      'Огноо',
      'Хэрэглэгч',
      'Имэйл',
      'Юуны төлөө',
      'Банк',
      'Дүн',
      'Хуучин дүн',
      'Купон',
      'Төлөв',
      'Мэдэгдсэн',
      'Шалгасан',
      'Татгалзсан шалтгаан',
      'Баримт',
    ];
    const lines = [
      header.join(','),
      ...rows.map((r) =>
        [
          r.bankReference ?? '',
          r.createdAt.toISOString(),
          r.user?.name ?? '',
          r.user?.email ?? '',
          r.isWalletTopup ? 'Хэтэвч цэнэглэлт' : (r.plan?.name ?? ''),
          r.bankAccount?.bankName ?? '',
          r.amount,
          r.originalAmount ?? '',
          r.couponCode ?? '',
          r.status,
          r.bankClaimedAt?.toISOString() ?? '',
          r.bankReviewedAt?.toISOString() ?? '',
          r.bankRejectReason ?? '',
          /* ⚠️ Баримтын URL БИШ «тийм/үгүй» — presign холбоос 2 цагийн
             дараа үхнэ, CSV нь архивт үлддэг */
          r.bankReceiptKey ? 'тийм' : 'үгүй',
        ]
          .map(esc)
          .join(','),
      ),
    ];
    // ⚠️ BOM — Excel дээр кирилл үсэг зөв харагдана
    return { csv: '\ufeff' + lines.join('\n'), count: rows.length };
  }

  /**
   * ⚠️⚠️ ХУУДАСЛАЛТ — өмнө нь `take: 200` гэсэн ЧИМЭЭГҮЙ таслалт байв.
   *
   * 200-аас олон дансны төлбөр орсны дараа хуучин гүйлгээ жагсаалтад
   * ОГТ гарахгүй болно — админ түүнийг «байхгүй» гэж үзэж, хэрэглэгчийн
   * төлбөрийг хүлээн зөвшөөрөхгүй эрсдэлтэй. Одоо хуудаслаж бүгдийг
   * харна.
   */
  async adminList(o: {
    status?: string;
    from?: string;
    to?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(o.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(o.limit) || 50));
    const where = this.bankWhere(o);

    const total = await this.prisma.payment.count({ where });
    const rows = await this.prisma.payment.findMany({
      where,
      orderBy: [{ bankClaimedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        amount: true,
        originalAmount: true,
        status: true,
        bankReference: true,
        bankClaimedAt: true,
        bankReviewedAt: true,
        bankRejectReason: true,
        bankReceiptKey: true,
        couponCode: true,
        createdAt: true,
        isWalletTopup: true,
        plan: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
        bankAccount: { select: { id: true, bankName: true } },
      },
    });

    /* ⚠️ Баримтын URL — админ зургийг ШУУД харах ёстой (татаж
       үзэх нь удаан, ажлын урсгал тасална) */
    const items = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        receiptUrl: r.bankReceiptKey
          ? await this.storage.publicAssetUrl(r.bankReceiptKey, 7200)
          : null,
      })),
    );

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Админ баталгаажуулна → эрх нээгдэнэ.
   *
   * ⚠️⚠️ `payments.completePayment` дуудна — тэр нь багц/түрээс/
   * цэнэглэлт бүх салааг зөв боловсруулж, урамшууллын бонус олгож,
   * имэйл илгээнэ.
   */
  async approve(paymentId: string, adminId: string) {
    const p = await this.prisma.payment.findFirst({
      where: { id: paymentId, bankReference: { not: null } },
      select: {
        id: true,
        userId: true,
        status: true,
        bankReference: true,
        amount: true,
        isWalletTopup: true,
        plan: { select: { name: true } },
      },
    });
    if (!p) throw new NotFoundException('Төлбөр олдсонгүй');
    if (p.status === PaymentStatus.PAID) return { ok: true, alreadyPaid: true };
    if (p.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Энэ төлбөр цуцлагдсан эсвэл хугацаа дууссан байна');
    }

    await this.prisma.payment.update({
      where: { id: p.id },
      data: { bankReviewedAt: new Date(), bankRejectReason: null },
    });
    await this.payments.completePayment(p.id);

    /* ⚠️ ХЭРЭГЛЭГЧИД МЭДЭГДЭНЭ — тэр хүлээж сууж байна */
    this.notifications.create(
      p.userId,
      NotificationType.PAYMENT_APPROVED,
      'Төлбөр баталгаажлаа',
      p.isWalletTopup
        ? `${p.amount.toLocaleString()}₮ хэтэвчинд нэмэгдлээ.`
        : `«${p.plan?.name ?? 'Багц'}» идэвхжлээ. Одоо үзэж эхлээрэй!`,
      p.isWalletTopup ? '/profile?tab=wallet' : '/',
    );

    this.logger.log(
      `Дансны төлбөр баталгаажлаа: ${p.bankReference} (${p.amount}₮) admin=${adminId}`,
    );
    return { ok: true, alreadyPaid: false };
  }

  /** Татгалзах — хэрэглэгчид мэдэгдэл + имэйл */
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
     * ⚠️⚠️ МЭДЭГДЭЛ ЗААВАЛ — хэрэглэгч мөнгөө шилжүүлсэн гэж бодож
     * хүлээж байна. Чимээгүй татгалзвал гомдол болно.
     */
    this.notifications.create(
      p.userId,
      NotificationType.PAYMENT_REJECTED,
      'Төлбөр баталгаажаагүй',
      `${p.amount.toLocaleString()}₮ (утга: ${p.bankReference}) — ${reason.trim()}`,
      '/profile?tab=orders',
    );

    /* ⚠️ Имэйл нь нэмэлт суваг — байхгүй бол чимээгүй алгасна */
    try {
      const svc = this.email as unknown as { sendBankRejected?: (a: unknown) => void };
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

  /** Данснууд + тохиргоо — модалд харуулна */
  @Get('accounts')
  accounts() {
    return this.svc.publicAccounts();
  }

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  initiate(@CurrentUser() user: JwtPayload, @Body() dto: BankInitiateDto) {
    return this.svc.initiate(user.sub, dto);
  }

  @Post(':id/claim')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  claim(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ClaimDto) {
    return this.svc.claim(user.sub, id, dto?.receiptKey);
  }

  /**
   * Төлбөрийн баримт хавсаргах.
   *
   * ⚠️ 15 MB хязгаар — утасны screenshot 2-4 MB, зарим шинэ утас
   * 8 MB хүртэл. 15 нь аюулгүй зай.
   */
  @Post(':id/receipt')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  uploadReceipt(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Файл сонгоогүй байна');
    return this.svc.uploadReceipt(user.sub, id, file);
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

  @Get('accounts')
  accounts() {
    return this.svc.adminAccounts();
  }

  @Post('accounts')
  createAccount(@Body() dto: BankAccountDto) {
    return this.svc.createAccount(dto);
  }

  @Patch('accounts/:id')
  updateAccount(@Param('id') id: string, @Body() dto: Partial<BankAccountDto>) {
    return this.svc.updateAccount(id, dto);
  }

  @Delete('accounts/:id')
  removeAccount(@Param('id') id: string) {
    return this.svc.removeAccount(id);
  }

  @Get('payments')
  list(
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    /* ⚠️ Хайлт СЕРВЕР талд — 200-гийн таслалтаас цааш хайхад ч олдоно */
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.adminList({
      status,
      from,
      to,
      q,
      page: Number(page),
      limit: Number(limit),
    });
  }

  /** Статистик — шүүлттэй ижил нөхцөлөөр */
  @Get('payments/stats')
  stats(
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.adminStats({ status, from, to });
  }

  /** CSV export — нягтлан бодох бүртгэлд */
  /**
   * ⚠️ CSV нь ЖАГСААЛТТАЙ ИЖИЛ шүүлттэй байх ЁСТОЙ —  дамжуулахгүй
   * бол админ хайлт хийж 5 мөр хараад CSV дарахад МЯНГА татагдана.
   */
  @Get('payments/export')
  exportCsv(
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
  ) {
    return this.svc.adminExport({ status, from, to, q });
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
