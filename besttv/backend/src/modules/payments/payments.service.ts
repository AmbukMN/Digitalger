import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, PromotionType, WalletTxType } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CouponsService } from '../coupons/coupons.module';
import { WalletService } from '../wallet/wallet.module';
import { RentalsService } from '../rentals/rentals.module';
import { PromotionsService } from '../promotions/promotions.service';
import { N8nService } from '../n8n/n8n.service';
import { MetaCapiService } from '../analytics/meta-capi.service';

interface QPayTokenResponse {
  access_token: string;
  expires_in: number;
}

interface QPayInvoiceResponse {
  invoice_id: string;
  qr_text: string;
  qr_image: string;
  urls: { name: string; link: string; logo: string }[];
}

/**
 * BestTV QPay — DigitalGer-ийн батлагдсан QPay клиентээс авсан
 * (token expiry timestamp fix, 401 retry, idempotent confirm бүгд орсон).
 * Ялгаа: Order биш Plan/Subscription урсгал.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private tokenCache: { token: string; expiresAt: number } | null = null;

  /** ⚠️ Reconcile cron давхцахаас сэргийлэх түгжээ (доорх тайлбар) */
  private reconcileRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly subs: SubscriptionsService,
    private readonly coupons: CouponsService,
    private readonly wallet: WalletService,
    private readonly email: EmailService,
    /* ⚠️ Ширхэгээр түрээслэх QPay урсгалд (үнэ/хугацаа тэнд тодорхойлогдоно) */
    private readonly rentals: RentalsService,
    /* ⚠️ Урамшуулал — үнэ бодох + бонус олгох (QPay болон хэтэвч ХОЁУЛАНД) */
    private readonly promotions: PromotionsService,
    /* ⚠️ Telegram мэдэгдэл — @Global тул import хэрэггүй */
    private readonly n8n: N8nService,
    /* ⚠️ Meta Conversions API — сервер талаас Purchase (данс, хэтэвч ч
       хамрагдана; browser pixel тэднийг барьж чадахгүй) */
    private readonly capi: MetaCapiService,
  ) {}

  isQPayConfigured(): boolean {
    const qpay = this.config.get('qpay');
    return Boolean(qpay.username && qpay.password && qpay.invoiceCode);
  }

  /** Багц сонгоод QPay invoice үүсгэнэ (QR + банкны deeplink), купон код заавал биш */
  async initiate(planId: string, userId: string, couponCode?: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Багц олдсонгүй');

    /**
     * ─── УРАМШУУЛАЛ → КУПОН (ЭНЭ ДАРААЛЛААР) ────────────────────
     *
     * ⚠️⚠️ ДАРААЛАЛ ЧУХАЛ. Урамшууллыг эхэлж бодоод, купоныг ҮЛДСЭН
     * дүн дээр тооцно: 30% + 20% = 44% (50% БИШ). Нийлбэрээр бодвол
     * хэт их алдагдал гарна.
     *
     * ⚠️ Урамшуулал нь АВТОМАТ (код бичихгүй) тул хэрэглэгч мэдэхгүй ч
     * үйлчилнэ. `promotionId`-г төлбөрт тэмдэглэнэ — 5 минут хүлээж
     * байх зуур урамшуулал дуусвал ч бонусаа авна.
     */
    const promoMap = await this.promotions.forPlans(
      [{ id: plan.id, price: plan.price, durationDays: plan.durationDays }],
      userId,
    );
    const promo = promoMap.get(plan.id) ?? null;

    let amount = promo?.finalPrice ?? plan.price;
    const promotionId = promo?.id ?? null;

    let normalizedCoupon: string | undefined;
    if (couponCode) {
      /* ⚠️ `blockCoupons` — зарим урамшуулалд купон хориотой (хэт их
         хямдрал өгөхөөс сэргийлнэ) */
      if (promo?.blockCoupons) {
        throw new BadRequestException(
          `«${promo.name}» урамшууллын үед купон код ашиглах боломжгүй`,
        );
      }
      /* ⚠️ `plan.price` БИШ `amount` — урамшууллын ДАРААХ дүн дээр */
      /* ⚠️ `userId` ЗААВАЛ — хувийн купоныг өөр хүн ашиглахаас хамгаална */
      const result = await this.coupons.validate({ code: couponCode, price: amount }, userId);
      amount = result.finalPrice;
      normalizedCoupon = couponCode.toUpperCase().trim();
    }

    // ⚠️ 100% хямдрал (эсвэл үнэ 0) — QPay 0₮ нэхэмжлэл авдаггүй тул QPay
    // дамжуулахгүй, шууд төлөгдсөнд тооцож эрхийг нээнэ.
    if (amount <= 0) {
      /**
       * ⚠️⚠️ ДАВХАР ДАРАЛТААС ХАМГААЛАХ — ЭНД ЗААВАЛ.
       *
       * БОДИТ АЛДАА: доорх «PENDING нэхэмжлэлийг дахин ашиглах»
       * шалгалт нь ЗӨВХӨН төлбөртэй урсгалд ажилладаг — 0₮ салаа
       * түүнээс ДЭЭР байрлаж, шууд `create` + `completePayment`
       * хийдэг байв.
       *
       * Үр дүн: 100% хямдралтай купонтой хэрэглэгч «Худалдан авах»
       * товчийг ХОЁР УДАА дарвал хоёр Payment үүсч, `subs.grant`
       * хоёуланд нь ажиллана → багц ХОЁР ДАХИН урт хугацаагаар
       * нээгдэж, купон 2 удаа зарцуулагдана.
       *
       * Одоо: сүүлийн 30 минутад ижил төлбөр хийгдсэн бол ШИНЭ
       * эрх нээхгүй, хуучныг нь буцаана.
       */
      const recentFree = await this.prisma.payment.findFirst({
        where: {
          userId,
          planId,
          amount: 0,
          status: PaymentStatus.PAID,
          createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (recentFree) {
        this.logger.warn(
          `0₮ төлбөр давхардлаа — эрх дахин нээгээгүй (user=${userId} plan=${planId})`,
        );
        return { devMode: true, paymentId: recentFree.id, status: 'PAID', amount: 0 };
      }

      const freePayment = await this.prisma.payment.create({
        data: {
          userId,
          planId,
          amount: 0,
          status: PaymentStatus.PENDING,
          couponCode: normalizedCoupon,
          promotionId,
          originalAmount: plan.price,
        },
      });
      await this.completePayment(freePayment.id);
      return { devMode: true, paymentId: freePayment.id, status: 'PAID', amount: 0 };
    }

    // Idempotent: сүүлийн 30 мин доторх PENDING invoice байвал дахин ашиглана.
    // ⚠️ couponCode-ыг ЗААВАЛ тааруулна — эс бөгөөс хэрэглэгч купон оруулсны
    // дараа хуучин бүтэн үнийн QR-ыг буцааж, хямдрал алга болно.
    const existing = await this.prisma.payment.findFirst({
      where: {
        userId,
        planId,
        status: PaymentStatus.PENDING,
        qpayInvoiceId: { not: null },
        couponCode: normalizedCoupon ?? null,
        amount,
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return {
        devMode: false,
        paymentId: existing.id,
        invoiceId: existing.qpayInvoiceId,
        qrText: existing.qpayQrText ?? '',
        qrImage: existing.qpayQrImage ?? '',
        urls: (existing.qpayUrls as object[]) ?? [],
        amount: existing.amount,
      };
    }

    // DEV mode — QPay тохируулаагүй бол шууд төлөгдсөнд тооцно
    if (!this.isQPayConfigured()) {
      const devPayment = await this.prisma.payment.create({
        data: {
          userId,
          planId,
          amount,
          status: PaymentStatus.PENDING,
          couponCode: normalizedCoupon,
          promotionId,
          /* ⚠️ Урамшуулал ЭСВЭЛ купон байвал хуучин үнэ хадгална —
             «29,000₮ → 19,900₮» гэж зураастай харуулна */
          originalAmount: normalizedCoupon || promotionId ? plan.price : undefined,
        },
      });
      this.logger.warn('QPay тохируулаагүй — dev mode: төлбөр автомат баталгаажлаа');
      await this.completePayment(devPayment.id);
      return { devMode: true, paymentId: devPayment.id, status: 'PAID' };
    }

    const invoice = await this.createQPayInvoice(userId, amount);

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        planId,
        amount,
        status: PaymentStatus.PENDING,
        couponCode: normalizedCoupon,
        promotionId,
        /* ⚠️ Урамшуулал ЭСВЭЛ купон байвал хуучин үнэ хадгална —
           «29,000₮ → 19,900₮» гэж зураастай харуулна */
        originalAmount: normalizedCoupon || promotionId ? plan.price : undefined,
        qpayInvoiceId: invoice.invoice_id,
        qpayQrText: invoice.qr_text,
        qpayQrImage: invoice.qr_image,
        qpayUrls: invoice.urls as object,
      },
    });

    return {
      devMode: false,
      paymentId: payment.id,
      invoiceId: invoice.invoice_id,
      qrText: invoice.qr_text,
      qrImage: invoice.qr_image,
      urls: invoice.urls,
      amount,
    };
  }

  /**
   * QPay нэхэмжлэл үүсгэх — багц БА түрээс ХОЁУЛАА энийг дуудна.
   *
   * ⚠️ Тусад нь салгасан шалтгаан: түрээсийн зам нэмэхэд token retry,
   * анонимчлол, алдаа боловсруулалт ХУУЛБАРЛАГДАХ байсан. Нэг газарт
   * байвал QPay-ийн дүрэм өөрчлөгдөхөд нэг л газар засна.
   */
  private async createQPayInvoice(userId: string, amount: number): Promise<QPayInvoiceResponse> {
    const qpay = this.config.get('qpay');
    /**
     * ⚠️⚠️ QPay-Д ИЛГЭЭХ ТЕКСТ — БИЗНЕСИЙН НЭР ОРУУЛАХГҮЙ.
     *
     * ЯАГААД: QPay merchant данс нь DigitalGer-ийн нэр дээр гэрээтэй.
     * Тэр данс руу "BestTV" гэсэн ТАНИХГҮЙ нэр орж ирвэл QPay тал нь
     * гэрээнд заагаагүй өөр бизнест данс ашиглаж байна гэж үзэж, данс
     * түдгэлзүүлэх эрсдэлтэй. Харин "DigitalGer" гэж бичих нь ч
     * шаардлагагүй — ямар ч нэр байхгүй, зөвхөн САНАМСАРГҮЙ захиалгын
     * дугаар байвал хамгийн аюулгүй (мөн хэрэглэгчийн нууцлалд ч дээр).
     *
     * ⚠️ Төлбөрийн УРСГАЛД НӨЛӨӨЛӨХГҮЙ: төлбөрийг `qpayInvoiceId`-аар
     * таньдаг (`handleCallback` дотор), эдгээр талбар нь зөвхөн QPay-д
     * харагдах ТЕКСТ. BestTV-ийн орлого BestTV рүүгээ л бүртгэгдэнэ.
     *
     * ⚠️ `randomUUID` — цаг хугацаанаас хамаарахгүй тул хэн нэгэн
     * дугаарлалтаас захиалгын тоо/давтамжийг таамаглах боломжгүй.
     */
    const identifier = randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase();
    const invoiceBody = {
      invoice_code: qpay.invoiceCode,
      sender_invoice_no: identifier,
      invoice_receiver_code: userId.slice(0, 20),
      invoice_description: `Order ${identifier}`,
      amount,
      callback_url: qpay.callbackUrl,
    };

    // Token cache хүчингүй (401/403) бол шинээр авч НЭГ удаа дахин оролдоно
    const callInvoice = async (token: string) =>
      fetch('https://merchant.qpay.mn/v2/invoice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceBody),
        /* ⚠️ QPay удаашрахад HTTP хүсэлт ХЯЗГААРГҮЙ өлгөгдөж,
           хэрэглэгч «боловсруулж байна» дээр гацна */
        signal: AbortSignal.timeout(15_000),
      });

    let response = await callInvoice(await this.getQPayToken());
    if (response.status === 401 || response.status === 403) {
      this.tokenCache = null;
      response = await callInvoice(await this.getQPayToken());
    }

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`QPay invoice амжилтгүй: ${text}`);
      // ⚠️ Invoice амжилтгүй бол payment бичлэг ҮҮСГЭХГҮЙ (NULL хог үүсгэхгүй)
      throw new BadRequestException('QPay нэхэмжлэл үүсгэж чадсангүй');
    }

    /* ⚠️ Payment бичлэгийг ДУУДАГЧ тал үүсгэнэ — багц/түрээс өөр талбартай */
    return (await response.json()) as QPayInvoiceResponse;
  }

  /**
   * ШИРХЭГЭЭР ТҮРЭЭСЛЭХ — QPay нэхэмжлэл үүсгэнэ.
   *
   * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: өмнө нь түрээслэх ЦОРЫН ГАНЦ зам нь
   * хэтэвч байсан. Хэтэвчгүй хэрэглэгч эхлээд цэнэглээд дараа нь
   * түрээслэх 2 алхамт урсгалд ордог — олонх нь тэндээ орхидог.
   * Одоо шууд QPay-ээр төлж болно.
   *
   * ⚠️ `completePayment` нь `rentalTitleId` байвал Rental үүсгэнэ.
   */
  async initiateRental(titleId: string, userId: string) {
    const info = await this.rentals.priceFor(titleId);
    if (!info.available) {
      throw new BadRequestException('Энэ киног ширхэгээр түрээслэх боломжгүй');
    }

    /* ⚠️ Аль хэдийн эрхтэй бол дахин төлүүлэхгүй */
    const active = await this.subs.activeRental(userId, titleId);
    if (active) {
      return { already: true as const, expiresAt: active.expiresAt };
    }

    /**
     * ⚠️ IDEMPOTENT — сүүлийн 30 минутын PENDING нэхэмжлэлийг дахин
     * ашиглана. Эс бөгөөс хэрэглэгч буцаад дахин дарах бүрд QPay-д
     * шинэ нэхэмжлэл үүсч, хог хуримтлагдана (мөн QPay-ийн хязгаар).
     */
    const existing = await this.prisma.payment.findFirst({
      where: {
        userId,
        rentalTitleId: titleId,
        status: PaymentStatus.PENDING,
        qpayInvoiceId: { not: null },
        amount: info.price,
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return {
        devMode: false,
        paymentId: existing.id,
        invoiceId: existing.qpayInvoiceId,
        qrText: existing.qpayQrText ?? '',
        qrImage: existing.qpayQrImage ?? '',
        urls: (existing.qpayUrls as object[]) ?? [],
        amount: existing.amount,
      };
    }

    const base = {
      userId,
      rentalTitleId: titleId,
      amount: info.price,
      status: PaymentStatus.PENDING,
    };

    /* ⚠️ QPay тохируулаагүй (dev) — шууд төлөгдсөнд тооцно */
    if (!this.isQPayConfigured()) {
      const dev = await this.prisma.payment.create({ data: base });
      this.logger.warn('QPay тохируулаагүй — dev mode: түрээс автомат баталгаажлаа');
      await this.completePayment(dev.id);
      return { devMode: true, paymentId: dev.id, status: 'PAID' };
    }

    const invoice = await this.createQPayInvoice(userId, info.price);
    const payment = await this.prisma.payment.create({
      data: {
        ...base,
        qpayInvoiceId: invoice.invoice_id,
        qpayQrText: invoice.qr_text,
        qpayQrImage: invoice.qr_image,
        qpayUrls: invoice.urls as object,
      },
    });

    return {
      devMode: false,
      paymentId: payment.id,
      invoiceId: invoice.invoice_id,
      qrText: invoice.qr_text,
      qrImage: invoice.qr_image,
      urls: invoice.urls,
      amount: info.price,
    };
  }

  /**
   * Захиалгын түүх.
   *
   * ⚠️ Зөвхөн `Payment` уншвал ХАНГАЛТГҮЙ — админ гараар олгосон багц
   * (`grantSubscription`) нь Payment бичлэг үүсгэдэггүй тул хэрэглэгч
   * "эрх нээгдсэн ч түүхэнд алга" гэж эргэлздэг байсан. Тиймээс
   * төлбөргүй (paymentId=null) Subscription-уудыг ч нэмж харуулна.
   */
  async myPayments(userId: string) {
    const [payments, granted] = await Promise.all([
      this.prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          amount: true,
          originalAmount: true,
          couponCode: true,
          status: true,
          paidAt: true,
          createdAt: true,
          isWalletTopup: true,
          plan: { select: { name: true, durationDays: true } },
        },
      }),
      // Админ гараар олгосон эрх (төлбөргүй)
      this.prisma.subscription.findMany({
        where: { userId, paymentId: null },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          plan: { select: { name: true, durationDays: true } },
        },
      }),
    ]);

    const grantedRows = granted.map((g) => ({
      id: `grant-${g.id}`,
      amount: 0,
      originalAmount: null,
      couponCode: null,
      status: PaymentStatus.PAID,
      paidAt: g.createdAt,
      createdAt: g.createdAt,
      isWalletTopup: false,
      plan: g.plan,
      /** Админаас гараар олгосон гэдгийг UI-д ялгаж харуулна */
      grantedByAdmin: true as const,
      expiresAt: g.expiresAt,
    }));

    return [...payments, ...grantedRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /** Frontend polling — төлөгдсөн бол эрх нээгээд paid:true */
  async check(paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException('Төлбөр олдсонгүй');
    if (payment.status === PaymentStatus.PAID) return { paid: true };
    if (!payment.qpayInvoiceId || !this.isQPayConfigured()) return { paid: false };

    const isPaid = await this.verifyPaymentWithQpay(payment.qpayInvoiceId);
    if (isPaid) {
      await this.completePayment(payment.id);
      return { paid: true };
    }
    return { paid: false };
  }

  /**
   * QPay webhook — body-д ХЭЗЭЭ Ч итгэхгүй, /v2/payment/check-ээр
   * QPay-аас өөрөөс нь баталгаажуулж байж Л эрх нээнэ.
   */
  async handleWebhook(body: Record<string, unknown>, rawBody: string, signature?: string) {
    const webhookSecret = this.config.get<string>('qpay.webhookSecret');

    /**
     * ⚠️⚠️ PRODUCTION-Д SECRET ЗААВАЛ — байхгүй бол endpoint-ыг ХААНА.
     *
     * Өмнө нь `if (webhookSecret)` байсан тул secret арилвал (env
     * буруу хуулагдсан, deploy алдаа) гарын үсгийн шалгалт БҮХЭЛДЭЭ
     * ЧИМЭЭГҮЙ унтардаг байв — хэн ч callback руу дурын `invoice_id`
     * илгээж болно.
     *
     * ⚠️ Мөнгө шууд хулгайлагдахгүй (`verifyPaymentWithQpay` давах
     * шаардлагатай) ч хязгааргүй нээлттэй хүсэлт нь QPay merchant API
     * руу amplification үүсгэж, rate-limit/ban авахад хүргэнэ.
     *
     * ⚠️ FAIL-CLOSED: тохиргоо дутуу бол ХҮЛЭЭН АВАХГҮЙ (нээлттэй
     * үлдээхээс төлбөр түр саатах нь дээр — polling/reconcile нь
     * эрхийг ямар ч тохиолдолд олгоно).
     */
    const isProd = this.config.get<string>('nodeEnv') === 'production';
    if (!webhookSecret && isProd) {
      this.logger.error('QPAY_WEBHOOK_SECRET тохируулаагүй — webhook хаагдлаа');
      throw new UnauthorizedException('Webhook тохиргоо дутуу');
    }
    if (webhookSecret) {
      if (!signature || !this.verifyWebhookSignature(rawBody, signature)) {
        throw new UnauthorizedException('Webhook гарын үсэг буруу');
      }
    }

    const invoiceId =
      (body.payment_id as string) ??
      (body.qpay_payment_id as string) ??
      (body.invoice_id as string);
    if (!invoiceId) throw new BadRequestException('Webhook payload буруу');

    const payment = await this.prisma.payment.findFirst({
      where: { qpayInvoiceId: invoiceId },
    });
    if (!payment) {
      this.logger.warn(`Webhook: payment олдсонгүй (${invoiceId})`);
      return { received: true, matched: false };
    }
    if (payment.status !== PaymentStatus.PENDING) {
      return { received: true, matched: true };
    }

    const verified = this.isQPayConfigured()
      ? await this.verifyPaymentWithQpay(invoiceId)
      : false;
    if (verified) {
      await this.completePayment(payment.id);
    } else {
      this.logger.warn(`Webhook QPay-аар баталгаажсангүй: payment ${payment.id}`);
    }
    return { received: true, matched: true };
  }

  /**
   * PENDING төлбөрүүдийг QPay-аас шалгаж автомат баталгаажуулна (cron fallback —
   * webhook найдваргүй үед хэрэглэгч төлсөн ч эрх нээгдээгүй үлдэхээс сэргийлнэ).
   */
  async reconcilePending(maxAgeHours = 2): Promise<number> {
    if (!this.isQPayConfigured()) return 0;

    /**
     * ⚠️⚠️ ДАВХАР АЖИЛЛАХААС СЭРГИЙЛНЭ.
     *
     * БОДИТ ЭРСДЭЛ: cron нь 5 минут тутам ажилладаг. QPay унавал
     * PENDING төлбөр хуримтлагдаж, 500 мөр болвол энэ давталт
     * 500 × 15 секунд ≈ 2 ЦАГ гүйнэ. Тэр хугацаанд дараагийн 24
     * cron давхар эхэлж, ижил төлбөрүүд дээр зэрэг ажиллана —
     * QPay рүү хүсэлтийн үер үүсч, эрх нь илүү ч удаан нээгдэнэ.
     */
    if (this.reconcileRunning) {
      this.logger.warn('Reconcile аль хэдийн ажиллаж байна — энэ удаагийнхыг алгаслаа');
      return 0;
    }
    this.reconcileRunning = true;

    try {
      const since = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      const pending = await this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.PENDING,
          qpayInvoiceId: { not: null },
          createdAt: { gte: since },
        },
        /* ⚠️ ХЯЗГААР ЗААВАЛ — өмнө нь ХЯЗГААРГҮЙ байв. Хамгийн
           хуучнаас нь эхэлнэ (хэрэглэгч удаан хүлээсэн нь эхэнд),
           үлдсэнийг дараагийн cron барина. */
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      if (pending.length === 0) return 0;

      let confirmed = 0;
      for (const payment of pending) {
        try {
          if (await this.verifyPaymentWithQpay(payment.qpayInvoiceId!)) {
            await this.completePayment(payment.id);
            confirmed++;
          }
        } catch (err) {
          this.logger.error(`Reconcile алдаа: payment ${payment.id}`, err);
        }
      }
      if (confirmed > 0) this.logger.log(`Reconcile: ${confirmed} төлбөр баталгаажив`);
      if (pending.length === 100) {
        this.logger.warn('Reconcile: 100 хязгаарт хүрлээ — үлдсэнийг дараагийн ажиллагаа барина');
      }
      return confirmed;
    } finally {
      this.reconcileRunning = false;
    }
  }

  /**
   * ⚠️ IDEMPOTENT: updateMany where status=PENDING — polling + webhook + reconcile
   * зэрэг ажилласан ч эрх ЗӨВХӨН НЭГ удаа нэмэгдэнэ.
   */
  /**
   * Төлбөрийг ТӨЛӨГДСӨН болгож эрхийг нээнэ.
   * ⚠️ `public` — админ гараар баталгаажуулахад ч дуудагдана.
   * ⚠️ Идемпотент: `updateMany(status: PENDING)` нь давхар дуудалтыг барина.
   */
  /**
   * Урамшууллын бонусыг олгож, ашиглалтыг бүртгэнэ.
   *
   * ⚠️ АЛДАА ГАРВАЛ ТӨЛБӨР ЗОГСОХГҮЙ — хэрэглэгч мөнгөө төлчихсөн
   * тул багц нь ЗААВАЛ нээгдэх ёстой. Бонус олдохгүй бол лог үлдэж
   * админ гараар засна.
   *
   * @returns нэмэлт хоног (үндсэн хугацаан дээр нэмэгдэнэ)
   */
  private async applyPromotionBonus(payment: {
    id: string;
    userId: string;
    promotionId: string | null;
    amount: number;
    originalAmount: number | null;
    plan: { id: string; durationDays: number } | null;
  }): Promise<{ extraDays: number }> {
    if (!payment.promotionId || !payment.plan) return { extraDays: 0 };

    /**
     * ⚠️⚠️ IDEMPOTENCY — нэг төлбөрт НЭГ Л УДАА бонус.
     *
     * `adminMarkPaid` нь FAILED/EXPIRED төлбөрийг дахин PAID болгож
     * `completePayment` дуудна. Тэр үед бонус хоног + БЭЛЭГ БАГЦ
     * ДАХИН олгогдоно (`GIFT_PLAN` нь доор `redeem`-ээс ӨМНӨ
     * ажилладаг тул DB-ийн unique хамгаалалтад ч хүрэхгүй).
     *
     * ⚠️ DB талд `PromotionRedemption.paymentId @unique` нэмсэн нь
     * хоёр дахь давхарга — race үед энэ шалгалт хоцорч болно.
     */
    const already = await this.prisma.promotionRedemption
      .findUnique({ where: { paymentId: payment.id }, select: { daysGiven: true } })
      .catch(() => null);
    if (already) {
      this.logger.warn(
        `Урамшуулал аль хэдийн олгогдсон — алгаслаа (payment=${payment.id})`,
      );
      return { extraDays: 0 };
    }

    try {
      const promo = await this.prisma.promotion.findUnique({
        where: { id: payment.promotionId },
        select: {
          id: true,
          name: true,
          type: true,
          bonusDays: true,
          giftPlanId: true,
          giftDays: true,
        },
      });
      if (!promo) return { extraDays: 0 };

      let extraDays = 0;
      let daysGiven = 0;
      const valueGiven = Math.max(0, (payment.originalAmount ?? payment.amount) - payment.amount);

      if (promo.type === 'EXTRA_DAYS' && promo.bonusDays) {
        extraDays = promo.bonusDays;
        daysGiven = promo.bonusDays;
      }

      /**
       * ⚠️ БЭЛЭГ БАГЦ — тусад нь эрх нээнэ (үндсэн багцтай зэрэгцэж
       * ажиллана). `giftDays` хоосон бол үндсэн багцтай ИЖИЛ хугацаа.
       */
      if (promo.type === 'GIFT_PLAN' && promo.giftPlanId) {
        const giftDays = promo.giftDays ?? payment.plan.durationDays;
        await this.subs.grant(payment.userId, promo.giftPlanId, giftDays, null);
        daysGiven = giftDays;
        this.logger.log(
          `Бэлэг багц олгов: user=${payment.userId} plan=${promo.giftPlanId} (${giftDays} хоног)`,
        );
      }

      /* ⚠️ Транзакц — тоолуур ба бүртгэл ЗААВАЛ хамт */
      await this.prisma.$transaction(async (tx) => {
        await this.promotions.redeem(
          tx,
          promo.id,
          payment.userId,
          payment.id,
          valueGiven,
          daysGiven,
        );
      });

      this.logger.log(
        `Урамшуулал ашиглав: "${promo.name}" user=${payment.userId} (+${extraDays} хоног, ${valueGiven}₮)`,
      );
      return { extraDays };
    } catch (e) {
      /* ⚠️ `error` — бонус алдагдсан нь БОДИТ асуудал (хэрэглэгч
         амласан зүйлээ аваагүй), гэхдээ төлбөр зогсоохгүй */
      this.logger.error(
        `Урамшууллын бонус олгож чадсангүй (payment=${payment.id}): ${String(e)}`,
      );
      return { extraDays: 0 };
    }
  }

  /**
   * ХЭТЭВЧИЙН БОНУС олгоно (`WALLET_BONUS` урамшуулал).
   *
   * ⚠️⚠️ БОДИТ АЛДАА байсан: энэ функц ОГТ БАЙХГҮЙ байв. Frontend нь
   * «+10,000₮ бонус» гэж амлаад, хэрэглэгч цэнэглэхэд яг цэнэглэсэн
   * дүн л ордог байсан — амлалт зөрчигдөж, мөрдөх бичлэг ч үлдэхгүй.
   *
   * ⚠️ АЛДАА ГАРВАЛ ЦЭНЭГЛЭЛТ ЗОГСОХГҮЙ — үндсэн мөнгө нь аль хэдийн
   * орсон. Бонус олдохгүй бол `error` лог үлдэж админ гараар засна.
   *
   * @returns олгосон бонус дүн (имэйлд харуулахад)
   */
  private async applyWalletBonus(payment: {
    id: string;
    userId: string;
    promotionId: string | null;
    amount: number;
  }): Promise<number> {
    if (!payment.promotionId) return 0;

    /**
     * ⚠️ IDEMPOTENCY — `adminMarkPaid` нь FAILED төлбөрийг дахин PAID
     * болгож `completePayment` дуудна. Тэр үед бонус ХОЁР ДАХЬ удаа
     * орох ёсгүй. `PromotionRedemption.paymentId` нь `@unique` тул
     * DB талд ч хамгаалалттай — энэ нь эхний давхарга.
     */
    const already = await this.prisma.promotionRedemption
      .findUnique({ where: { paymentId: payment.id }, select: { id: true } })
      .catch(() => null);
    if (already) {
      this.logger.warn(`Хэтэвчийн бонус аль хэдийн олгогдсон — алгаслаа (payment=${payment.id})`);
      return 0;
    }

    try {
      const promo = await this.prisma.promotion.findUnique({
        where: { id: payment.promotionId },
        select: { id: true, name: true, type: true, bonusAmount: true },
      });
      /* ⚠️ Төрлийг ЗААВАЛ шалгана — багцын урамшууллын id санамсаргүй
         орвол хэтэвчид мөнгө цутгах эрсдэлтэй */
      if (!promo || promo.type !== PromotionType.WALLET_BONUS || !promo.bonusAmount) return 0;

      /* ⚠️ Транзакц — мөнгө орох ба тоолуур нэмэгдэх нь ЗААВАЛ хамт.
         Салангид бол бонус орчихоод `usedCount` нэмэгдэхгүй үлдэж,
         хэрэглэгч хязгаараас олон удаа бонус авна. */
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.applyTransaction({
          userId: payment.userId,
          type: WalletTxType.BONUS,
          amount: promo.bonusAmount!,
          description: `«${promo.name}» урамшууллын бонус`,
          paymentId: payment.id,
          /* ⚠️ ЗААВАЛ дамжуулна — эс бөгөөс энэ гүйлгээ транзакцаас
             ГАДНА бичигдэж, `redeem` унавал бонус буцаагдахгүй */
          tx,
        });
        await this.promotions.redeem(tx, promo.id, payment.userId, payment.id, promo.bonusAmount!, 0);
      });

      this.logger.log(
        `Хэтэвчийн бонус олгов: "${promo.name}" user=${payment.userId} +${promo.bonusAmount}₮`,
      );
      return promo.bonusAmount;
    } catch (e) {
      this.logger.error(
        `Хэтэвчийн бонус олгож чадсангүй (payment=${payment.id}): ${String(e)}`,
      );
      return 0;
    }
  }

  async completePayment(paymentId: string) {
    const claimed = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.PAID, paidAt: new Date() },
    });
    if (claimed.count === 0) return; // өөр зам аль хэдийн confirm хийсэн

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        plan: true,
        /* ⚠️ Telegram мэдэгдэлд хэрэглэгчийн нэр/имэйл хэрэгтэй */
        user: { select: { name: true, email: true } },
        rentalTitle: { select: { title: true } },
      },
    });
    if (!payment) return;

    /**
     * ⚠️ TELEGRAM МЭДЭГДЭЛ — АДМИНД. `void` (await БИШ) тул мэдэгдэл
     * удаашрахад төлбөрийн урсгал хүлээхгүй.
     *
     * ⚠️ ЭНД байрлуулав (эрх нээхээс ӨМНӨ) — доорх салаанууд бүгд
     * `return` хийдэг тул төгсгөлд тавибал зөвхөн багцын төлбөр
     * мэдэгдэгдэнэ, түрээс/цэнэглэлт алдагдана.
     */
    this.n8n.emitPaymentPaid({
      paymentId: payment.id,
      userId: payment.userId,
      userName: payment.user?.name ?? null,
      userEmail: payment.user?.email ?? '',
      amount: payment.amount,
      planName: payment.plan?.name ?? null,
      titleName: payment.rentalTitle?.title ?? null,
      isWalletTopup: payment.isWalletTopup,
      method: payment.bankReference ? 'BANK' : payment.qpayInvoiceId ? 'QPAY' : 'WALLET',
      couponCode: payment.couponCode,
      paidAt: new Date().toISOString(),
    });

    /**
     * WARN Meta Conversions API - server-side Purchase.
     *
     * Placed HERE for the same reason as the Telegram notify above:
     * every branch below returns, so anything at the end of the method
     * would only fire for plans and silently miss rentals and top-ups.
     *
     * WARN `void` - Meta must never delay or break a payment.
     * WARN Wallet TOP-UPS are excluded: the money has not been spent
     * yet, and counting both the top-up and the later purchase would
     * double-count revenue.
     */
    if (!payment.isWalletTopup) {
      void this.capi.purchase({
        eventId: payment.id,
        email: payment.user?.email,
        value: payment.amount,
        contentName: payment.plan?.name ?? payment.rentalTitle?.title ?? null,
        kind: payment.rentalTitleId ? 'rental' : 'plan',
      });
    }

    // ── Хэтэвч цэнэглэлт ────────────────────────────────────────────────
    if (payment.isWalletTopup) {
      await this.wallet.applyTransaction({
        userId: payment.userId,
        type: WalletTxType.TOPUP,
        amount: payment.amount,
        description: `QPay-ээр ${payment.amount.toLocaleString()}₮ цэнэглэсэн`,
        paymentId: payment.id,
      });
      this.logger.log(`Хэтэвч цэнэглэгдлээ: user=${payment.userId} +${payment.amount}₮`);

      /* ⚠️⚠️ АМЛАСАН БОНУСЫГ ОЛГОНО — өмнө нь ОГТ олгогддоггүй байв
         (дэлгэрэнгүйг `topupWallet` доторх тайлбараас үз) */
      const bonusAmount = await this.applyWalletBonus(payment);

      // Мэдэгдэл — хэрэглэгч цэнэглэлт орсныг мэдэх ёстой
      const u = await this.prisma.user.findUnique({
        where: { id: payment.userId },
        select: { email: true, name: true, walletBalance: true },
      });
      if (u) {
        this.email.sendWalletTopup({
          to: u.email,
          /* ⚠️ Бонус орсон бол имэйлд НИЙТ дүнг харуулна — эс бөгөөс
             хэрэглэгч «би 60,000₮ авсан ч имэйл 50,000₮ гэж байна»
             гэж эргэлзэнэ */
          name: u.name,
          amount: payment.amount + bonusAmount,
          balance: u.walletBalance,
          userId: payment.userId,
        });
      }
      return;
    }

    // ── Ширхэгээр түрээслэх ─────────────────────────────────────────────
    if (payment.rentalTitleId) {
      await this.rentals.grantFromPayment(payment.id, payment.userId, payment.rentalTitleId);
      this.logger.log(
        `Түрээс нээгдлээ (QPay): user=${payment.userId} title=${payment.rentalTitleId}`,
      );
      return;
    }

    // ── Багц худалдан авалт ─────────────────────────────────────────────
    if (!payment.plan) {
      this.logger.error(`Payment ${payment.id}: багц олдсонгүй (planId=${payment.planId})`);
      return;
    }

    /**
     * ─── УРАМШУУЛЛЫН БОНУС ───────────────────────────────────────
     *
     * ⚠️⚠️ `payment.promotionId` нь ТӨЛБӨР ҮҮСГЭХ үед тэмдэглэгдсэн.
     * Одоо дахин бодохгүй — эс бөгөөс хэрэглэгч 5 минут QR хүлээж
     * байх зуур урамшуулал дуусвал хямдруулсан үнээр төлөөд бонусаа
     * АВАХГҮЙ үлдэнэ (шударга бус).
     */
    const bonus = await this.applyPromotionBonus(payment);

    await this.subs.grant(
      payment.userId,
      payment.plan.id,
      payment.plan.durationDays + bonus.extraDays,
      payment.id,
    );
    if (payment.couponCode) {
      await this.coupons.incrementUse(payment.couponCode);
    }
    this.logger.log(
      `Эрх нээгдлээ: user=${payment.userId} plan=${payment.plan.name} (${payment.plan.durationDays} хоног)`,
    );

    // ── Багц идэвхжсэн имэйл ──
    const [buyer, planFull, activeSub] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: payment.userId },
        select: { email: true, name: true },
      }),
      this.prisma.plan.findUnique({
        where: { id: payment.plan.id },
        select: { isVip: true, genres: { select: { genre: { select: { name: true } } } } },
      }),
      this.prisma.subscription.findFirst({
        where: { userId: payment.userId, planId: payment.plan.id },
        orderBy: { expiresAt: 'desc' },
        select: { expiresAt: true },
      }),
    ]);
    if (buyer && activeSub) {
      this.email.sendSubscriptionActivated({
        to: buyer.email,
        name: buyer.name,
        planName: payment.plan.name,
        amount: payment.amount,
        expiresAt: activeSub.expiresAt,
        isVip: planFull?.isVip,
        genres: planFull?.genres.map((g) => g.genre.name),
        userId: payment.userId,
      });
    }
  }

  // ─── Админы гар удирдлага ─────────────────────────────────────────────────

  /**
   * Админ төлбөрийг ГАРААР баталгаажуулна (банкаар шилжүүлсэн гэх мэт).
   *
   * ⚠️ `completePayment` дуудагдана → багц/хэтэвч АВТОМАТ идэвхжинэ, имэйл
   * илгээгдэнэ. Тусад нь эрх олгох шаардлагагүй.
   */
  async adminMarkPaid(paymentId: string, adminId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Төлбөр олдсонгүй');
    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException('Энэ төлбөр аль хэдийн баталгаажсан байна');
    }
    /**
     * ⚠️⚠️ ЦУЦЛАГДСАН төлбөрийг ДАХИН баталгаажуулахыг ХОРИГЛОНО.
     *
     * `adminCancel` нь эрхийг хүчингүй болгож, хэтэвчийн мөнгийг
     * БУЦААСАН байдаг. Үүнийг дахин PAID болговол эрх ДАХИН олгогдох
     * ба буцаасан мөнгө хэрэглэгчид ҮЛДЭНЭ → мөнгө хэвлэгдэнэ.
     * Мөн `PAID→CANCELLED→PAID` мөчлөгт `WalletTransaction` түүх
     * хуурамч томорч, `balanceAfter` snapshot-ууд утгагүй болно.
     *
     * Алдаатай цуцалсан бол ШИНЭ төлбөр үүсгэх нь зөв (түүх тодорхой).
     */
    if (payment.status === PaymentStatus.CANCELLED) {
      throw new BadRequestException(
        'Цуцлагдсан төлбөрийг дахин баталгаажуулах боломжгүй — шинэ төлбөр үүсгэнэ үү',
      );
    }

    /**
     * ⚠️⚠️ БУЦААГДСАН МӨНГИЙГ ДАХИН ЭРХ БОЛГОХГҮЙ.
     *
     * БОДИТ АЛДАА: `CANCELLED` хамгаалалт байсан ч `FAILED` салаа
     * нээлттэй байв. Гэтэл `purchaseWithWallet` нь `subs.grant` унавал
     * хэтэвчрүү мөнгийг БУЦААЖ өгөөд төлбөрийг `FAILED` болгодог.
     *
     * Тэр төлбөрийг админ «туслая» гээд PAID болговол: хэрэглэгч
     * багцаа АВНА, буцаасан мөнгө нь хэтэвчиндээ ҮЛДЭНЭ — үнэгүй
     * багц. Яг энэ эрсдэлээс сэргийлэхээр `CANCELLED` шалгалт
     * бичигдсэн мөртлөө кодын өөрийн үүсгэдэг тохиолдлыг алгассан.
     *
     * Тиймээс: энэ төлбөрөөр REFUND гүйлгээ хийгдсэн бол ТАТГАЛЗАНА.
     */
    const refunded = await this.prisma.walletTransaction.findFirst({
      where: { paymentId, type: { in: [WalletTxType.REFUND, WalletTxType.ADMIN_DEBIT] } },
      select: { id: true, amount: true },
    });
    if (refunded) {
      throw new BadRequestException(
        'Энэ төлбөрийн мөнгө хэрэглэгчид аль хэдийн буцаагдсан байна. ' +
          'Баталгаажуулбал багц үнэгүй олгогдоно — шинэ төлбөр үүсгэнэ үү.',
      );
    }

    // ⚠️ completePayment нь PENDING-ээс л шилжүүлдэг тул эхлээд PENDING болгоно
    // (FAILED/EXPIRED-ээс сэргээх тохиолдол).
    if (payment.status !== PaymentStatus.PENDING) {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.PENDING },
      });
    }

    await this.completePayment(paymentId);
    this.logger.log(`Админ гараар баталгаажууллаа: payment=${paymentId} admin=${adminId}`);
    return this.prisma.payment.findUnique({ where: { id: paymentId } });
  }

  /**
   * Админ төлбөрийг цуцална.
   *
   * ⚠️ ТӨЛӨГДСӨН төлбөрийг цуцлахад тухайн төлбөрөөр олгогдсон ЭРХ ч
   * хүчингүй болно — эс бөгөөс хэрэглэгч төлөөгүй мөртлөө үзсээр байна.
   */
  async adminCancel(paymentId: string, adminId: string, reason?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Төлбөр олдсонгүй');
    if (payment.status === PaymentStatus.CANCELLED) {
      throw new BadRequestException('Аль хэдийн цуцлагдсан байна');
    }

    const wasPaid = payment.status === PaymentStatus.PAID;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.CANCELLED },
      });

      if (wasPaid) {
        // Энэ төлбөрөөр олгогдсон эрхийг хүчингүй болгоно
        await tx.subscription.updateMany({
          where: { paymentId, expiresAt: { gt: new Date() } },
          data: { expiresAt: new Date() },
        });

        // ⚠️ Хэтэвч цэнэглэлт байсан бол дүнг БУЦААН ХАСНА — эс бөгөөс
        // хэрэглэгч цуцлагдсан төлбөрийн мөнгийг ашиглана.
        // `applyTransaction` нь balanceAfter-ыг өөрөө бодно.
        if (payment.isWalletTopup) {
          await this.wallet.applyTransaction({
            userId: payment.userId,
            type: WalletTxType.ADMIN_DEBIT,
            amount: -payment.amount,
            description: `Админ цуцалсан төлбөр${reason ? `: ${reason}` : ''}`,
            paymentId,
            tx,
          });
        } else {
          /**
           * ⚠️⚠️ ХЭТЭВЧЭЭР ТӨЛСӨН БАГЦЫГ ЦУЦЛАХАД МӨНГИЙГ БУЦААНА.
           *
           * Өмнө нь ЗӨВХӨН `isWalletTopup` салбар байсан тул хэрэглэгч
           * хэтэвчээр 29,000₮-ийн багц авч, админ цуцлахад ЭРХ НЬ
           * ХААГДААД МӨНГӨ НЬ Ч АЛГА болдог байв — бүрэн алдагдал,
           * санхүүгийн маргаан.
           *
           * ⚠️ QPay-ээр ШУУД төлсөн бол хэтэвчинд буцаахгүй — тэр мөнгө
           * хэтэвчээр ороогүй тул банкаар буцаах ёстой (гараар).
           * Тиймээс `WalletTransaction`-оос ЯГ хэдийг хассаныг олж,
           * түүнийг л буцаана — таамаглахгүй.
           *
           * ⚠️ Купоноор 0₮ болсон бол гүйлгээ огт үүсээгүй → буцаах юм
           * байхгүй (`spent` олдохгүй, алгасна).
           */
          const [spent, alreadyRefunded] = await Promise.all([
            tx.walletTransaction.findFirst({
              where: { paymentId, type: WalletTxType.PURCHASE },
              select: { amount: true },
            }),
            /**
             * ⚠️ ДАВХАР БУЦААЛТААС сэргийлнэ. `adminMarkPaid` нь
             * цуцлагдсан төлбөрийг PENDING болгож дахин PAID хийж чадна
             * — тэр мөчлөгт REFUND давтагдвал хэрэглэгч мөнгө хэвлэнэ.
             */
            tx.walletTransaction.findFirst({
              where: { paymentId, type: WalletTxType.REFUND },
              select: { id: true },
            }),
          ]);
          if (spent && spent.amount < 0 && !alreadyRefunded) {
            await this.wallet.applyTransaction({
              userId: payment.userId,
              type: WalletTxType.REFUND,
              /* ⚠️ `spent.amount` нь СӨРӨГ (хасалт) тул эргүүлж эерэг болгоно */
              amount: -spent.amount,
              description: `Цуцлагдсан багцын буцаалт${reason ? `: ${reason}` : ''}`,
              paymentId,
              tx,
            });
          }
        }
      }
    });

    this.logger.log(
      `Админ цуцаллаа: payment=${paymentId} admin=${adminId} эрх${wasPaid ? ' хүчингүй' : ' хөндөөгүй'}`,
    );
    return this.prisma.payment.findUnique({ where: { id: paymentId } });
  }

  // ─── Хэтэвч ───────────────────────────────────────────────────────────────

  /** Хэтэвч цэнэглэх QPay invoice үүсгэнэ */
  async topupWallet(userId: string, amount: number) {
    if (amount < 1000) throw new BadRequestException('Хамгийн бага дүн 1,000₮');
    if (amount > 5_000_000) throw new BadRequestException('Хамгийн их дүн 5,000,000₮');

    /**
     * ─── ХЭТЭВЧИЙН БОНУС УРАМШУУЛАЛ ─────────────────────────────────
     *
     * ⚠️⚠️ БОДИТ АЛДАА: `WALLET_BONUS` урамшууллыг frontend нь
     * `GET /promotions/wallet-bonus`-ээр уншиж «+10,000₮ бонус» гэж
     * ХАРУУЛДАГ мөртлөө, цэнэглэлт дуусахад бонус ОГТ ОРДОГГҮЙ байв.
     * `walletBonusFor()` нь бүх кодын санд ЗӨВХӨН харуулах endpoint-
     * оос дуудагддаг байсан — олгох зам БАЙХГҮЙ.
     *
     * Үр дүн: хэрэглэгч 50,000₮ цэнэглээд яг 50,000₮ авна. Амласан
     * бонус ирэхгүй, `usedCount` 0 хэвээр, `PromotionRedemption` мөр
     * үүсэхгүй тул ЯМАР Ч мөрдөх бичлэг үлдэхгүй.
     *
     * ⚠️ Багцын урсгалтай ЯГ ИЖИЛ зарчим: урамшууллыг ОДОО түгжиж
     * `promotionId`-д тэмдэглэнэ. Хэрэглэгч QR-аа уншуулж байх зуур
     * урамшуулал дуусвал ч амласан бонусаа АВНА (шударга).
     */
    const bonusPromo = await this.promotions.walletBonusFor(amount, userId);

    // DEV mode — QPay тохируулаагүй бол шууд цэнэглэнэ
    if (!this.isQPayConfigured()) {
      const devPayment = await this.prisma.payment.create({
        data: {
          userId,
          amount,
          status: PaymentStatus.PENDING,
          isWalletTopup: true,
          promotionId: bonusPromo?.id ?? null,
        },
      });
      this.logger.warn('QPay тохируулаагүй — dev mode: хэтэвч автомат цэнэглэгдлээ');
      await this.completePayment(devPayment.id);
      return { devMode: true, paymentId: devPayment.id, status: 'PAID' };
    }

    const qpay = this.config.get('qpay');
    /* ⚠️ QPay-д бизнесийн нэр ОРУУЛАХГҮЙ — дэлгэрэнгүйг
       `initiatePayment` доторх тайлбараас үз. */
    const identifier = randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase();
    const invoiceBody = {
      invoice_code: qpay.invoiceCode,
      sender_invoice_no: identifier,
      invoice_receiver_code: userId.slice(0, 20),
      invoice_description: `Order ${identifier}`,
      amount,
      callback_url: qpay.callbackUrl,
    };

    const callInvoice = async (token: string) =>
      fetch('https://merchant.qpay.mn/v2/invoice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceBody),
        /* ⚠️ QPay удаашрахад HTTP хүсэлт ХЯЗГААРГҮЙ өлгөгдөж,
           хэрэглэгч «боловсруулж байна» дээр гацна */
        signal: AbortSignal.timeout(15_000),
      });

    let response = await callInvoice(await this.getQPayToken());
    if (response.status === 401 || response.status === 403) {
      this.tokenCache = null;
      response = await callInvoice(await this.getQPayToken());
    }
    if (!response.ok) {
      this.logger.error(`QPay topup invoice амжилтгүй: ${await response.text()}`);
      throw new BadRequestException('QPay нэхэмжлэл үүсгэж чадсангүй');
    }

    const invoice = (await response.json()) as QPayInvoiceResponse;
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        amount,
        status: PaymentStatus.PENDING,
        isWalletTopup: true,
        /* ⚠️ Бонусыг ОДОО түгжинэ — дээрх тайлбарыг үз */
        promotionId: bonusPromo?.id ?? null,
        qpayInvoiceId: invoice.invoice_id,
        qpayQrText: invoice.qr_text,
        qpayQrImage: invoice.qr_image,
        qpayUrls: invoice.urls as object,
      },
    });

    return {
      devMode: false,
      paymentId: payment.id,
      invoiceId: invoice.invoice_id,
      qrText: invoice.qr_text,
      qrImage: invoice.qr_image,
      urls: invoice.urls,
      amount,
    };
  }

  /**
   * Хэтэвчийн үлдэгдлээр багц худалдан авах — QPay дамжихгүй, шууд.
   * ⚠️ Үлдэгдэл хасах + эрх нээх нь НЭГ transaction дотор (атомар).
   */
  async purchaseWithWallet(userId: string, planId: string, couponCode?: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Багц олдсонгүй');

    /**
     * ⚠️⚠️ QPay-ийн `initiate`-ТАЙ ЯГ ИЖИЛ дараалал байх ЁСТОЙ:
     * урамшуулал → купон. Хоёр зам өөр үнэ гаргавал хэрэглэгч
     * хэтэвчээр авахад илүү/дутуу төлнө.
     */
    const promoMap = await this.promotions.forPlans(
      [{ id: plan.id, price: plan.price, durationDays: plan.durationDays }],
      userId,
    );
    const promo = promoMap.get(plan.id) ?? null;

    let amount = promo?.finalPrice ?? plan.price;
    const promotionId = promo?.id ?? null;

    let normalizedCoupon: string | undefined;
    if (couponCode) {
      if (promo?.blockCoupons) {
        throw new BadRequestException(
          `«${promo.name}» урамшууллын үед купон код ашиглах боломжгүй`,
        );
      }
      /* ⚠️ `userId` ЗААВАЛ — хувийн купоныг өөр хүн ашиглахаас хамгаална */
      const result = await this.coupons.validate({ code: couponCode, price: amount }, userId);
      amount = result.finalPrice;
      normalizedCoupon = couponCode.toUpperCase().trim();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      /* WARN `email` is needed by Meta CAPI below - without a hashed
         identifier Meta accepts the event but can match it to nobody,
         making it worthless for ad optimisation. */
      select: { walletBalance: true, email: true },
    });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    if (user.walletBalance < amount) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_BALANCE',
        message: `Хэтэвчийн үлдэгдэл хүрэлцэхгүй байна (${user.walletBalance.toLocaleString()}₮ / ${amount.toLocaleString()}₮)`,
      });
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          userId,
          planId,
          amount,
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          couponCode: normalizedCoupon,
          promotionId,
          originalAmount: normalizedCoupon || promotionId ? plan.price : undefined,
        },
      });

      // 100% купоноор 0₮ болсон бол хэтэвчнээс юу ч хасахгүй (хоосон гүйлгээ
      // үүсгэхгүй) — эрх нь доор ижилхэн нээгдэнэ.
      if (amount > 0) {
        await this.wallet.applyTransaction({
          userId,
          type: WalletTxType.PURCHASE,
          amount: -amount,
          description: `${plan.name} — ${amount.toLocaleString()}₮`,
          paymentId: p.id,
          planId: plan.id,
          tx,
        });
      }

      return p;
    });

    /**
     * ⚠️⚠️ ЭРХ ОЛГОЛТ УНАВАЛ МӨНГИЙГ БУЦААНА.
     *
     * `subs.grant` нь өөрийн `$transaction`-той тул дээрх хасалттай
     * НЭГ транзакцад багтахгүй. Хэрэв энэ шатанд унавал (DB timeout,
     * plan мөр устсан, процесс restart) хэрэглэгчийн мөнгө хасагдчихаад
     * багц НЭЭГДЭХГҮЙ үлдэнэ. `Payment.status = PAID` тул reconcile ч
     * дахин олгохгүй — гараар засахаас өөр сэргэлт байхгүй байв.
     *
     * ⚠️ Буцаалт нь `REFUND` төрлөөр бүртгэгдэнэ — хэрэглэгч хэтэвчийн
     * түүхээсээ юу болсныг ХАРНА (чимээгүй алдагдал биш).
     */
    /**
     * ⚠️⚠️ УРАМШУУЛЛЫН БОНУС — ХЭТЭВЧИЙН ЗАМД ОРХИГДСОН БАЙВ.
     *
     * QPay замд (`completePayment`) `applyPromotionBonus` дуудагдаж
     * бонус хоног, бэлэг багц олгогддог. Хэтэвчээр авахад ЭНЭ АЛХАМ
     * БАЙХГҮЙ байсан тул хэрэглэгч:
     *   • урамшууллын ХЯМДРУУЛСАН үнээр төлөөд
     *   • амласан БОНУС ХОНОГОО авахгүй
     *   • бэлэг багц нээгдэхгүй
     *   • `usedCount` нэмэгдэхгүй тул урамшуулал ХЯЗГААРГҮЙ ашиглагдана
     *
     * ⚠️ Хоёр зам ижил дараалалтай байх ёстой — үнэ бодоход хэрэгжсэн
     * атлаа бонус олгоход хэрэгжээгүй байв.
     */
    /* ⚠️ `payment` нь `plan`-гүй тул гараар угсарна (QPay зам include-тэй) */
    const bonus = await this.applyPromotionBonus({
      id: payment.id,
      userId,
      promotionId: payment.promotionId,
      amount: payment.amount,
      originalAmount: payment.originalAmount,
      plan: { id: plan.id, durationDays: plan.durationDays },
    });

    try {
      await this.subs.grant(userId, plan.id, plan.durationDays + bonus.extraDays, payment.id);
    } catch (e) {
      this.logger.error(
        `Хэтэвчээр эрх олгож чадсангүй — мөнгө буцаана: user=${userId} plan=${plan.id} — ${String(e)}`,
      );
      if (amount > 0) {
        await this.wallet
          .applyTransaction({
            userId,
            type: WalletTxType.REFUND,
            amount,
            description: `${plan.name} — эрх нээгдээгүй тул буцаалт`,
            paymentId: payment.id,
            planId: plan.id,
          })
          .catch((re) =>
            /* ⚠️ Буцаалт ч унавал ЗААВАЛ логлоно — админ гараар засна */
            this.logger.error(`⚠️ БУЦААЛТ ЧУ УНАВ: payment=${payment.id} — ${String(re)}`),
          );
      }
      await this.prisma.payment
        .update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } })
        .catch(() => null);
      throw new BadRequestException(
        'Эрх нээхэд алдаа гарлаа. Мөнгө хэтэвч рүү буцаагдлаа, дахин оролдоно уу.',
      );
    }
    if (normalizedCoupon) await this.coupons.incrementUse(normalizedCoupon);
    /* ⚠️ Бонусын лог — QPay замтай ижил байдлаар (мөрдлөгт хэрэгтэй) */
    if (bonus.extraDays > 0) {
      this.logger.log(
        `Хэтэвчийн урамшуулал: user=${userId} +${bonus.extraDays} хоног (payment=${payment.id})`,
      );
    }

    /**
     * ⚠️ БАТАЛГААЖУУЛАХ ИМЭЙЛ — өмнө нь ЗӨВХӨН QPay-ээр авахад илгээгддэг
     * байсан тул хэтэвчээр авсан хэрэглэгч ямар ч бичгэн баримтгүй үлддэг
     * байв (хэдэн төгрөг хассан, хэзээ дуусахыг мэдэхгүй).
     * `await` ХИЙХГҮЙ — имэйл унасан ч худалдан авалт амжилттай хэвээр.
     */
    void this.sendWalletPurchaseEmail(userId, plan.id, plan.name, amount);

    /**
     * WARN Meta Purchase - the wallet path BYPASSES `completePayment`
     * (it writes PAID straight into its own transaction), so the CAPI
     * call there never runs for wallet buys. Without this line every
     * wallet purchase is invisible to Meta and ad optimisation is
     * trained on partial data.
     *
     * WARN Same `eventId` shape as the QPay path (the payment id), so
     * browser and server events still deduplicate.
     */
    void this.capi.purchase({
      eventId: payment.id,
      email: user.email,
      value: amount,
      contentName: plan.name,
      kind: 'plan',
    });

    this.logger.log(`Хэтэвчээр эрх нээгдлээ: user=${userId} plan=${plan.name} -${amount}₮`);
    return { ok: true, paymentId: payment.id, planName: plan.name };
  }

  /** Хэтэвчээр багц авсны баталгаажуулах имэйл (алдаа гарвал зөвхөн log) */
  private async sendWalletPurchaseEmail(
    userId: string,
    planId: string,
    planName: string,
    amount: number,
  ) {
    try {
      const [buyer, planFull, activeSub] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        }),
        this.prisma.plan.findUnique({
          where: { id: planId },
          select: { isVip: true, genres: { select: { genre: { select: { name: true } } } } },
        }),
        this.prisma.subscription.findFirst({
          where: { userId, planId },
          orderBy: { expiresAt: 'desc' },
          select: { expiresAt: true },
        }),
      ]);
      if (!buyer || !activeSub) return;

      this.email.sendSubscriptionActivated({
        to: buyer.email,
        name: buyer.name,
        planName,
        amount,
        expiresAt: activeSub.expiresAt,
        isVip: planFull?.isVip,
        genres: planFull?.genres.map((g) => g.genre.name),
        userId,
      });
    } catch (e) {
      this.logger.warn(
        `Хэтэвчийн худалдан авалтын имэйл илгээж чадсангүй (user=${userId}): ${
          e instanceof Error ? e.message : e
        }`,
      );
    }
  }

  private async verifyPaymentWithQpay(qpayInvoiceId: string): Promise<boolean> {
    if (!this.isQPayConfigured()) return false;
    try {
      const checkBody = JSON.stringify({
        object_type: 'INVOICE',
        object_id: qpayInvoiceId,
        offset: { page_number: 1, page_limit: 100 },
      });
      const callCheck = async (token: string) =>
        fetch('https://merchant.qpay.mn/v2/payment/check', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: checkBody,
          signal: AbortSignal.timeout(15_000),
        });
      let res = await callCheck(await this.getQPayToken());
      if (res.status === 401 || res.status === 403) {
        this.tokenCache = null;
        res = await callCheck(await this.getQPayToken());
      }
      if (!res.ok) return false;
      const result = await res.json();
      return (
        result.count > 0 &&
        (result.rows ?? []).some(
          (r: any) => r.payment_status === 'PAID' || r.payment_status === 'paid',
        )
      );
    } catch (err) {
      this.logger.error('QPay verify алдаа', err);
      return false;
    }
  }

  private verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = this.config.get<string>('qpay.webhookSecret');
    if (!secret) return this.config.get<string>('nodeEnv') === 'development';

    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    try {
      return timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature.replace(/^sha256=/, ''), 'hex'),
      );
    } catch {
      return expected === signature.replace(/^sha256=/, '');
    }
  }

  private async getQPayToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const qpay = this.config.get('qpay');
    const credentials = Buffer.from(`${qpay.username}:${qpay.password}`).toString('base64');

    const response = await fetch('https://merchant.qpay.mn/v2/auth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new BadRequestException('QPay нэвтрэлт амжилтгүй');
    }

    const data = (await response.json()) as QPayTokenResponse;

    // ⚠️ КРИТИК: QPay expires_in нь Unix TIMESTAMP (секунд) байдаг — "хэдэн
    // секундын дараа" БИШ. Буруу тооцвол cache мөнхөрч NO_CREDENTIALS 401 гарна
    // (DigitalGer дээр хэрэглэгчид төлж чадахгүй болсон бодит осол).
    const now = Date.now();
    const raw = Number(data.expires_in) || 0;
    let expiresAtMs: number;
    if (raw > 1_000_000_000 && raw < 100_000_000_000) {
      expiresAtMs = raw * 1000 - 60_000; // Unix timestamp (сек) → ms, 60с буфер
    } else if (raw > 0) {
      expiresAtMs = now + (raw - 60) * 1000;
    } else {
      expiresAtMs = now + 60 * 60 * 1000;
    }
    const MAX = now + 12 * 60 * 60 * 1000; // дээд 12 цаг
    if (expiresAtMs > MAX || expiresAtMs <= now) expiresAtMs = MAX;

    this.tokenCache = { token: data.access_token, expiresAt: expiresAtMs };
    return data.access_token;
  }
}
