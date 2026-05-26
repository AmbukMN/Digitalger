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
  ) {}

  isQPayConfigured(): boolean {
    const qpay = this.config.get('qpay');
    return Boolean(qpay.username && qpay.password && qpay.invoiceCode);
  }

  async initiate(orderId: string, userId: string) {
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

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.total,
        status: PaymentStatus.PENDING,
      },
    });

    if (!this.isQPayConfigured()) {
      this.logger.warn('QPay not configured — auto-completing payment (dev mode)');
      await this.completePayment(order.id, payment.id, {
        devMode: true,
        qpayPaymentId: `dev-${payment.id}`,
      });

      return {
        devMode: true,
        orderId: order.id,
        paymentId: payment.id,
        status: PaymentStatus.SUCCESS,
        message: 'Payment auto-completed in development mode',
      };
    }

    const qpay = this.config.get('qpay');
    const token = await this.getQPayToken();
    const identifier = `DG-${order.id}`;

    const invoiceBody = {
      invoice_code: qpay.invoiceCode,
      sender_invoice_no: identifier,
      invoice_receiver_code: userId.slice(0, 20),
      invoice_description: `DigitalGer order ${order.id}`,
      amount: Number(order.total),
      callback_url: qpay.callbackUrl,
    };

    const response = await fetch('https://merchant.qpay.mn/v2/invoice', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoiceBody),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`QPay invoice failed: ${text}`);
      throw new BadRequestException('Failed to create QPay invoice');
    }

    const invoice = (await response.json()) as QPayInvoiceResponse;

    await this.prisma.order.update({
      where: { id: order.id },
      data: { qpayIdentifier: identifier },
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        qpayPaymentId: invoice.invoice_id,
        rawPayload: invoice as object,
      },
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

    try {
      const token = await this.getQPayToken();

      const res = await fetch('https://merchant.qpay.mn/v2/payment/check', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          object_type: 'INVOICE',
          object_id: payment.qpayPaymentId,
          offset: { page_number: 1, page_limit: 100 },
        }),
      });

      if (!res.ok) return { paid: false, orderId };

      const result = await res.json();
      const isPaid =
        result.count > 0 &&
        (result.rows ?? []).some(
          (r: any) =>
            r.payment_status === 'PAID' ||
            r.payment_status === 'paid',
        );

      if (isPaid) {
        await this.completePayment(order.id, payment.id, {
          qpayPaymentId: payment.qpayPaymentId,
        });
        return { paid: true, orderId };
      }
    } catch (err) {
      this.logger.error('Payment check failed', err);
    }

    return { paid: false, orderId };
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
    if (signature && !this.verifyWebhookSignature(rawBody, signature)) {
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

    const paymentStatus = (body.payment_status as string)?.toUpperCase();
    const isPaid =
      paymentStatus === 'PAID' ||
      body.payment_status === 'PAID' ||
      (body.count as number) > 0;

    if (isPaid && payment.order.status === OrderStatus.PENDING) {
      await this.completePayment(payment.orderId, payment.id, {
        qpayPaymentId: paymentId,
        rawPayload: body,
      });
    } else if (!isPaid && payment.order.status === OrderStatus.PENDING) {
      const reason = (body.payment_status as string) ?? 'UNKNOWN';
      this.emitN8nPaymentFailed(payment.orderId, payment.id, reason).catch(() => null);
    }

    return { received: true, matched: true };
  }

  private async completePayment(
    orderId: string,
    paymentId: string,
    meta: { qpayPaymentId?: string; rawPayload?: unknown; devMode?: boolean },
  ) {
    const paymentData: {
      status: PaymentStatus;
      qpayPaymentId?: string;
      rawPayload?: object;
    } = { status: PaymentStatus.SUCCESS };

    if (meta.qpayPaymentId) {
      paymentData.qpayPaymentId = meta.qpayPaymentId;
    }
    if (meta.rawPayload) {
      paymentData.rawPayload = meta.rawPayload as object;
    }

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: paymentId },
        data: paymentData,
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAID,
          ...(meta.qpayPaymentId && { qpayIdentifier: meta.qpayPaymentId }),
        },
      }),
    ]);

    // n8n-рүү event илгээх (non-blocking — backend-ийн үндсэн урсгалд нөлөөлөхгүй)
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
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };

    return data.access_token;
  }
}
