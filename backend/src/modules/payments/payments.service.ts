import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { N8nService } from '../n8n/n8n.service';
import { computeOrderExpiresAt } from '../../common/access-expiry';
import { NotificationCenterService } from '../notification-center/notification-center.service';
import { BonumService } from './bonum.service';

/** Bonum-аар төлөх аргууд (QPay/Данс энд ХАМААРАХГҮЙ — тэдгээр өөр зам) */
export const BONUM_METHODS = ['card', 'applepay', 'googlepay', 'wechat'] as const;
export type BonumMethod = (typeof BONUM_METHODS)[number];

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

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly n8n: N8nService,
    private readonly notifications: NotificationCenterService,
    private readonly bonum: BonumService,
  ) {}

  isQPayConfigured(): boolean {
    const qpay = this.config.get('qpay');
    return Boolean(qpay.username && qpay.password && qpay.invoiceCode);
  }

  /**
   * Боломжтой төлбөрийн аргууд — frontend checkout sheet-д харуулна.
   * QPay/Данс нь тусдаа (үргэлж боломжтой); энд зөвхөн Bonum (карт/WeChat)
   * тохируулагдсан эсэхийг буцаана. Карт=VISA/Master/UnionPay/Amex,
   * Apple/Google/WeChat бүгд Bonum-аар (card флаг дор).
   */
  availableMethods(): { qpay: boolean; card: boolean } {
    return { qpay: this.isQPayConfigured(), card: this.bonum.isConfigured() };
  }

  async initiate(orderId: string, userId: string, method?: BonumMethod) {
    // ⚠️ Bonum (карт/WeChat) сонгосон бол ТУСДАА зам — QPay урсгал хөндөгдөхгүй.
    if (method && (BONUM_METHODS as readonly string[]).includes(method)) {
      return this.initiateBonum(orderId, userId, method);
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: true,
        payments: {
          where: { status: PaymentStatus.PENDING },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not pending payment');
    }

    // ── Idempotent QPay: reuse existing PENDING payment if QPay invoice exists ─
    const existingPayment = order.payments[0];
    if (existingPayment?.qpayPaymentId && existingPayment.rawPayload) {
      const invoice = existingPayment.rawPayload as any;
      this.logger.log(`Reusing existing QPay invoice for order ${orderId}`);
      return {
        devMode: false,
        orderId: order.id,
        paymentId: existingPayment.id,
        identifier: order.qpayIdentifier ?? `DG-${order.id}`,
        invoiceId: existingPayment.qpayPaymentId,
        qrText: invoice.qr_text ?? '',
        qrImage: invoice.qr_image ?? '',
        urls: invoice.urls ?? [],
      };
    }

    // ── DEV mode (QPay тохируулаагүй) — payment үүсгээд шууд complete ──
    if (!this.isQPayConfigured()) {
      const devPayment = await this.prisma.payment.create({
        data: { orderId: order.id, amount: order.total, status: PaymentStatus.PENDING },
      });
      this.logger.warn('QPay not configured — auto-completing payment (dev mode)');
      await this.completePayment(order.id, devPayment.id, {
        devMode: true,
        qpayPaymentId: `dev-${devPayment.id}`,
      });
      return {
        devMode: true,
        orderId: order.id,
        paymentId: devPayment.id,
        status: PaymentStatus.SUCCESS,
        message: 'Payment auto-completed in development mode',
      };
    }

    const qpay = this.config.get('qpay');
    const identifier = `DG-${order.id}`;
    const invoiceBody = {
      invoice_code: qpay.invoiceCode,
      sender_invoice_no: identifier,
      invoice_receiver_code: userId.slice(0, 20),
      invoice_description: `DigitalGer order ${order.id}`,
      amount: Number(order.total),
      callback_url: qpay.callbackUrl,
    };

    // ⚠️ QPay invoice — token cache хүчингүй болсон (NO_CREDENTIALS/401) бол token-ийг
    // ШИНЭЭР авч НЭГ удаа дахин оролдоно. Энэ нь "NO_CREDENTIALS — Хандах эрхгүй" гэж
    // хэрэглэгч QR авч чадахгүй байсан гол bug-ийг засна (cache хуучин token барьдаг).
    const callInvoice = async (token: string) =>
      fetch('https://merchant.qpay.mn/v2/invoice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceBody),
      });

    let response = await callInvoice(await this.getQPayToken());
    if (response.status === 401 || response.status === 403) {
      this.tokenCache = null; // хүчингүй token-ийг цэвэрлэж шинээр авна
      response = await callInvoice(await this.getQPayToken());
    }

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`QPay invoice failed: ${text}`);
      // ⚠️ Invoice АМЖИЛТГҮЙ бол payment бичлэг ҮҮСГЭХГҮЙ (өмнө амжилтгүй ч
      // payment.create хийгээд NULL хог хуримтлуулдаг байсан — нэг order дээр
      // 15 NULL payment үүссэн). Одоо зөвхөн амжилттай invoice-д payment үүснэ.
      throw new BadRequestException('Failed to create QPay invoice');
    }

    const invoice = (await response.json()) as QPayInvoiceResponse;

    // ✅ Invoice амжилттай — ОДОО payment бичлэг үүсгэнэ (qpayPaymentId-тэй).
    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.total,
        status: PaymentStatus.PENDING,
        qpayPaymentId: invoice.invoice_id,
        rawPayload: invoice as object,
      },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { qpayIdentifier: identifier },
    });

    return {
      devMode: false,
      orderId: order.id,
      paymentId: payment.id,
      identifier,
      invoiceId: invoice.invoice_id,
      qrText: invoice.qr_text,
      qrImage: invoice.qr_image,
      urls: invoice.urls,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  BONUM (карт/WeChat) — QPay-тэй ЗЭРЭГЦЭЭ, тусдаа зам
  //  Урсгал: invoice үүсгэ → followUpLink redirect → webhook (checksum) → PAID
  //  ⚠️ Hosted checkout (эмбед боломжгүй). Карт хадгалахгүй (нэг удаагийн).
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Bonum-аар төлбөр эхлүүлэх — invoice үүсгээд hosted checkout линк буцаана.
   * Frontend `redirectUrl` байвал тийш нь шилжинэ (window.location.href).
   */
  async initiateBonum(orderId: string, userId: string, method: BonumMethod) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        payments: {
          where: { status: PaymentStatus.PENDING },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not pending payment');
    }
    if (!this.bonum.isConfigured()) {
      throw new BadRequestException('Карт төлбөр одоогоор боломжгүй байна');
    }

    // ── Идемпотент: одоо байгаа PENDING Bonum payment-ыг дахин ашиглана ──
    // (хэрэглэгч redirect-ээс буцаад дахин дарвал шинэ invoice үүсгэхгүй)
    const existing = order.payments[0];
    if (existing?.bonumInvoiceId && existing.bonumFollowUpLink) {
      return {
        devMode: false,
        orderId: order.id,
        paymentId: existing.id,
        redirectUrl: existing.bonumFollowUpLink,
        amount: Number(order.total),
      };
    }

    // ⚠️ Invoice амжилттай болсны ДАРАА Л payment.create (QPay-тэй ижил дүрэм —
    // амжилтгүй бол NULL хог үүсгэхгүй). Bonum invoice throw хийвэл payment алга.
    const invoice = await this.bonum.createInvoice(Number(order.total), method);

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.total,
        status: PaymentStatus.PENDING,
        provider: 'bonum',
        bonumInvoiceId: invoice.invoiceId,
        bonumFollowUpLink: invoice.followUpLink,
      },
    });

    return {
      devMode: false,
      orderId: order.id,
      paymentId: payment.id,
      redirectUrl: invoice.followUpLink,
      amount: Number(order.total),
    };
  }

  /**
   * Bonum webhook — x-checksum-v2 HMAC баталгаажуулаад invoiceId-аар Payment
   * олж, дүн таарвал эрх нээнэ. QPay-ийн handleWebhook-оос ТУСДАА (өөр checksum,
   * өөр body бүтэц). Fail-closed: checksum буруу бол 401.
   */
  async handleBonumWebhook(
    body: Record<string, unknown>,
    rawBody: string,
    checksum?: string,
  ) {
    // ── Fail-closed: тохируулаагүй эсвэл checksum буруу бол ТАТГАЛЗАНА ──
    if (!this.bonum.isConfigured()) {
      throw new UnauthorizedException('Bonum not configured');
    }
    if (!checksum || !this.bonum.verifyChecksum(rawBody, checksum)) {
      throw new UnauthorizedException('Invalid Bonum checksum');
    }

    const type = String(body.type ?? 'PAYMENT').toUpperCase();
    const inner = (body.body ?? body) as Record<string, unknown>;

    // ⚠️ CARD-TOKEN / SUBSCRIPTION webhook — DigitalGer-т карт хадгалах/
    // subscription БАЙХГҮЙ тул зүгээр хүлээж авч өнгөрнө (эрх нээхгүй).
    if (type === 'CARD-TOKEN' || type === 'SUBSCRIPTION-PAYMENT') {
      return { received: true, matched: false };
    }

    const invoiceId = String(inner.invoiceId ?? inner.invoice_id ?? '');
    if (!invoiceId) {
      this.logger.warn('Bonum webhook: invoiceId алга');
      return { received: true, matched: false };
    }

    const payment = await this.prisma.payment.findUnique({
      where: { bonumInvoiceId: invoiceId },
      include: { order: true },
    });
    if (!payment) {
      // Энэ систем дээр олдсонгүй — өөр систем (BestTV) руу дамжуулах цэг болж
      // болно; одоогоор зүгээр matched:false буцаана.
      return { received: true, matched: false };
    }
    if (payment.order.status !== OrderStatus.PENDING) {
      return { received: true, matched: true };
    }

    // ── Амжилттай эсэх + дүн таарах шалгалт (хуурамч эрх нээхгүй) ──
    const paid =
      String(inner.status ?? body.status ?? '').toUpperCase() === 'PAID' ||
      String(body.status ?? '').toUpperCase() === 'SUCCESS';
    const webhookAmount = Number(inner.amount ?? body.amount ?? 0);
    const amountOk =
      !webhookAmount || Math.round(webhookAmount) === Math.round(Number(payment.amount));

    if (paid && amountOk) {
      await this.completePayment(payment.orderId, payment.id, {
        provider: 'bonum',
        bonumInvoiceId: invoiceId,
        rawPayload: body,
      });
    } else if (!paid) {
      this.logger.warn(`Bonum webhook FAILED/UNPAID: invoice ${invoiceId}`);
      this.emitN8nPaymentFailed(payment.orderId, payment.id, 'BONUM_FAILED').catch(() => null);
    } else {
      this.logger.error(`Bonum webhook дүн зөрүү: invoice ${invoiceId}`);
    }
    return { received: true, matched: true };
  }

  /**
   * Bonum PENDING төлбөрийг invoice status API-аар шалгах (polling/reconcile).
   * ⚠️ Bonum баримт «production-д бүү түшиглэ» тул webhook үндсэн зам, энэ нөөц.
   */
  async checkBonumPayment(orderId: string, userId: string): Promise<boolean> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        payments: {
          where: { provider: 'bonum', status: PaymentStatus.PENDING },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!order) return false;
    if (order.status === OrderStatus.PAID) return true;
    const payment = order.payments[0];
    if (!payment?.bonumInvoiceId) return false;

    const status = await this.bonum.checkInvoice(payment.bonumInvoiceId);
    if (status === 'PAID') {
      await this.completePayment(order.id, payment.id, {
        provider: 'bonum',
        bonumInvoiceId: payment.bonumInvoiceId,
      });
      return true;
    }
    return false;
  }

  /**
   * PENDING захиалгуудыг QPay-аас шалгаж, БОДИТООР төлөгдсөнийг автомат confirm
   * хийнэ. Webhook найдваргүй (QPay заримдаа илгээдэггүй/timing) тул энэ нь
   * найдвартай fallback — хэрэглэгч төлсөн ч webhook ирээгүй захиалга энд
   * баригдаж бараа авна. Cron-аас дуудагдана.
   * @returns confirm хийсэн захиалгын тоо
   */
  async reconcilePendingPayments(maxAgeHours = 2): Promise<number> {
    const since = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let confirmed = 0;

    // ── QPay PENDING шалгах ──
    if (this.isQPayConfigured()) {
      const pending = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.PENDING,
          createdAt: { gte: since },
          payments: { some: { qpayPaymentId: { not: null } } },
        },
        include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      // Шалгах PENDING байхгүй бол QPay-руу ОГТ хүсэлт явуулахгүй.
      for (const order of pending) {
        const payment = order.payments[0];
        if (!payment?.qpayPaymentId) continue;
        try {
          const isPaid = await this.verifyPaymentWithQpay(payment.qpayPaymentId);
          if (isPaid) {
            await this.completePayment(order.id, payment.id, {
              qpayPaymentId: payment.qpayPaymentId,
            });
            confirmed++;
            this.logger.log(`Reconcile QPay: order ${order.id} → PAID`);
          }
        } catch (err) {
          this.logger.error(`Reconcile QPay алдаа order ${order.id}`, err);
        }
      }
    }

    // ── Bonum (карт/WeChat) PENDING шалгах — webhook алдагдвал нөөц ──
    if (this.bonum.isConfigured()) {
      const bonumPending = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.PENDING,
          createdAt: { gte: since },
          payments: { some: { provider: 'bonum', bonumInvoiceId: { not: null } } },
        },
        include: {
          payments: {
            where: { provider: 'bonum' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      for (const order of bonumPending) {
        const payment = order.payments[0];
        if (!payment?.bonumInvoiceId) continue;
        try {
          const status = await this.bonum.checkInvoice(payment.bonumInvoiceId);
          if (status === 'PAID') {
            await this.completePayment(order.id, payment.id, {
              provider: 'bonum',
              bonumInvoiceId: payment.bonumInvoiceId,
            });
            confirmed++;
            this.logger.log(`Reconcile Bonum: order ${order.id} → PAID`);
          }
        } catch (err) {
          this.logger.error(`Reconcile Bonum алдаа order ${order.id}`, err);
        }
      }
    }

    if (confirmed > 0) {
      this.logger.log(`Reconcile: нийт ${confirmed} захиалга confirm хийв`);
    }
    return confirmed;
  }

  async checkPayment(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.PAID) return { paid: true, orderId };

    const payment = order.payments[0];
    if (!payment?.qpayPaymentId) return { paid: false, orderId };

    if (!this.isQPayConfigured()) return { paid: false, orderId };

    const isPaid = await this.verifyPaymentWithQpay(payment.qpayPaymentId);
    if (isPaid) {
      await this.completePayment(order.id, payment.id, {
        qpayPaymentId: payment.qpayPaymentId,
      });
      return { paid: true, orderId };
    }
    return { paid: false, orderId };
  }

  /**
   * QPay-ийн /v2/payment/check API руу ШУУД залгаж тухайн invoice БОДИТООР
   * төлөгдсөн эсэхийг сервер талаас баталгаажуулна. Webhook болон checkPayment
   * хоёул үүнийг ашиглана — webhook-ийн body-д хэзээ ч итгэлгүй, QPay-аас өөрөөс
   * нь баталгаа авна (хуурамч "PAID" webhook ажиллахгүй болно).
   */
  private async verifyPaymentWithQpay(qpayPaymentId: string): Promise<boolean> {
    if (!this.isQPayConfigured()) return false;
    try {
      const checkBody = JSON.stringify({
        object_type: 'INVOICE',
        object_id: qpayPaymentId,
        offset: { page_number: 1, page_limit: 100 },
      });
      const callCheck = async (token: string) =>
        fetch('https://merchant.qpay.mn/v2/payment/check', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: checkBody,
        });
      // Token cache хүчингүй (401/403) бол шинээр авч дахин шалгана — эс бол
      // БОДИТООР ТӨЛСӨН хэрэглэгч "хүлээгдэж байна" дээр гацна.
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
      this.logger.error('QPay payment verify failed', err);
      return false;
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = this.config.get<string>('qpay.webhookSecret');
    if (!secret) {
      return this.config.get<string>('nodeEnv') === 'development';
    }

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

  async handleWebhook(body: Record<string, unknown>, rawBody: string, signature?: string) {
    // Secret тохируулсан (production) үед signature ЗААВАЛ ирж, таарах ёстой.
    // (Доорх QPay API давхар шалгалт нь үндсэн хамгаалалт — энэ нэмэлт давхарга.)
    const webhookSecret = this.config.get<string>('qpay.webhookSecret');
    if (webhookSecret) {
      if (!signature || !this.verifyWebhookSignature(rawBody, signature)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    } else if (signature && !this.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const paymentId =
      (body.payment_id as string) ??
      (body.qpay_payment_id as string) ??
      (body.invoice_id as string);

    const senderInvoiceNo =
      (body.sender_invoice_no as string) ?? (body.senderInvoiceNo as string);

    if (!paymentId && !senderInvoiceNo) {
      throw new BadRequestException('Invalid webhook payload');
    }

    const payment = await this.prisma.payment.findFirst({
      where: paymentId
        ? { qpayPaymentId: paymentId }
        : { order: { qpayIdentifier: senderInvoiceNo } },
      include: { order: true },
    });

    if (!payment) {
      this.logger.warn('Webhook payment not found');
      return { received: true, matched: false };
    }

    // ⚠️ АЮУЛГҮЙ БАЙДАЛ: webhook body-д ХЭЗЭЭ Ч итгэхгүй. Хэн ч энэ нээлттэй
    // хаяг руу хуурамч {"payment_status":"PAID"} илгээж болно. Тиймээс body-д
    // "PAID" байгаа эсэхээс ҮЛ ХАМААРАН, QPay-ийн /v2/payment/check API-аар
    // тухайн invoice БОДИТООР төлөгдсөн эсэхийг QPay-аас өөрөөс нь баталгаажуулна.
    // QPay "PAID" гэж буцаасан тохиолдолд Л захиалгыг confirm хийнэ.
    if (payment.order.status !== OrderStatus.PENDING) {
      return { received: true, matched: true };
    }

    // QPay-аас баталгаажуулна (dev mode-д isQPayConfigured=false → шалгахгүй).
    const qpayInvoiceId = payment.qpayPaymentId ?? paymentId;
    const verifiedPaid = this.isQPayConfigured()
      ? (qpayInvoiceId ? await this.verifyPaymentWithQpay(qpayInvoiceId) : false)
      : false;

    if (verifiedPaid) {
      await this.completePayment(payment.orderId, payment.id, {
        qpayPaymentId: qpayInvoiceId,
        rawPayload: body,
      });
    } else {
      // QPay баталгаажуулаагүй — хуурамч webhook эсвэл амжилтгүй төлбөр.
      this.logger.warn(`Webhook QPay-аар баталгаажсангүй: order ${payment.orderId}`);
      const reason = (body.payment_status as string) ?? 'NOT_VERIFIED';
      this.emitN8nPaymentFailed(payment.orderId, payment.id, reason).catch(() => null);
    }

    return { received: true, matched: true };
  }

  private async completePayment(
    orderId: string,
    paymentId: string,
    meta: {
      qpayPaymentId?: string;
      provider?: string;
      bonumInvoiceId?: string;
      rawPayload?: unknown;
      devMode?: boolean;
    },
  ) {
    // ⚠️ IDEMPOTENT GUARD: захиалга аль хэдийн PAID бол дахин confirm хийхгүй
    // (n8n/Telegram/email давхар илгээхээс сэргийлнэ). Хэд хэдэн зам (webhook +
    // reconcile + polling) нэгэн зэрэг ажиллаж болзошгүй тул заавал шалгана.
    // updateMany нь where: status=PENDING нөхцөл хангагдсан үед Л PAID болгоно —
    // count=0 буцвал өөр зам аль хэдийн confirm хийсэн тул энд зогсоно.
    // ── Хандалтын хугацаа (access expiry) ──
    // Захиалгад буй бүтээгдэхүүний accessType-аас хамаарч expiresAt тооцно.
    // Бүгд LIFETIME → null (насан туршийн). Аль нэг DAYS бол MAX(accessDays).
    const paidAt = new Date();
    const orderItems = await this.prisma.orderItem.findMany({
      where: { orderId },
      select: { product: { select: { accessType: true, accessDays: true } } },
    });
    const expiresAt = computeOrderExpiresAt(
      orderItems.map((i) => i.product),
      paidAt,
    );

    const claimed = await this.prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING },
      data: {
        status: OrderStatus.PAID,
        paidAt,
        expiresAt,
        ...(meta.qpayPaymentId && { qpayIdentifier: meta.qpayPaymentId }),
      },
    });
    if (claimed.count === 0) {
      // Өөр зам аль хэдийн confirm хийсэн — давхар email/telegram явуулахгүй.
      return;
    }

    const paymentData: {
      status: PaymentStatus;
      qpayPaymentId?: string;
      provider?: string;
      rawPayload?: object;
    } = { status: PaymentStatus.SUCCESS };

    if (meta.qpayPaymentId) {
      paymentData.qpayPaymentId = meta.qpayPaymentId;
    }
    if (meta.provider) {
      paymentData.provider = meta.provider;
    }
    if (meta.rawPayload) {
      paymentData.rawPayload = meta.rawPayload as object;
    }

    // Order-ийг дээр updateMany-аар PAID болгосон тул энд зөвхөн Payment SUCCESS.
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: paymentData,
    });

    // Захиалга PAID болсон тул худалдан авагчийн User.lastOrderAt-г шинэчилнэ
    // (маркетингийн сегмент/re-engagement). Fire-and-forget — төлбөрт саад болохгүй.
    this.prisma.order
      .findUnique({ where: { id: orderId }, select: { userId: true } })
      .then((o) => {
        if (o?.userId) {
          // In-app мэдэгдэл (navbar 🔔) — fire-and-forget. Зочин (guest)
          // хэрэглэгчид ч userId байгаа тул бичигдэнэ (login хийвэл харагдана).
          this.notifications
            .create(o.userId, {
              title: 'Захиалга амжилттай',
              body: 'Таны төлбөр баталгаажлаа. Худалдан авсан бүтээгдэхүүнээ "Миний сан"-аас үзнэ үү.',
              type: 'order',
              link: '/library',
            })
            .catch(() => null);
          return this.prisma.user.update({
            where: { id: o.userId },
            data: { lastOrderAt: new Date() },
          });
        }
      })
      .catch(() => null);

    // n8n-рүү event илгээх (non-blocking). Энэ нь claimed.count>0 (анх удаа
    // confirm) үед Л дуудагдана — давхар Telegram/email явахгүй.
    this.emitN8nPaymentPaid(orderId, paymentId).catch((err) =>
      this.logger.error('n8n emit алдаа', err),
    );
  }

  private async emitN8nPaymentPaid(orderId: string, paymentId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, title: true, price: true } } } },
      },
    });
    if (!order) return;

    await this.n8n.emitPaymentPaid({
      orderId: order.id,
      paymentId,
      userId: order.userId,
      userName: order.user?.name ?? null,
      userEmail: order.user?.email ?? '',
      amount: Number(order.total),
      products: order.items.map((i) => ({
        id: i.product.id,
        title: i.product.title,
        price: Number(i.product.price),
      })),
      paidAt: new Date().toISOString(),
    });
  }

  async emitN8nPaymentFailed(orderId: string, paymentId: string, reason: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!order) return;

    await this.n8n.emitPaymentFailed({
      orderId: order.id,
      paymentId,
      userId: order.userId,
      userName: order.user?.name ?? null,
      userEmail: order.user?.email ?? '',
      amount: Number(order.total),
      reason,
      failedAt: new Date().toISOString(),
    });
  }

  private async getQPayToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const qpay = this.config.get('qpay');
    const credentials = Buffer.from(`${qpay.username}:${qpay.password}`).toString(
      'base64',
    );

    const response = await fetch('https://merchant.qpay.mn/v2/auth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to authenticate with QPay');
    }

    const data = (await response.json()) as QPayTokenResponse;

    // ⚠️ КРИТИК bug засвар: QPay-ийн expires_in нь "хэдэн секундын дараа" БИШ,
    // харин Unix TIMESTAMP (epoch секунд, жиш 1781784158) буцаадаг. Хуучин код
    // `Date.now() + expires_in*1000` гэж бодсон тул cache 50,000 жил хүчинтэй
    // болж, QPay талд token бодитоор дуусахад (≈24ц) хүчингүй token-оор invoice
    // дуудсаар "NO_CREDENTIALS — Хандах эрхгүй" гарч ХЭРЭГЛЭГЧ ТӨЛЖ ЧАДАХГҮЙ байв.
    // Засвар: expires_in timestamp мөн эсэхийг танин зөв expiry тооцно.
    const now = Date.now();
    const raw = Number(data.expires_in) || 0;
    let expiresAtMs: number;
    if (raw > 1_000_000_000 && raw < 100_000_000_000) {
      // 10 оронтой = Unix timestamp (секунд) → ms болгож, 60с буфер хасна
      expiresAtMs = raw * 1000 - 60_000;
    } else if (raw > 0) {
      // Энгийн "хэдэн секундын дараа" (хэрэв QPay өөрчилбөл)
      expiresAtMs = now + (raw - 60) * 1000;
    } else {
      // Утга байхгүй/буруу → аюулгүй талд 1 цаг cache (дараа дахин авна)
      expiresAtMs = now + 60 * 60 * 1000;
    }
    // ⚠️ Хэт хол ирээдүй (буруу) бол дээд хязгаар 12 цаг тавина (QPay token
    // ихэвчлэн ≤24ц — хэзээ ч дуусдаггүй cache үүсгэхгүй).
    const MAX = now + 12 * 60 * 60 * 1000;
    if (expiresAtMs > MAX || expiresAtMs <= now) expiresAtMs = MAX;

    this.tokenCache = { token: data.access_token, expiresAt: expiresAtMs };
    return data.access_token;
  }
}
