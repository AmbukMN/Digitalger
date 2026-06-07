import { OrderStatus, Prisma } from '@prisma/client';
import { CouponsService } from './coupons.service';

/**
 * CouponsService.validate() unit тест.
 * PrismaService-ийг бүрэн mock хийсэн — бодит DB ашиглахгүй.
 * Чухал: per-user 1x шалгалт зөвхөн PAID order-д л хүчинтэй (PENDING тооцохгүй).
 */
describe('CouponsService.validate', () => {
  let service: CouponsService;
  let prisma: {
    coupon: { findFirst: jest.Mock };
    order: { findFirst: jest.Mock };
  };

  // Туслах: coupon mock үүсгэнэ (Decimal талбаруудтай).
  const makeCoupon = (overrides: Partial<Record<string, any>> = {}) => ({
    id: 'cpn-1',
    code: 'SAVE10',
    type: 'PERCENT',
    value: new Prisma.Decimal(10),
    minPrice: null as Prisma.Decimal | null,
    maxUses: null as number | null,
    usedCount: 0,
    active: true,
    expiresAt: null as Date | null,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      coupon: { findFirst: jest.fn() },
      order: { findFirst: jest.fn() },
    };
    service = new CouponsService(prisma as any);
  });

  it('хүчинтэй PERCENT купон → valid:true, discount зөв', async () => {
    prisma.coupon.findFirst.mockResolvedValue(makeCoupon({ type: 'PERCENT', value: new Prisma.Decimal(10) }));
    prisma.order.findFirst.mockResolvedValue(null);

    const res = await service.validate('SAVE10', 1000);

    expect(res.valid).toBe(true);
    expect(res.discount).toBe(100); // 1000 * 10%
    expect(res.finalPrice).toBe(900);
    expect(res.type).toBe('PERCENT');
  });

  it('хүчинтэй FIXED купон → discount нь тогтмол дүн', async () => {
    prisma.coupon.findFirst.mockResolvedValue(
      makeCoupon({ type: 'FIXED', value: new Prisma.Decimal(300) }),
    );
    prisma.order.findFirst.mockResolvedValue(null);

    const res = await service.validate('SAVE300', 1000);

    expect(res.valid).toBe(true);
    expect(res.discount).toBe(300);
    expect(res.finalPrice).toBe(700);
  });

  it('FIXED купон үнээс их бол discount нь үнэ хүртэл л таслагдана (finalPrice 0)', async () => {
    prisma.coupon.findFirst.mockResolvedValue(
      makeCoupon({ type: 'FIXED', value: new Prisma.Decimal(5000) }),
    );
    prisma.order.findFirst.mockResolvedValue(null);

    const res = await service.validate('BIG', 1000);

    expect(res.valid).toBe(true);
    expect(res.discount).toBe(1000);
    expect(res.finalPrice).toBe(0);
  });

  it('код буруу (олдсонгүй) → valid:false', async () => {
    prisma.coupon.findFirst.mockResolvedValue(null);

    const res = await service.validate('NOPE', 1000);

    expect(res.valid).toBe(false);
    expect(res.message).toContain('буруу');
    expect(res.finalPrice).toBe(1000);
  });

  it('идэвхгүй купон → valid:false', async () => {
    prisma.coupon.findFirst.mockResolvedValue(makeCoupon({ active: false }));

    const res = await service.validate('SAVE10', 1000);

    expect(res.valid).toBe(false);
    expect(res.message).toContain('идэвхгүй');
  });

  it('хугацаа дууссан купон → valid:false, "хугацаа дууссан"', async () => {
    prisma.coupon.findFirst.mockResolvedValue(
      makeCoupon({ expiresAt: new Date('2000-01-01') }),
    );

    const res = await service.validate('SAVE10', 1000);

    expect(res.valid).toBe(false);
    expect(res.message).toContain('хугацаа дууссан');
  });

  it('ирээдүйн expiresAt → хүчинтэй хэвээр', async () => {
    prisma.coupon.findFirst.mockResolvedValue(
      makeCoupon({ expiresAt: new Date(Date.now() + 86400000) }),
    );
    prisma.order.findFirst.mockResolvedValue(null);

    const res = await service.validate('SAVE10', 1000);

    expect(res.valid).toBe(true);
  });

  it('maxUses хүрсэн (usedCount >= maxUses) → valid:false', async () => {
    prisma.coupon.findFirst.mockResolvedValue(
      makeCoupon({ maxUses: 5, usedCount: 5 }),
    );

    const res = await service.validate('SAVE10', 1000);

    expect(res.valid).toBe(false);
    expect(res.message).toContain('хязгаар');
  });

  it('minPrice хүрэхгүй → valid:false', async () => {
    prisma.coupon.findFirst.mockResolvedValue(
      makeCoupon({ minPrice: new Prisma.Decimal(2000) }),
    );

    const res = await service.validate('SAVE10', 1000);

    expect(res.valid).toBe(false);
    expect(res.message).toContain('дээш');
  });

  it('minPrice хангагдсан → valid:true', async () => {
    prisma.coupon.findFirst.mockResolvedValue(
      makeCoupon({ minPrice: new Prisma.Decimal(500) }),
    );
    prisma.order.findFirst.mockResolvedValue(null);

    const res = await service.validate('SAVE10', 1000);

    expect(res.valid).toBe(true);
  });

  it('per-user 1x: PAID order-д аль хэдийн ашигласан → valid:false', async () => {
    prisma.coupon.findFirst.mockResolvedValue(makeCoupon());
    // userId өгсөн үед PAID order олдвол хэрэглэсэн гэж үзнэ
    prisma.order.findFirst.mockResolvedValue({ id: 'order-paid-1' });

    const res = await service.validate('SAVE10', 1000, 'user-1');

    expect(res.valid).toBe(false);
    expect(res.message).toContain('аль хэдийн ашигласан');
    // зөвхөн PAID статусыг шалгаж байгааг батал
    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', status: OrderStatus.PAID }),
      }),
    );
  });

  it('per-user 1x: PENDING order тооцохгүй (PAID олдохгүй) → valid:true', async () => {
    prisma.coupon.findFirst.mockResolvedValue(makeCoupon());
    // PAID order олдсонгүй (findFirst нь PAID-аар л хайдаг — PENDING-ийг тооцохгүй)
    prisma.order.findFirst.mockResolvedValue(null);

    const res = await service.validate('SAVE10', 1000, 'user-1');

    expect(res.valid).toBe(true);
    expect(res.discount).toBe(100);
  });

  it('userId өгөөгүй бол per-user шалгалт ажиллахгүй (order.findFirst дуудагдахгүй)', async () => {
    prisma.coupon.findFirst.mockResolvedValue(makeCoupon());

    const res = await service.validate('SAVE10', 1000);

    expect(res.valid).toBe(true);
    expect(prisma.order.findFirst).not.toHaveBeenCalled();
  });

  it('код нь trim + uppercase болгож normalize хийгдэнэ', async () => {
    prisma.coupon.findFirst.mockResolvedValue(makeCoupon());
    prisma.order.findFirst.mockResolvedValue(null);

    await service.validate('  save10  ', 1000);

    expect(prisma.coupon.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ code: 'SAVE10' }) }),
    );
  });
});
