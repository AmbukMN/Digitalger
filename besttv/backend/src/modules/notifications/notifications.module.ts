import { Module } from '@nestjs/common';
import { Controller, Get, Injectable, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/**
 * Badge-тэй хэсгүүд.
 * ⚠️ Шинэ хэсэг нэмэхэд ЭНД + `counts()`-д хоёуланд нь нэмнэ.
 */
export const SECTIONS = [
  'users', // Шинэ бүртгүүлсэн хэрэглэгч
  'payments', // Шинэ төлбөр (төлөгдсөн)
  'payments-failed', // Амжилтгүй төлбөр — АНХААРАЛ шаардана
  'reviews', // Шинэ сэтгэгдэл
  'chat', // Уншаагүй чат
  'subscribers', // Мэдээллийн товхимолд шинээр бүртгүүлсэн
  'email-issues', // Bounce/complaint — SES нэр хүндэд аюултай
  'rentals', // Шинэ түрээс
] as const;

export type Section = (typeof SECTIONS)[number];

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Хэсэг бүрийн "уншаагүй" тоо.
   *
   * ⚠️ Анх орох үед (AdminSeen бичлэггүй) суурь нь ОДОО — хуучин бүх дата
   * badge болж спам гаргахгүй. Зөвхөн ЭНЭ цэгээс хойшхи шинэ бичлэг тоологдоно.
   */
  async counts(adminId: string) {
    const seens = await this.prisma.adminSeen.findMany({
      where: { adminId, section: { in: [...SECTIONS] } },
      select: { section: true, lastSeenAt: true },
    });
    const seenMap = new Map(seens.map((s) => [s.section, s.lastSeenAt]));
    const fallback = new Date();
    const since = (s: Section) => seenMap.get(s) ?? fallback;

    // ⚠️ Анх удаа орж байгаа админд бүх section-ы суурийг ОДОО болгож
    // тэмдэглэнэ — эс бөгөөс хуудас сэргээх бүрд fallback шинэчлэгдэж
    // "шинэ" тоо хэзээ ч гарахгүй.
    if (seens.length === 0) {
      await this.prisma.adminSeen
        .createMany({
          data: SECTIONS.map((section) => ({ adminId, section, lastSeenAt: fallback })),
          skipDuplicates: true,
        })
        .catch(() => null);
    }

    const [users, payments, paymentsFailed, reviews, chat, subscribers, emailIssues, rentals] =
      await Promise.all([
        this.prisma.user.count({
          where: { createdAt: { gt: since('users') }, role: Role.USER },
        }),
        this.prisma.payment.count({
          where: { status: PaymentStatus.PAID, paidAt: { gt: since('payments') } },
        }),
        this.prisma.payment.count({
          where: { status: PaymentStatus.FAILED, createdAt: { gt: since('payments-failed') } },
        }),
        this.prisma.review.count({ where: { createdAt: { gt: since('reviews') } } }),
        // Чат — хэрэглэгчээс ирсэн (админ өөрөө бичсэнийг тоохгүй)
        this.prisma.chatMessage
          .count({ where: { createdAt: { gt: since('chat') }, role: 'user' } })
          .catch(() => 0),
        this.prisma.subscriber.count({ where: { createdAt: { gt: since('subscribers') } } }),
        this.prisma.emailSuppression.count({
          where: { createdAt: { gt: since('email-issues') } },
        }),
        this.prisma.rental.count({ where: { createdAt: { gt: since('rentals') } } }),
      ]);

    return {
      users,
      payments,
      'payments-failed': paymentsFailed,
      reviews,
      chat,
      subscribers,
      'email-issues': emailIssues,
      rentals,
    } as Record<Section, number>;
  }

  /**
   * Хэсэг бүрийн сүүлд харсан огноо.
   * ⚠️ Жагсаалтын мөрүүдэд "шинэ" тэмдэглэгээ тавихад — badge цэвэрлэгдсэн
   * ч тухайн үзэлтийн турш аль мөр шинэ болохыг харуулна.
   */
  async lastSeen(adminId: string) {
    const rows = await this.prisma.adminSeen.findMany({
      where: { adminId },
      select: { section: true, lastSeenAt: true },
    });
    return Object.fromEntries(rows.map((r) => [r.section, r.lastSeenAt]));
  }

  /** Хэсгийг "харсан" гэж тэмдэглэнэ — badge цэвэрлэгдэнэ */
  async markSeen(adminId: string, section: string) {
    if (!SECTIONS.includes(section as Section)) return { ok: false };
    await this.prisma.adminSeen.upsert({
      where: { adminId_section: { adminId, section } },
      create: { adminId, section, lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    });
    return { ok: true };
  }

  /**
   * Мэдэгдлийн ЖАГСААЛТ (dropdown-д) — сүүлийн үйл явдлууд.
   * ⚠️ Уншаагүй эсэхийг `lastSeenAt`-тай харьцуулж тэмдэглэнэ.
   */
  async feed(adminId: string, limit = 20) {
    const seens = await this.prisma.adminSeen.findMany({
      where: { adminId },
      select: { section: true, lastSeenAt: true },
    });
    const seenMap = new Map(seens.map((s) => [s.section, s.lastSeenAt]));
    const isUnread = (section: Section, at: Date) => {
      const seen = seenMap.get(section);
      return seen ? at > seen : false;
    };

    const take = Math.min(30, limit);
    const [users, payments, reviews, rentals] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: Role.USER },
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, email: true, name: true, createdAt: true },
      }),
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.PAID },
        orderBy: { paidAt: 'desc' },
        take,
        select: {
          id: true,
          amount: true,
          paidAt: true,
          isWalletTopup: true,
          user: { select: { email: true, name: true } },
          plan: { select: { name: true } },
        },
      }),
      this.prisma.review.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          rating: true,
          createdAt: true,
          user: { select: { email: true, name: true } },
          title: { select: { title: true, slug: true } },
        },
      }),
      this.prisma.rental.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          amount: true,
          createdAt: true,
          user: { select: { email: true, name: true } },
          title: { select: { title: true } },
        },
      }),
    ]);

    const items = [
      ...users.map((u) => ({
        id: `user-${u.id}`,
        section: 'users' as Section,
        title: 'Шинэ хэрэглэгч',
        detail: u.name ?? u.email,
        at: u.createdAt,
        href: '/users',
        unread: isUnread('users', u.createdAt),
      })),
      ...payments
        .filter((p) => p.paidAt)
        .map((p) => ({
          id: `pay-${p.id}`,
          section: 'payments' as Section,
          title: p.isWalletTopup ? 'Хэтэвч цэнэглэлт' : `Багц: ${p.plan?.name ?? '—'}`,
          detail: `${(p.user.name ?? p.user.email).slice(0, 28)} · ${p.amount.toLocaleString()}₮`,
          at: p.paidAt!,
          href: '/payments',
          unread: isUnread('payments', p.paidAt!),
        })),
      ...reviews.map((r) => ({
        id: `rev-${r.id}`,
        section: 'reviews' as Section,
        title: `Сэтгэгдэл ${r.rating}★`,
        detail: `${r.title.title} — ${r.user.name ?? r.user.email}`,
        at: r.createdAt,
        href: '/reviews',
        unread: isUnread('reviews', r.createdAt),
      })),
      ...rentals.map((r) => ({
        id: `rent-${r.id}`,
        section: 'rentals' as Section,
        title: 'Кино түрээслэв',
        detail: `${r.title.title} · ${r.amount.toLocaleString()}₮`,
        at: r.createdAt,
        href: '/payments',
        unread: isUnread('rentals', r.createdAt),
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, limit);

    return { items, unreadTotal: items.filter((i) => i.unread).length };
  }
}

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  /** Sidebar badge-ийн тоонууд */
  @Get('badges')
  badges(@CurrentUser() me: JwtPayload) {
    return this.svc.counts(me.sub);
  }

  /** Мэдэгдлийн dropdown жагсаалт */
  @Get('feed')
  feed(@CurrentUser() me: JwtPayload, @Query('limit') limit?: number) {
    return this.svc.feed(me.sub, Number(limit) || 20);
  }

  /** Хэсэг бүрийн сүүлд харсан огноо — мөрийн "шинэ" тэмдэглэгээнд */
  @Get('last-seen')
  lastSeen(@CurrentUser() me: JwtPayload) {
    return this.svc.lastSeen(me.sub);
  }

  /** Хэсгийг харсан гэж тэмдэглэх */
  @Post('seen/:section')
  seen(@CurrentUser() me: JwtPayload, @Param('section') section: string) {
    return this.svc.markSeen(me.sub, section);
  }
}

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
