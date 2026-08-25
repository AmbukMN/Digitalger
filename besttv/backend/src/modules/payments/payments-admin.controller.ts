import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Prisma, PaymentStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ubRangeFilter } from '../../common/ub-date';

type SortField = 'createdAt' | 'amount' | 'paidAt';

/**
 * Админ — төлбөрийн жагсаалт.
 *
 * ⚠️ Энгийн "бүгдийг харуул" биш — бодит ажилд ХЭРЭГТЭЙ шүүлтүүд: хайлт
 * (хэрэглэгч/имэйл/QPay дугаар), огнооны муж, дүнгийн муж, төрөл (багц/хэтэвч),
 * эрэмбэ, CSV export, нийлбэр статистик.
 */
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PaymentsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  /** Шүүлтийн нөхцөлийг НЭГ цэгээс — жагсаалт, тоолол, export бүгд ижил */
  private buildWhere(q: {
    status?: string;
    search?: string;
    from?: string;
    to?: string;
    minAmount?: number;
    maxAmount?: number;
    kind?: string;
    planId?: string;
    /** Төлбөрийн арга — QPAY | CARD | BANK | WALLET | ALL */
    provider?: string;
  }): Prisma.PaymentWhereInput {
    const where: Prisma.PaymentWhereInput = {};

    if (q.status && q.status !== 'ALL') {
      where.status = q.status as PaymentStatus;
    }

    // Хэрэглэгчийн нэр/имэйл, QPay нэхэмжлэл, эсвэл төлбөрийн ID-аар
    const term = q.search?.trim();
    if (term) {
      where.OR = [
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { user: { name: { contains: term, mode: 'insensitive' } } },
        { qpayInvoiceId: { contains: term, mode: 'insensitive' } },
        /* ⚠️ Картын гүйлгээг ч дугаараар нь хайж олох боломжтой байх */
        { bonumInvoiceId: { contains: term, mode: 'insensitive' } },
        { bankReference: { contains: term, mode: 'insensitive' } },
        { id: term },
      ];
    }

    /**
     * ⚠️ ТӨЛБӨРИЙН АРГААР шүүх (QPAY | CARD | BANK | WALLET).
     * Админ «картаар хэдэн төлбөр орсон бэ» гэдгийг шууд харна.
     */
    if (q.provider && q.provider !== 'ALL') {
      if (q.provider === 'QPAY') where.qpayInvoiceId = { not: null };
      else if (q.provider === 'CARD') where.bonumInvoiceId = { not: null };
      else if (q.provider === 'BANK') where.bankReference = { not: null };
      else if (q.provider === 'WALLET') {
        where.qpayInvoiceId = null;
        where.bonumInvoiceId = null;
        where.bankReference = null;
      }
    }

    // ⚠️ `to` нь тухайн ӨДРИЙГ БҮТНЭЭР хамруулна (23:59:59) — эс бөгөөс
    // "өнөөдөр" гэж сонгоход өнөөдрийн гүйлгээ харагдахгүй
    /**
     * ⚠️⚠️ UB ӨДРИЙН ХИЛЭЭР шүүнэ (`ubRangeFilter`).
     *
     * Өмнө нь ХОЛИМОГ байв: `gte` нь ISO мөрийг UTC шөнө дунд гэж
     * уншдаг (= UB 08:00), харин `lte` нь `setHours` тул локал (TZ)
     * цагаар ажилладаг. Хоёр өөр цагийн бүсээр шүүж, өдрийн хил
     * 8 цагаар зөрдөг байлаа.
     */
    const dateRange = ubRangeFilter(q.from, q.to);
    if (dateRange) where.createdAt = dateRange;

    if (q.minAmount != null || q.maxAmount != null) {
      const range: Prisma.IntFilter = {};
      if (q.minAmount != null) range.gte = Number(q.minAmount);
      if (q.maxAmount != null) range.lte = Number(q.maxAmount);
      where.amount = range;
    }

    /**
     * ⚠️⚠️ ТӨРЛИЙН ШҮҮЛТ — ГУРВАН БИЕ ДААСАН ТӨРӨЛ.
     *
     * Өмнө нь `plan` нь `isWalletTopup = false` л шалгадаг байсан тул
     * ШИРХЭГЭЭР ТҮРЭЭСЛЭСЭН гүйлгээ ч «Багц» шүүлтэд ОРДОГ байв —
     * админ багцын борлуулалтыг тусад нь харах боломжгүй.
     *
     * · topup  — хэтэвч цэнэглэлт
     * · rental — ширхэгээр түрээс (`rentalTitleId` байна)
     * · plan   — багц (топап ч биш, түрээс ч биш)
     */
    if (q.kind === 'topup') where.isWalletTopup = true;
    else if (q.kind === 'rental') where.rentalTitleId = { not: null };
    else if (q.kind === 'plan') {
      where.isWalletTopup = false;
      where.rentalTitleId = null;
    }

    if (q.planId) where.planId = q.planId;

    return where;
  }

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('minAmount') minAmount?: number,
    @Query('maxAmount') maxAmount?: number,
    @Query('kind') kind?: string,
    @Query('planId') planId?: string,
    @Query('provider') provider?: string,
    @Query('sort') sort?: SortField,
    @Query('dir') dir?: 'asc' | 'desc',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const take = Math.min(200, Number(limit) || 20);
    const where = this.buildWhere({
      status, search, from, to, minAmount, maxAmount, kind, planId, provider,
    });

    const orderBy = { [sort ?? 'createdAt']: dir ?? 'desc' } as Prisma.PaymentOrderByWithRelationInput;

    const [items, total, agg, paidAgg, topupAgg] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy,
        skip: (p - 1) * take,
        take,
        select: {
          id: true,
          amount: true,
          status: true,
          isWalletTopup: true,
          couponCode: true,
          originalAmount: true,
          qpayInvoiceId: true,
          /* ⚠️ Аль аргаар төлсөн — админ ялгаж харах ёстой
             (тохируулга, буцаалт, тайлан бүгд үүнээс хамаарна) */
          bonumInvoiceId: true,
          bankReference: true,
          paidAt: true,
          createdAt: true,
          user: { select: { id: true, email: true, name: true } },
          plan: { select: { id: true, name: true } },
          /**
           * ⚠️⚠️ ШИРХЭГЭЭР ТҮРЭЭСЛЭСЭН КИНОНЫ НЭР.
           *
           * Түрээсийн төлбөрт `planId` NULL тул админ жагсаалтад
           * «—» гэж хоосон гардаг байв — ЯМАР кино түрээслүүлснийг
           * админ огт мэдэхгүй (гомдол шийдэх, тайлан гаргахад
           * зайлшгүй).
           *
           * ⚠️ `slug` ч авна — админ шууд киноруу шилжиж чадна.
           */
          rentalTitle: { select: { id: true, title: true, slug: true } },
        },
      }),
      this.prisma.payment.count({ where }),
      // Шүүсэн БҮХ мөрийн нийлбэр (зөвхөн энэ хуудас биш)
      this.prisma.payment.aggregate({ where, _sum: { amount: true } }),
      /**
       * ⚠️⚠️ БОДИТ ОРЛОГО — ТОПАП ХАСНА.
       *
       * Хэтэвч цэнэглэлт → дараа багц авбал хоёулаа PAID болж давхар
       * тоологдоно. Орлого = зөвхөн багц/кино/түрээс. Тиймээс энд
       * `isWalletTopup=false`. Хэрэглэгч тусгайлан `kind=topup` шүүвэл
       * тэр шүүлт `where`-д орсон тул топап харагдана (доор `topupAgg`).
       */
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.PAID, isWalletTopup: false },
        _sum: { amount: true },
        _count: true,
      }),
      /* Хэтэвч цэнэглэлт — тусад нь (толгойд мэдээлэл болгож) */
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.PAID, isWalletTopup: true },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    /**
     * ⚠️ ТӨЛБӨРИЙН АРГЫГ нэг л газраас тодорхойлно (UI badge).
     * Дараалал: данс → QPay → карт → хэтэвч.
     */
    const rows = items.map((it) => {
      const { qpayInvoiceId, bonumInvoiceId, bankReference, ...rest } = it;
      return {
        ...rest,
        qpayInvoiceId,
        provider: bankReference
          ? ('BANK' as const)
          : qpayInvoiceId
            ? ('QPAY' as const)
            : bonumInvoiceId
              ? ('CARD' as const)
              : ('WALLET' as const),
      };
    });

    return {
      items: rows,
      total,
      page: p,
      limit: take,
      totalPages: Math.ceil(total / take),
      /** Шүүлтэд тохирсон нийт дүн, төлөгдсөн дүн/тоо — толгойн статистикт */
      stats: {
        totalAmount: agg._sum.amount ?? 0,
        paidAmount: paidAgg._sum.amount ?? 0,
        paidCount: paidAgg._count,
        /* Хэтэвч цэнэглэлт — орлогод тоологдоогүй, тусад нь мэдээлэл */
        topupAmount: topupAgg._sum.amount ?? 0,
        topupCount: topupAgg._count,
      },
    };
  }

  /** Төлөв бүрийн тоо — табын badge-д (бусад шүүлтийг ХҮНДЭТГЭНЭ) */
  @Get('counts')
  async counts(
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('kind') kind?: string,
  ) {
    const base = this.buildWhere({ search, from, to, kind });
    const statuses: PaymentStatus[] = [
      PaymentStatus.PAID,
      PaymentStatus.PENDING,
      PaymentStatus.FAILED,
      PaymentStatus.EXPIRED,
    ];
    const [all, ...counts] = await Promise.all([
      this.prisma.payment.count({ where: base }),
      ...statuses.map((s) => this.prisma.payment.count({ where: { ...base, status: s } })),
    ]);
    return { ALL: all, ...Object.fromEntries(statuses.map((s, i) => [s, counts[i]])) };
  }

  /**
   * CSV export — шүүсэн БҮХ мөр (хуудаслалтгүй).
   * ⚠️ 50,000 мөрөөр хязгаарлана — санах ой хамгаална.
   */
  @Get('export')
  async exportCsv(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('minAmount') minAmount?: number,
    @Query('maxAmount') maxAmount?: number,
    @Query('kind') kind?: string,
  ) {
    const where = this.buildWhere({ status, search, from, to, minAmount, maxAmount, kind });
    const rows = await this.prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50_000,
      select: {
        id: true,
        amount: true,
        status: true,
        isWalletTopup: true,
        couponCode: true,
        qpayInvoiceId: true,
        paidAt: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
        plan: { select: { name: true } },
        /* ⚠️ Түрээсийн киноны нэр — жагсаалттай ижил (дээрх тайлбар) */
        rentalTitle: { select: { title: true } },
      },
    });

    const esc = (v: unknown) => {
      const str = v == null ? '' : String(v);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const header = [
      'ID',
      'Огноо',
      'Хэрэглэгч',
      'Имэйл',
      'Төрөл',
      'Багц',
      'Дүн',
      'Купон',
      'Төлөв',
      'Төлсөн огноо',
      'QPay ID',
    ];
    const lines = [
      header.join(','),
      ...rows.map((r) =>
        [
          r.id,
          r.createdAt.toISOString(),
          r.user?.name ?? '',
          r.user?.email ?? '',
          /**
           * ⚠️ ГУРВАН ТӨРӨЛ ЯЛГАНА — өмнө нь бүгд «Багц» гэж
           *    бичигддэг байсан тул тайланд түрээс ба цэнэглэлт
           *    ялгагдахгүй байв.
           */
          r.isWalletTopup ? 'Хэтэвч цэнэглэлт' : r.rentalTitle ? 'Түрээс' : 'Багц',
          /* ⚠️ Түрээс бол КИНОНЫ нэр, багц бол багцын нэр */
          r.rentalTitle?.title ?? r.plan?.name ?? '',
          r.amount,
          r.couponCode ?? '',
          r.status,
          r.paidAt?.toISOString() ?? '',
          r.qpayInvoiceId ?? '',
        ]
          .map(esc)
          .join(','),
      ),
    ];
    // ⚠️ BOM — Excel дээр кирилл үсэг зөв харагдана
    return { csv: '﻿' + lines.join('\n'), count: rows.length };
  }

  /**
   * Төлбөрийг ГАРААР баталгаажуулах (банкаар шилжүүлсэн гэх мэт).
   * ⚠️ Багц/хэтэвч АВТОМАТ идэвхжинэ + имэйл илгээгдэнэ.
   */
  @Post(':id/mark-paid')
  markPaid(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    return this.payments.adminMarkPaid(id, me.sub);
  }

  /**
   * Төлбөрийг цуцлах.
   * ⚠️ ТӨЛӨГДСӨН байсан бол олгогдсон ЭРХ ч хүчингүй болно.
   */
  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser() me: JwtPayload,
    @Body('reason') reason?: string,
  ) {
    return this.payments.adminCancel(id, me.sub, reason);
  }
}
