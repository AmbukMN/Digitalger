import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

/**
 * PaymentsService unit тест (QPay verify / reconcile — fetch mock).
 * PrismaService + ConfigService + N8nService бүгдийг mock хийсэн.
 * Гол логик: reconcilePendingPayments, checkPayment, completePayment idempotent guard.
 */
describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;
  let config: any;
  let n8n: any;

  const qpayConfig = {
    username: 'u',
    password: 'p',
    invoiceCode: 'INV',
    callbackUrl: 'https://cb',
    webhookSecret: 'secret',
  };

  beforeEach(() => {
    prisma = {
      order: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      payment: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      orderItem: { findMany: jest.fn() },
      user: { update: jest.fn() },
    };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'qpay') return qpayConfig;
        if (key === 'qpay.webhookSecret') return qpayConfig.webhookSecret;
        if (key === 'nodeEnv') return 'production';
        return undefined;
      }),
    };
    n8n = {
      emitPaymentPaid: jest.fn().mockResolvedValue(undefined),
      emitPaymentFailed: jest.fn().mockResolvedValue(undefined),
    };
    service = new PaymentsService(prisma as any, config as any, n8n as any);

    prisma.order.findUnique.mockResolvedValue({ userId: 'user-1' });
    prisma.user.update.mockResolvedValue({});
    prisma.payment.update.mockResolvedValue({});
    // completePayment нь expiresAt тооцоход orderItem.findMany дуудна (default: хоосон)
    prisma.orderItem.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isQPayConfigured', () => {
    it('бүх credential байвал true', () => {
      expect(service.isQPayConfigured()).toBe(true);
    });

    it('credential дутвал false', () => {
      config.get.mockImplementation((key: string) =>
        key === 'qpay' ? { username: '', password: '', invoiceCode: '' } : undefined,
      );
      expect(service.isQPayConfigured()).toBe(false);
    });
  });

  describe('reconcilePendingPayments', () => {
    it('QPay тохируулаагүй бол 0 буцаана (хайхгүй)', async () => {
      config.get.mockImplementation((key: string) =>
        key === 'qpay' ? { username: '', password: '', invoiceCode: '' } : undefined,
      );

      const result = await service.reconcilePendingPayments();

      expect(result).toBe(0);
      expect(prisma.order.findMany).not.toHaveBeenCalled();
    });

    it('PENDING захиалга байхгүй бол QPay-руу хүсэлт явуулахгүй, 0 буцаана', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      const result = await service.reconcilePendingPayments();

      expect(result).toBe(0);
    });

    it('QPay-аар PAID баталгаажвал захиалгыг confirm хийж тоог буцаана', async () => {
      prisma.order.findMany.mockResolvedValue([
        { id: 'o1', payments: [{ id: 'pay-1', qpayPaymentId: 'qp-1' }] },
      ]);
      // verifyPaymentWithQpay → fetch PAID
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ count: 1, rows: [{ payment_status: 'PAID' }] }),
      });
      // token авах + payment/check 2 fetch — token-ийн хариуг эхэнд тавина
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'tok', expires_in: 3600 }),
        })
        .mockImplementation(fetchMock);
      // completePayment → updateMany claimed
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'user-1',
        total: 1000,
        user: { id: 'user-1', name: 'T', email: 't@test.mn' },
        items: [],
      });

      const result = await service.reconcilePendingPayments();

      expect(result).toBe(1);
      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'o1', status: OrderStatus.PENDING },
          data: expect.objectContaining({ status: OrderStatus.PAID }),
        }),
      );
    });

    it('QPay-аар төлөгдөөгүй бол confirm хийхгүй (0)', async () => {
      prisma.order.findMany.mockResolvedValue([
        { id: 'o2', payments: [{ id: 'pay-2', qpayPaymentId: 'qp-2' }] },
      ]);
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'tok', expires_in: 3600 }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ count: 0, rows: [] }),
        });

      const result = await service.reconcilePendingPayments();

      expect(result).toBe(0);
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('checkPayment', () => {
    it('захиалга олдохгүй → NotFoundException', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(service.checkPayment('o-x', 'user-1')).rejects.toThrow('Order not found');
    });

    it('захиалга аль хэдийн PAID → paid:true (QPay шалгахгүй)', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'o3',
        status: OrderStatus.PAID,
        payments: [],
      });

      const res = await service.checkPayment('o3', 'user-1');

      expect(res).toEqual({ paid: true, orderId: 'o3' });
    });

    it('payment-д qpayPaymentId байхгүй → paid:false', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'o4',
        status: OrderStatus.PENDING,
        payments: [{ id: 'p', qpayPaymentId: null }],
      });

      const res = await service.checkPayment('o4', 'user-1');

      expect(res).toEqual({ paid: false, orderId: 'o4' });
    });
  });

  describe('verifyWebhookSignature', () => {
    it('зөв HMAC sha256 signature → true', () => {
      const { createHmac } = require('crypto');
      const payload = '{"a":1}';
      const sig = createHmac('sha256', qpayConfig.webhookSecret).update(payload).digest('hex');

      expect(service.verifyWebhookSignature(payload, sig)).toBe(true);
    });

    it('буруу signature → false', () => {
      expect(service.verifyWebhookSignature('{"a":1}', 'deadbeef')).toBe(false);
    });
  });
});
