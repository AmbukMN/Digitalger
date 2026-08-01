import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Prisma, PaymentStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

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
        { id: term },
      ];
    }

    // ⚠️ `to` нь тухайн ӨДРИЙГ БҮТНЭЭР хамруулна (23:59:59) — эс бөгөөс
    // "өнөөдөр" гэж сонгоход өнөөдрийн гүйлгээ харагдахгүй
    if (q.from || q.to) {
      const range: Prisma.DateTimeFilter = {};
      if (q.from) range.gte = new Date(q.from);
      if (q.to) {
        const end = new Date(q.to);
        end.setHours(23, 59, 59, 999);
        range.lte = end;
      }
      where.createdAt = range;
    }

    if (q.minAmount != null || q.maxAmount != null) {
      const range: Prisma.IntFilter = {};
      if (q.minAmount != null) range.gte = Number(q.minAmount);
      if (q.maxAmount != null) range.lte = Number(q.maxAmount);
      where.amount = range;
    }

    // Төрөл — багц худалдан авалт эсвэл хэтэвч цэнэглэлт
    if (q.kind === 'topup') where.isWalletTopup = true;
    else if (q.kind === 'plan') where.isWalletTopup = false;

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
    @Query('sort') sort?: SortField,
    @Query('dir') dir?: 'asc' | 'desc',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const take = Math.min(200, Number(limit) || 20);
    const where = this.buildWhere({ status, search, from, to, minAmount, maxAmount, kind, planId });

    const orderBy = { [sort ?? 'createdAt']: dir ?? 'desc' } as Prisma.PaymentOrderByWithRelationInput;

    const [items, total, agg, paidAgg] = await Promise.all([
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
          paidAt: true,
          createdAt: true,
          user: { select: { id: true, email: true, name: true } },
          plan: { select: { id: true, name: true } },
        },
      }),
      this.prisma.payment.count({ where }),
      // Шүүсэн БҮХ мөрийн нийлбэр (зөвхөн энэ хуудас биш)
      this.prisma.payment.aggregate({ where, _sum: { amount: true } }),
      // Үүнээс БОДИТ орлого (төлөгдсөн нь)
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.PAID },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      items,
      total,
      page: p,
      limit: take,
      totalPages: Math.ceil(total / take),
      /** Шүүлтэд тохирсон нийт дүн, төлөгдсөн дүн/тоо — толгойн статистикт */
      stats: {
        totalAmount: agg._sum.amount ?? 0,
        paidAmount: paidAgg._sum.amount ?? 0,
        paidCount: paidAgg._count,
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
          r.isWalletTopup ? 'Хэтэвч цэнэглэлт' : 'Багц',
          r.plan?.name ?? '',
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
