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
import { Throttle } from '@nestjs/throttler';
/* ⚠️ `PaymentStatus` — хэтэвчээр төлсөн түрээсийн `Payment` мөрд */
import { PaymentStatus, Role, WalletTxType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { WalletService } from '../wallet/wallet.module';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { assertTitleOnSite } from '../../common/site/site-guard';
import { TitleMediaHelper } from '../titles/title-media.helper';
import { EmailService } from '../email/email.service';
/* ⚠️ Meta Conversions API — хэтэвчийн түрээсийн Purchase үйл явдалд */
import { MetaCapiService } from '../analytics/meta-capi.service';
import { WalletModule } from '../wallet/wallet.module';
import { TitlesModule } from '../titles/titles.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { siteKey } from '../../common/site/site-settings-key';

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

/**
 * ⚠️⚠️ ХООСОН БИЕТЭЙ — түрээсэд КУПОН ДЭМЖИГДЭХГҮЙ.
 *
 * Өмнө нь `couponCode?: string` талбартай байсан ч `rentWallet` нь
 * түүнийг ОГТ АШИГЛАДАГГҮЙ байв (`_dto` гэж зөвхөн залгидаг). Хэрэглэгч
 * купон илгээвэл чимээгүй үл тоомсорлогдож БҮТЭН үнэ хасагдана —
 * frontend "хямдрал орлоо" гэж харуулсан бол шууд гомдол.
 *
 * Хуурамч амлалт өгөхөөс талбарыг ХАСАХ нь шударга. Түрээсэд купон
 * хэрэгтэй болбол `rentWithWallet`-д бодитоор хэрэгжүүлж, дараа нь
 * энд буцааж нэмнэ.
 *
 * ⚠️ Класс өөрөө ҮЛДЭНЭ — глобал `ValidationPipe`-ийн
 * `forbidNonWhitelisted` нь илүү талбар илгээвэл 400 буцаана.
 */
class RentDto {}

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
    /* ⚠️ Meta Purchase — хэтэвчийн зам `completePayment`-ыг ТОЙРДОГ
       тул CAPI-г ЭНД шууд дуудна (доорх `rentWithWallet`-ыг үз) */
    private readonly capi: MetaCapiService,
  ) {}

  /** Сайтын нийтлэг түрээсийн тохиргоо */
  async settings(): Promise<RentSettings> {
    const row = await this.prisma.settings
      .findUnique({ where: { key: siteKey(RENT_KEY) } })
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
      where: { key: siteKey(RENT_KEY) },
      create: { key: siteKey(RENT_KEY), value: next as object },
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
        select: {
          id: true,
          title: true,
          isPremium: true,
          rentPrice: true,
          rentHours: true,
          rentEnabled: true,
          /**
           * ⚠️⚠️ `sites` ЗААВАЛ — эс бөгөөс сайтын шүүлт FAIL-OPEN болно.
           *
           * `site-extension` нь `findUnique`-ийн `where`-д шүүлт НЭМДЭГГҮЙ
           * (unique түлхүүр эвдэрнэ). Оронд нь ҮР ДҮНГ post-filter хийдэг
           * боловч `Array.isArray(row.sites)` шалгалт дээр тулгуурладаг —
           * `select`-д `sites` байхгүй бол `undefined` ирж шалгалт
           * БҮХЭЛДЭЭ алгасагдана.
           *
           * Үүнгүйгээр нөгөө сайтад л нийтэлсэн киноны id мэдэж байвал
           * түрээсийн үнэ гарч, QPay нэхэмжлэл үүсч, `grantFromPayment`
           * Rental үүсгэнэ. `priceFor`-ыг `initiateRental`, `rentWithWallet`,
           * `grantFromPayment` ГУРВУУЛАА дууддаг тул гурван зам нээлттэй.
           */
          sites: true,
        },
      }),
      this.settings(),
    ]);
    if (!title) throw new NotFoundException('Кино олдсонгүй');
    /** ⚠️ FAIL-CLOSED: тухайн сайтад нийтлээгүй бол 404 */
    assertTitleOnSite(title.sites, 'Кино олдсонгүй');

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
      select: {
        /* ⚠️ `site` — өргөтгөлийн post-filter ажиллахад ЗААВАЛ */
        site: true, walletBalance: true },
    });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    if (user.walletBalance < info.price) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_BALANCE',
        message: `Үлдэгдэл хүрэлцэхгүй (${user.walletBalance.toLocaleString()}₮ / ${info.price.toLocaleString()}₮)`,
      });
    }

    const expiresAt = new Date(Date.now() + info.hours * 3600_000);

    /**
     * ⚠️⚠️ ДАВХАР ТҮРЭЭСЛЭХЭЭС СЭРГИЙЛНЭ (бодит эрсдэл байсан).
     *
     * Дээрх `existing` шалгалт нь транзакцаас ГАДНА байсан тул хоёр
     * хүсэлт ЗЭРЭГ ирвэл (давхар товшилт, сүлжээний retry) хоёулаа
     * `existing = null` уншаад ХОЁР Rental үүсч, ХОЁР УДАА мөнгө
     * хасагдана. Хэрэглэгч 4,900₮-ийн оронд 9,800₮ төлнө.
     *
     * ⚠️ `Rental`-д `@@unique([userId, titleId])` тавьж БОЛОХГҮЙ —
     * хугацаа дууссаны дараа ДАХИН түрээслэх нь хэвийн (түүхэн олон
     * мөр байх ёстой). Тиймээс шалгалтыг транзакц дотор давтана.
     *
     * ⚠️ Мөн ДАРААЛЛЫГ СОЛИВ: эхлээд МӨНГӨ хасаад дараа нь эрх олгоно.
     * `applyTransaction` нь атомар `updateMany(walletBalance >= amount)`
     * тул үлдэгдэл хүрэхгүй бол ЭНД шидэгдэж, эрх огт олгогдохгүй.
     */
    const rental = await this.prisma.$transaction(async (tx) => {
      const dup = await tx.rental.findFirst({
        where: { userId, titleId, expiresAt: { gt: new Date() } },
        select: { id: true, expiresAt: true },
      });
      if (dup) return { ...dup, duplicate: true as const };

      /**
       * ⚠️⚠️ ХЭТЭВЧЭЭР ТӨЛСӨН ТҮРЭЭСЭД Ч `Payment` МӨР ЗААВАЛ.
       *
       * ⛔ БОДИТ АЛДАА (2026-09-10): BestFilm-ийн хянах самбар «Бодит
       *    орлого 0₮» гэж харуулж байсан ч хэрэглэгч 4,900₮ цэнэглээд
       *    кино түрээслэсэн байв.
       *
       * ⚠️ ШАЛТГААН: хэтэвчээр түрээслэхэд `WalletTransaction` +
       *    `Rental` л үүсэж, `Payment` мөр ОГТ үүсдэггүй байв. Гэтэл
       *    орлогын тооцоо нь `Payment(isWalletTopup=false)`-оос
       *    гардаг тул тэр мөнгө ХААНА Ч тоологдохгүй:
       *      · топап нь `isWalletTopup=true` → орлогоос хасагдана
       *        (давхар тооллоос сэргийлэх нь ЗӨВ)
       *      · зарцуулалт нь `Payment`-гүй → орлогод ОРОХГҮЙ
       *    ⇒ 128 түрээс / 622,300₮ хаана ч харагдахгүй байсан.
       *
       * ⚠️ БАГЦЫГ хэтэвчээр авахад (`payments.service.ts`) `Payment`
       *    үүсдэг — түрээс нь ЗӨВХӨН ЭНД орхигдсон байв. Хоёр зам
       *    ИЖИЛ байх ёстой ([[feedback_backend_frontend_sync]]).
       *
       * ⚠️ `isWalletTopup` нь өгөгдмөл `false` — энэ бол ЗАРЦУУЛАЛТ,
       *    цэнэглэлт БИШ. `qpayInvoiceId`/`bonumInvoiceId` хоосон тул
       *    админ UI-д `provider = WALLET` гэж зөв badge гарна.
       *
       * ⚠️ 0₮ түрээсэд (үнэгүй кино/100% хямдрал) ч мөр үүсгэнэ —
       *    гүйлгээний түүх бүрэн байх нь чухал.
       */
      const p = await tx.payment.create({
        data: {
          userId,
          rentalTitleId: titleId,
          amount: info.price,
          status: PaymentStatus.PAID,
          paidAt: new Date(),
        },
      });

      if (info.price > 0) {
        await this.wallet.applyTransaction({
          userId,
          type: WalletTxType.PURCHASE,
          amount: -info.price,
          description: `Түрээс: ${info.titleName} (${info.hours}ц)`,
          /* ⚠️ `paymentId` — хэтэвчийн түүхээс төлбөр рүү холбогдоно
             (багцын зам ижилхэн хийдэг) */
          paymentId: p.id,
          tx,
        });
      }

      const r = await tx.rental.create({
        /* ⚠️ `paymentId` — Rental↔Payment холбоос. `@unique` тул нэг
           төлбөр нэг л түрээс үүсгэнэ (давхардлын хамгаалалт). */
        data: { userId, titleId, amount: info.price, expiresAt, paymentId: p.id },
      });
      return { ...r, duplicate: false as const };
    });

    /* ⚠️ Зэрэг ирсэн хоёр дахь хүсэлт — имэйл ДАХИН илгээхгүй */
    if (rental.duplicate) {
      return { ok: true, already: true, expiresAt: rental.expiresAt };
    }

    // ── Түрээсийн баталгаажуулах имэйл ──
    const [renter, title] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: {
        /* ⚠️ `site` — өргөтгөлийн post-filter ажиллахад ЗААВАЛ */
        site: true, email: true, name: true } }),
      this.prisma.title.findUnique({
        where: { id: titleId },
        /* ⚠️ `sites` — өргөтгөлийн post-filter ажиллахад ЗААВАЛ
           (`select`-д байхгүй бол шүүлт ЧИМЭЭГҮЙ алгасагдана) */
        select: { slug: true, sites: true },
      }),
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

    /**
     * ⚠️⚠️ META PURCHASE — ХЭТЭВЧИЙН ЗАМ CAPI-Г ТОЙРДОГ БАЙВ.
     *
     * ⛔ Хэтэвчээр түрээслэх нь `completePayment`-ыг дууддаггүй
     *    (өөрийн транзакц дотор шууд PAID бичдэг) тул тэнд байдаг
     *    CAPI дуудлага ОГТ ажилладаггүй байв.
     *
     * ⚠️ Багцын хэтэвчийн зам (`payments.service.ts`) энэ засварыг
     *    аль хэдийн хийсэн, QPay-ийн түрээсийн зам ч дууддаг —
     *    ЗӨВХӨН хэтэвчийн ТҮРЭЭС орхигдсон байв. Үр дүнд Meta-гийн
     *    зар оновчлол дутуу датагаар суралцана.
     *
     * ⚠️ `eventId` нь `payment.id` — QPay замтай ИЖИЛ хэлбэр тул
     *    browser болон server үйл явдал давхардахгүй (dedup).
     * ⚠️ `await` ХИЙХГҮЙ — Meta унасан ч түрээс амжилттай хэвээр.
     */
    if (rental.paymentId && info.price > 0) {
      void this.capi.purchase({
        eventId: rental.paymentId,
        email: renter?.email,
        value: info.price,
        contentName: info.titleName,
        kind: 'rental',
      });
    }

    return { ok: true, rentalId: rental.id, expiresAt, hours: info.hours };
  }

  /**
   * QPay төлбөр амжилттай болсны ДАРАА түрээс олгоно.
   *
   * ⚠️⚠️ ИДЕМПОТЕНТ БАЙХ ЁСТОЙ: QPay callback, polling (`check`) болон
   * reconcile cron ГУРВУУЛАА ижил төлбөрийг баталгаажуулж болно.
   * `Rental.paymentId` дээр `@unique` тавьсан тул хоёр дахь оролдлого
   * DB түвшинд унана — гэхдээ алдаа шидэхийн оронд ЧИМЭЭГҮЙ өнгөрнө
   * (төлбөр аль хэдийн боловсруулагдсан, хэрэглэгчид эрх нь бий).
   *
   * ⚠️ Мөнгө ЭНД хасахгүй — QPay-д аль хэдийн төлөгдсөн.
   */
  async grantFromPayment(paymentId: string, userId: string, titleId: string) {
    const existingForPayment = await this.prisma.rental.findUnique({
      where: { paymentId },
      select: {
        /* ⚠️ `site` — өргөтгөлийн post-filter ажиллахад ЗААВАЛ */
        site: true, id: true, expiresAt: true },
    });
    if (existingForPayment) return existingForPayment;

    const info = await this.priceFor(titleId);
    const expiresAt = new Date(Date.now() + info.hours * 3600_000);

    /**
     * ⚠️ Хэрэглэгч QPay төлж байх зуур ХЭТЭВЧЭЭР ч түрээслэсэн байж
     * болно (эсвэл багц авсан). Тэр тохиолдолд ДАВХАР эрх үүсгэхийн
     * оронд байгаа түрээсийн хугацааг СУНГАНА — төлсөн мөнгө үрэгдэхгүй.
     */
    const active = await this.prisma.rental.findFirst({
      where: { userId, titleId, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'desc' },
      select: { id: true, expiresAt: true, paymentId: true },
    });

    /**
     * ⚠️⚠️ СУНГАХ ҮЕД `paymentId`-Г ЗААВАЛ БИЧНЭ.
     *
     * БОДИТ АЛДАА: `update` салаа нь `paymentId`-г бичдэггүй байв.
     * Идемпотентын хамгаалалт бүхэлдээ `Rental.paymentId @unique`
     * дээр тулгуурладаг тул тэр алдагдвал ДЭЭРХ `findUnique` дахин
     * `null` буцаана. QPay нь webhook + polling + reconcile ГУРВАН
     * замаар баталгаажуулдаг → нэг төлбөрөөр хугацаа 2-3 ДАХИН
     * сунгагдана.
     *
     * ⚠️ Идэвхтэй түрээс нь ӨӨР төлбөртэй холбогдсон байвал түүнийг
     * дарж бичиж БОЛОХГҮЙ (тэр төлбөрийн идемпотент хамгаалалт
     * алдагдана). Тэр тохиолдолд ШИНЭ мөр үүсгэнэ — `@unique` нь
     * давхардлаас хамгаална, эрх нь хоёулангаас нь нийлж ажиллана.
     */
    const canAttach = active && !active.paymentId;

    const rental =
      active && canAttach
        ? await this.prisma.rental.update({
            where: { id: active.id },
            data: {
              expiresAt: new Date(active.expiresAt.getTime() + info.hours * 3600_000),
              amount: { increment: info.price },
              paymentId,
            },
            select: { id: true, expiresAt: true },
          })
        : await this.prisma.rental.create({
            data: {
              userId,
              titleId,
              amount: info.price,
              /* ⚠️ Идэвхтэй түрээс байвал түүний ТӨГСГӨЛӨӨС эхэлнэ —
                 хэрэглэгчийн төлсөн цаг үрэгдэхгүй */
              expiresAt: active
                ? new Date(active.expiresAt.getTime() + info.hours * 3600_000)
                : expiresAt,
              paymentId,
            },
            select: { id: true, expiresAt: true },
          });

    const [renter, title] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: {
        /* ⚠️ `site` — өргөтгөлийн post-filter ажиллахад ЗААВАЛ */
        site: true, email: true, name: true } }),
      this.prisma.title.findUnique({ where: { id: titleId }, select: { slug: true } }),
    ]);
    if (renter && title) {
      this.email.sendRentalConfirmation({
        to: renter.email,
        name: renter.name,
        titleName: info.titleName,
        titleSlug: title.slug,
        amount: info.price,
        expiresAt: rental.expiresAt,
        hours: info.hours,
        userId,
      });
    }
    return rental;
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

  /**
   * Хэтэвчээр түрээслэх.
   * ⚠️ ХЭТЭВЧНЭЭС МӨНГӨ ХАСНА тул rate limit ЗААВАЛ — скрипт давхар
   * дуудвал үлдэгдэл хэдхэн секундэд шавхагдана.
   */
  @Post(':titleId/wallet')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  rentWallet(
    @Param('titleId') titleId: string,
    @CurrentUser() user: JwtPayload,
    /* ⚠️ Хоосон DTO — илүү талбарыг `forbidNonWhitelisted` хаана */
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
  /* ⚠️ AnalyticsModule нь `MetaCapiService`-ыг export хийдэг —
     Global БИШ тул ЗААВАЛ import (эс бөгөөс DI унана). */
  imports: [WalletModule, TitlesModule, AnalyticsModule],
  controllers: [RentalsController, RentalsAdminController],
  providers: [RentalsService],
  exports: [RentalsService],
})
export class RentalsModule {}
