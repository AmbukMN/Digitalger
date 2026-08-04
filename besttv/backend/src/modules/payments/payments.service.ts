import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { WalletTxType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CouponsService } from '../coupons/coupons.module';
import { WalletService } from '../wallet/wallet.module';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly subs: SubscriptionsService,
    private readonly coupons: CouponsService,
    private readonly wallet: WalletService,
    private readonly email: EmailService,
  ) {}

  isQPayConfigured(): boolean {
    const qpay = this.config.get('qpay');
    return Boolean(qpay.username && qpay.password && qpay.invoiceCode);
  }

  /** Багц сонгоод QPay invoice үүсгэнэ (QR + банкны deeplink), купон код заавал биш */
  async initiate(planId: string, userId: string, couponCode?: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Багц олдсонгүй');

    let amount = plan.price;
    let normalizedCoupon: string | undefined;
    if (couponCode) {
      const result = await this.coupons.validate({ code: couponCode, price: plan.price });
      amount = result.finalPrice;
      normalizedCoupon = couponCode.toUpperCase().trim();
    }

    // ⚠️ 100% хямдрал (эсвэл үнэ 0) — QPay 0₮ нэхэмжлэл авдаггүй тул QPay
    // дамжуулахгүй, шууд төлөгдсөнд тооцож эрхийг нээнэ.
    if (amount <= 0) {
      const freePayment = await this.prisma.payment.create({
        data: {
          userId,
          planId,
          amount: 0,
          status: PaymentStatus.PENDING,
          couponCode: normalizedCoupon,
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
          originalAmount: normalizedCoupon ? plan.price : undefined,
        },
      });
      this.logger.warn('QPay тохируулаагүй — dev mode: төлбөр автомат баталгаажлаа');
      await this.completePayment(devPayment.id);
      return { devMode: true, paymentId: devPayment.id, status: 'PAID' };
    }

    const qpay = this.config.get('qpay');
    const identifier = `BTV-${userId.slice(-6)}-${Date.now()}`;
    const invoiceBody = {
      invoice_code: qpay.invoiceCode,
      sender_invoice_no: identifier,
      invoice_receiver_code: userId.slice(0, 20),
      invoice_description: `BestTV ${plan.name}`,
      amount,
      callback_url: qpay.callbackUrl,
    };

    // Token cache хүчингүй (401/403) бол шинээр авч НЭГ удаа дахин оролдоно
    const callInvoice = async (token: string) =>
      fetch('https://merchant.qpay.mn/v2/invoice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceBody),
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

    const invoice = (await response.json()) as QPayInvoiceResponse;

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        planId,
        amount,
        status: PaymentStatus.PENDING,
        couponCode: normalizedCoupon,
        originalAmount: normalizedCoupon ? plan.price : undefined,
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

  /** Хэрэглэгчийн өөрийн захиалгын тvvх (profile хуудсанд) */
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
    const since = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    const pending = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        qpayInvoiceId: { not: null },
        createdAt: { gte: since },
      },
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
    return confirmed;
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
  async completePayment(paymentId: string) {
    const claimed = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.PAID, paidAt: new Date() },
    });
    if (claimed.count === 0) return; // өөр зам аль хэдийн confirm хийсэн

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { plan: true },
    });
    if (!payment) return;

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

      // Мэдэгдэл — хэрэглэгч цэнэглэлт орсныг мэдэх ёстой
      const u = await this.prisma.user.findUnique({
        where: { id: payment.userId },
        select: { email: true, name: true, walletBalance: true },
      });
      if (u) {
        this.email.sendWalletTopup({
          to: u.email,
          name: u.name,
          amount: payment.amount,
          balance: u.walletBalance,
          userId: payment.userId,
        });
      }
      return;
    }

    // ── Багц худалдан авалт ─────────────────────────────────────────────
    if (!payment.plan) {
      this.logger.error(`Payment ${payment.id}: багц олдсонгүй (planId=${payment.planId})`);
      return;
    }

    await this.subs.grant(
      payment.userId,
      payment.plan.id,
      payment.plan.durationDays,
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

    // DEV mode — QPay тохируулаагүй бол шууд цэнэглэнэ
    if (!this.isQPayConfigured()) {
      const devPayment = await this.prisma.payment.create({
        data: { userId, amount, status: PaymentStatus.PENDING, isWalletTopup: true },
      });
      this.logger.warn('QPay тохируулаагүй — dev mode: хэтэвч автомат цэнэглэгдлээ');
      await this.completePayment(devPayment.id);
      return { devMode: true, paymentId: devPayment.id, status: 'PAID' };
    }

    const qpay = this.config.get('qpay');
    const identifier = `BTV-W-${userId.slice(-6)}-${Date.now()}`;
    const invoiceBody = {
      invoice_code: qpay.invoiceCode,
      sender_invoice_no: identifier,
      invoice_receiver_code: userId.slice(0, 20),
      invoice_description: `BestTV хэтэвч цэнэглэлт ${amount}₮`,
      amount,
      callback_url: qpay.callbackUrl,
    };

    const callInvoice = async (token: string) =>
      fetch('https://merchant.qpay.mn/v2/invoice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceBody),
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

    let amount = plan.price;
    let normalizedCoupon: string | undefined;
    if (couponCode) {
      const result = await this.coupons.validate({ code: couponCode, price: plan.price });
      amount = result.finalPrice;
      normalizedCoupon = couponCode.toUpperCase().trim();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
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
          originalAmount: normalizedCoupon ? plan.price : undefined,
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

    // Эрх нээх (transaction гадна — subs.grant өөрийн логиктой)
    await this.subs.grant(userId, plan.id, plan.durationDays, payment.id);
    if (normalizedCoupon) await this.coupons.incrementUse(normalizedCoupon);

    /**
     * ⚠️ БАТАЛГААЖУУЛАХ ИМЭЙЛ — өмнө нь ЗӨВХӨН QPay-ээр авахад илгээгддэг
     * байсан тул хэтэвчээр авсан хэрэглэгч ямар ч бичгэн баримтгүй үлддэг
     * байв (хэдэн төгрөг хассан, хэзээ дуусахыг мэдэхгүй).
     * `await` ХИЙХГҮЙ — имэйл унасан ч худалдан авалт амжилттай хэвээр.
     */
    void this.sendWalletPurchaseEmail(userId, plan.id, plan.name, amount);

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
