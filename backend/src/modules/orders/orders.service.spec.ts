import { OrderStatus, Prisma } from '@prisma/client';
import { OrdersService } from './orders.service';

/**
 * OrdersService.createPending() unit тест.
 * PrismaService + StorageService + EmailService бүгдийг mock хийсэн.
 * Шалгах гол логик: total тооцоо, coupon discount, duplicate guard, isFree→PAID.
 */
describe('OrdersService.createPending', () => {
  let service: OrdersService;
  let prisma: any;
  let storage: any;
  let email: any;

  const makeProduct = (id: string, price: number) => ({
    id,
    price: new Prisma.Decimal(price),
    published: true,
    title: `Product ${id}`,
    slug: id,
  });

  beforeEach(() => {
    prisma = {
      product: { findMany: jest.fn() },
      order: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
      coupon: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      user: { update: jest.fn(), findUnique: jest.fn() },
    };
    storage = { getAssetUrl: jest.fn() };
    email = {
      sendOrderConfirmation: jest.fn().mockResolvedValue(undefined),
      sendPaymentConfirmation: jest.fn().mockResolvedValue(undefined),
    };
    service = new OrdersService(prisma as any, storage as any, email as any);

    // default: duplicate guard-д PENDING олдохгүй
    prisma.order.findFirst.mockResolvedValue(null);
    // default: аль хэдийн PAID эзэмшсэн бүтээгдэхүүн байхгүй
    prisma.order.findMany.mockResolvedValue([]);
    prisma.user.update.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({ email: 'u@test.mn', name: 'Test' });
    prisma.coupon.update.mockResolvedValue({});
    prisma.coupon.updateMany.mockResolvedValue({ count: 1 });
  });

  it('купонгүй: total нь бүтээгдэхүүний нийлбэр, status PENDING', async () => {
    prisma.product.findMany.mockResolvedValue([
      makeProduct('p1', 1000),
      makeProduct('p2', 500),
    ]);
    prisma.order.create.mockImplementation(async ({ data }: any) => ({
      id: 'order-1',
      ...data,
      items: [],
    }));

    const order: any = await service.createPending('user-1', {
      productIds: ['p1', 'p2'],
    } as any);

    const createArg = prisma.order.create.mock.calls[0][0];
    expect(Number(createArg.data.total)).toBe(1500);
    expect(createArg.data.status).toBe(OrderStatus.PENDING);
    expect(order.id).toBe('order-1');
  });

  it('боломжгүй (published биш / олдохгүй) бүтээгдэхүүн → BadRequestException', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct('p1', 1000)]); // 1 буцаасан

    await expect(
      service.createPending('user-1', { productIds: ['p1', 'p2'] } as any),
    ).rejects.toThrow('One or more products are unavailable');
  });

  it('аль хэдийн PAID (идэвхтэй) эзэмшсэн бүтээгдэхүүн → BadRequestException', async () => {
    // p1-ийг идэвхтэй (expiresAt null = насан туршийн) эзэмшсэн
    prisma.order.findMany.mockResolvedValue([
      { expiresAt: null, items: [{ productId: 'p1' }] },
    ]);

    await expect(
      service.createPending('user-1', { productIds: ['p1'] } as any),
    ).rejects.toThrow('аль хэдийн худалдаж авсан');
    // эзэмшсэн тул бүтээгдэхүүн query, order create огт дуудагдахгүй
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('cart-д хэсэгчилсэн эзэмшил → зөвхөн ШИНЭ бүтээгдэхүүнийг үлдээнэ', async () => {
    // p1 идэвхтэй эзэмшсэн, p2 шинэ
    prisma.order.findMany.mockResolvedValue([
      { expiresAt: null, items: [{ productId: 'p1' }] },
    ]);
    prisma.product.findMany.mockResolvedValue([makeProduct('p2', 500)]);
    prisma.order.create.mockImplementation(async ({ data }: any) => ({
      id: 'order-x', ...data, items: [],
    }));

    await service.createPending('user-1', { productIds: ['p1', 'p2'] } as any);

    // product query зөвхөн p2-оор хийгдэх ёстой (p1 хасагдсан)
    const prodWhere = prisma.product.findMany.mock.calls[0][0].where;
    expect(prodWhere.id.in).toEqual(['p2']);
    // order зөвхөн p2-той үүснэ
    const createArg = prisma.order.create.mock.calls[0][0];
    expect(createArg.data.items.create).toHaveLength(1);
    expect(createArg.data.items.create[0].productId).toBe('p2');
  });

  it('хугацаа ДУУССАН (expired) эрхийг дахин худалдаж авч болно', async () => {
    // p1-ийг өмнө авсан ч expiresAt өнгөрсөн → дахин авах боломжтой
    prisma.order.findMany.mockResolvedValue([
      { expiresAt: new Date('2020-01-01'), items: [{ productId: 'p1' }] },
    ]);
    prisma.product.findMany.mockResolvedValue([makeProduct('p1', 1000)]);
    prisma.order.create.mockImplementation(async ({ data }: any) => ({
      id: 'order-y', ...data, items: [],
    }));

    const order: any = await service.createPending('user-1', {
      productIds: ['p1'],
    } as any);
    expect(order.id).toBe('order-y'); // блоклогдоогүй
  });

  it('PERCENT coupon → discount тооцож total-аас хасна', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct('p1', 1000)]);
    prisma.coupon.findFirst.mockResolvedValue({
      id: 'c1',
      code: 'SAVE10',
      type: 'PERCENT',
      value: new Prisma.Decimal(10),
      minPrice: null,
      maxUses: null,
      usedCount: 0,
      active: true,
      expiresAt: null,
    });
    // per-user check (order.findFirst) — эхний дуудалт duplicate guard (null),
    // дараагийнх per-user PAID check (null = ашиглаагүй)
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.order.create.mockImplementation(async ({ data }: any) => ({
      id: 'order-2',
      ...data,
      items: [],
    }));

    await service.createPending('user-1', {
      productIds: ['p1'],
      couponCodes: ['SAVE10'],
    } as any);

    const createArg = prisma.order.create.mock.calls[0][0];
    expect(Number(createArg.data.total)).toBe(900); // 1000 - 10%
    expect(createArg.data.couponCode).toBe('SAVE10');
  });

  it('FIXED coupon нийт үнээс их → total 0 болж isFree→PAID', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct('p1', 1000)]);
    prisma.coupon.findFirst.mockResolvedValue({
      id: 'c2',
      code: 'FREE',
      type: 'FIXED',
      value: new Prisma.Decimal(5000),
      minPrice: null,
      maxUses: null,
      usedCount: 0,
      active: true,
      expiresAt: null,
    });
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.order.create.mockImplementation(async ({ data }: any) => ({
      id: 'order-3',
      ...data,
      items: [{ price: new Prisma.Decimal(1000), product: { title: 'Product p1' } }],
      couponCode: data.couponCode,
      total: data.total,
    }));

    const order: any = await service.createPending('user-1', {
      productIds: ['p1'],
      couponCodes: ['FREE'],
    } as any);

    const createArg = prisma.order.create.mock.calls[0][0];
    expect(Number(createArg.data.total)).toBe(0);
    // total 0 → шууд PAID
    expect(createArg.data.status).toBe(OrderStatus.PAID);
    expect(order.id).toBe('order-3');
  });

  it('per-user аль хэдийн ашигласан (PAID) coupon → discount хийхгүй (skip)', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct('p1', 1000)]);
    prisma.coupon.findFirst.mockResolvedValue({
      id: 'c3',
      code: 'USED',
      type: 'PERCENT',
      value: new Prisma.Decimal(50),
      minPrice: null,
      maxUses: null,
      usedCount: 0,
      active: true,
      expiresAt: null,
    });
    // 1-р дуудалт: duplicate guard → null
    // 2-р дуудалт: per-user PAID check → ашигласан order буцаана
    prisma.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'old-paid-order' });
    prisma.order.create.mockImplementation(async ({ data }: any) => ({
      id: 'order-4',
      ...data,
      items: [],
    }));

    await service.createPending('user-1', {
      productIds: ['p1'],
      couponCodes: ['USED'],
    } as any);

    const createArg = prisma.order.create.mock.calls[0][0];
    // купон skip болсон тул discount байхгүй → total = 1000
    expect(Number(createArg.data.total)).toBe(1000);
    expect(createArg.data.couponCode).toBeUndefined();
  });

  it('duplicate guard: ижил бүтээгдэхүүнтэй PENDING order байвал тэрийг буцаана (_reused)', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct('p1', 1000)]);
    prisma.order.findFirst.mockResolvedValue({
      id: 'existing-pending',
      status: OrderStatus.PENDING,
      items: [{ productId: 'p1', product: { id: 'p1', title: 'P', slug: 'p1' } }],
    });

    const order: any = await service.createPending('user-1', {
      productIds: ['p1'],
    } as any);

    expect(order.id).toBe('existing-pending');
    expect(order._reused).toBe(true);
    // шинэ order үүсгээгүй
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('isFree=true үед coupon usedCount increment хийгдэнэ', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct('p1', 1000)]);
    prisma.coupon.findFirst.mockResolvedValue({
      id: 'c5',
      code: 'FREE',
      type: 'FIXED',
      value: new Prisma.Decimal(1000),
      minPrice: null,
      maxUses: 10,
      usedCount: 0,
      active: true,
      expiresAt: null,
    });
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.order.create.mockImplementation(async ({ data }: any) => ({
      id: 'order-6',
      ...data,
      items: [{ price: new Prisma.Decimal(1000), product: { title: 'P' } }],
      couponCode: data.couponCode,
      total: data.total,
    }));

    await service.createPending('user-1', {
      productIds: ['p1'],
      couponCodes: ['FREE'],
    } as any);

    // maxUses != null тул conditional updateMany ашиглана
    expect(prisma.coupon.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'c5' }),
        data: { usedCount: { increment: 1 } },
      }),
    );
  });
});
