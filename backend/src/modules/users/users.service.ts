import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { computeOrderExpiresAt } from '../../common/access-expiry';
import type { Resource } from '../../common/permission';

// Granular permission олгох боломжтой resource-ууд (permission.ts Resource-тэй ижил).
const ALLOWED_RESOURCES: readonly Resource[] = [
  'products', 'categories', 'product-types', 'blog', 'banners',
  'testimonials', 'faqs', 'coupons', 'pages', 'menu', 'orders', 'reviews',
] as const;

type StaffPermissionInput = {
  resource: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

const BCRYPT_ROUNDS = 12;

const USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  name: true,
  image: true,
  role: true,
  isGuest: true,
  blocked: true,
  oauthProvider: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  // Аккаунтын өөрчлөлтийн түүх бичих (email/phone/name/password/role/blocked).
  // Fire-and-forget — лог бичилт амжилтгүй болсон ч үндсэн үйлдэлд саад болохгүй.
  private async writeAudit(entries: {
    userId: string;
    field: string;
    oldValue?: string | null;
    newValue?: string | null;
    actor: 'self' | 'admin';
    actorId?: string;
  }[]) {
    const data = entries.filter((e) => e.oldValue !== e.newValue);
    if (!data.length) return;
    this.prisma.userAuditLog
      .createMany({ data })
      .catch(() => {});
  }

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(
    userId: string,
    dto: { name?: string; image?: string; phone?: string; email?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // ⚠️ ИМЭЙЛ ЭНД СОЛИХГҮЙ. Имэйл солих нь зөвхөн OTP баталгаажуулалтаар
    // явдаг: POST /auth/request-email-change → confirm-email-change.
    // (Өмнө энд имэйлийг verify-гүй шууд хадгалдаг буг байсан.)
    if (dto.email !== undefined && dto.email !== '' &&
        dto.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new BadRequestException(
        'Имэйл солихын тулд баталгаажуулалт шаардлагатай (request-email-change)',
      );
    }

    // Normalize empty string phone to null
    const phone = dto.phone === '' ? null : dto.phone;

    // Phone uniqueness check (утас verify шаарддаггүй — шууд солино)
    if (phone) {
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Phone already in use');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name || null }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.phone !== undefined && { phone }),
        // email-ийг ЗОРИУДААР оруулахгүй — verify flow-р л солино
      },
      select: USER_SELECT,
    });

    // Өөрчлөлтийн түүх (хэрэглэгч өөрөө)
    const audits: Parameters<typeof this.writeAudit>[0] = [];
    if (dto.name !== undefined)
      audits.push({ userId, field: 'name', oldValue: user.name, newValue: dto.name || null, actor: 'self' });
    if (dto.phone !== undefined)
      audits.push({ userId, field: 'phone', oldValue: user.phone, newValue: phone, actor: 'self' });
    await this.writeAudit(audits);

    return updated;
  }

  async updatePassword(
    userId: string,
    dto: { email?: string; currentPassword?: string; newPassword: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.isGuest) {
      // Guest → нууц үг хадгалаад, имэйлийг pendingEmail-д тавина.
      // ⚠️ User.email-ийг ЭНД СОЛИХГҮЙ — frontend дараа нь
      // request-email-change/confirm-email-change-ээр имэйлийг баталгаажуулна.
      if (!dto.email) throw new BadRequestException('И-мэйл шаардлагатай');
      const normalizedEmail = dto.email.toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing && existing.id !== userId) throw new ConflictException('Энэ и-мэйл аль хэдийн бүртгэлтэй байна');
      const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
      return this.prisma.user.update({
        where: { id: userId },
        // email хэвээр (guest_xxx@...), зөвхөн нууц үг + pendingEmail хадгална.
        // Имэйл баталгаажихад confirmEmailChange нь email солих + isGuest:false болгоно.
        data: { passwordHash, pendingEmail: normalizedEmail },
        select: USER_SELECT,
      });
    }

    if (user.oauthProvider) {
      throw new BadRequestException('OAuth бүртгэлд нууц үг тохируулах боломжгүй');
    }

    // Regular user → change password
    if (!dto.currentPassword) throw new BadRequestException('Одоогийн нууц үг шаардлагатай');
    if (!user.passwordHash) throw new BadRequestException('Нууц үг тохируулагдаагүй байна');
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Одоогийн нууц үг буруу байна');
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    const result = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: USER_SELECT,
    });
    await this.writeAudit([
      { userId, field: 'password', oldValue: null, newValue: 'Шинэчилсэн', actor: 'self' },
    ]);
    return result;
  }

  async findAllAdmin(query: { page?: number; pageSize?: number; search?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    // ⚠️ "Хэрэглэгч" жагсаалт = frontend хэрэглэгч (role=USER). Багийн админ
    // (EDITOR/ADMIN/SUPERADMIN) энд ОРОХГҮЙ — тэд "Багийн админ" хэсэгт удирдагдана.
    // ГЭХДЭЭ: admin panel-аас үүсгэсэн админ хэдий ч frontend-ээс ЖИНХЭНЭ ИДЭВХ
    // хийсэн бол → тэр нэгэн зэрэг хэрэглэгч ч мөн тул энэ жагсаалтад ОРНО.
    // Frontend идэвхийн НАЙДВАРТАЙ дохио (admin panel login энд тоологдохгүй,
    // учир нь frontend ба admin login backend дээр ИЖИЛ /auth/login → lastLoginAt
    // ялгахгүй тул БҮҮ ашигла):
    //   • oauthProvider != null — Google-ээр frontend-ээс нэвтэрсэн
    //   • orders source='PURCHASE' — ЖИНХЭНЭ худалдан авалт (ADMIN_GRANT хасна)
    //   • productEvents — бараа үзсэн
    //   • pageViews — хуудас үзсэн
    //   • searchEvents — хайлт хийсэн
    //   • downloadLogs — файл татсан
    // Зөвхөн admin panel-д ажилладаг (frontend идэвхгүй) админ → ОРОХГҮЙ.
    // createStaff нь oauthProvider/идэвх тавьдаггүй тул шинэ цэвэр админ энд гарахгүй.
    const searchWhere: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const where: Prisma.UserWhereInput = {
      AND: [
        searchWhere,
        {
          OR: [
            { role: 'USER' },
            { orders: { some: { source: 'PURCHASE' } } },
            { oauthProvider: { not: null } },
            { productEvents: { some: {} } },
            { pageViews: { some: {} } },
            { searchEvents: { some: {} } },
            { downloadLogs: { some: {} } },
          ],
        },
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          phone: true,
          name: true,
          role: true,
          image: true,
          isGuest: true,
          blocked: true,
          oauthProvider: true,
          createdAt: true,
          // downloads (file-level) + downloadLogs (бодит татах түүх) хоёуланг.
          _count: { select: { orders: true, downloads: true, downloadLogs: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOneAdmin(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_SELECT,
        _count: { select: { orders: true, reviews: true, downloads: true, downloadLogs: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Админ панелийн хэрэглэгчийн ДЭЛГЭРЭНГҮЙ popup-д шаардлагатай БҮХ датаг
   * нэг дуудлагаар нэгтгэж буцаана:
   * - Үндсэн профайл (email/phone/name/role/verify/oauth/огноо)
   * - Захиалга бүгд (PENDING/PAID/CANCELLED... + items + product нэр + paidAt)
   * - Татсан файлууд (хэзээ, ямар файл, аль бүтээгдэхүүн)
   * - Үзсэн бүтээгдэхүүн / дарсан линк (ProductEvent, userId-аар)
   * - Төхөөрөмжийн хуваарилалт (PageView/ProductEvent.device)
   * - Аккаунтын өөрчлөлтийн түүх (UserAuditLog)
   */
  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        image: true,
        role: true,
        isGuest: true,
        blocked: true,
        oauthProvider: true,
        emailVerified: true,
        pendingEmail: true,
        phoneVerified: true,
        pendingPhone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [orders, downloadsRaw, productEvents, auditLogs, searchEventsRaw, pageViewsRaw, chatConvsRaw, emailLogsRaw, emailOpensRaw, smsSessionsRaw] = await Promise.all([
      // Захиалга бүгд (статусаар) + items + product
      this.prisma.order.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          total: true,
          currency: true,
          status: true,
          source: true,
          couponCode: true,
          createdAt: true,
          updatedAt: true,
          items: {
            select: {
              id: true,
              price: true,
              product: { select: { id: true, title: true, slug: true } },
            },
          },
          payments: {
            select: { status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      // Татсан файлууд (хэзээ) — DownloadLog-оос (бодит татах түүх).
      // ⚠️ Download (fileId) хүснэгт биш DownloadLog ашиглана: зарим бүтээгдэхүүн
      // ProductFile-гүй, зөвхөн downloadFileKey (бэлэн zip)-тэй тул Download-д
      // юу ч бичигдэхгүй. DownloadLog нь productId/source-тэй, paid/free/bundle
      // бүх татаалтыг бүртгэдэг тул хэрэглэгчийн "Татсан" түүхэнд бүрэн эх сурвалж.
      this.prisma.downloadLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, productId: true, fileName: true, source: true, createdAt: true },
        take: 200,
      }),
      // Үзсэн / дарсан (ProductEvent userId-аар)
      this.prisma.productEvent.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          productId: true,
          productSlug: true,
          device: true,
          createdAt: true,
        },
        take: 300,
      }),
      // Аккаунтын өөрчлөлтийн түүх + нэвтрэлт (login/register/guest/oauth)
      this.prisma.userAuditLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          field: true,
          oldValue: true,
          newValue: true,
          actor: true,
          createdAt: true,
        },
        take: 100,
      }),
      // Хайлтын түүх
      this.prisma.searchEvent.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, query: true, results: true, createdAt: true },
        take: 100,
      }),
      // Хуудас үзэлт (хандсан хуудас)
      this.prisma.pageView.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, path: true, device: true, referrer: true, createdAt: true },
        take: 100,
      }),
      // Чатбот харилцаа (web/FB/IG) — userId-аар холбогдсон (backfill хийгдсэн) —
      // сүүлийн N мессеж бүр харилцаанд. admin popup-д харах.
      this.prisma.chatConversation.findMany({
        where: { userId: id },
        orderBy: { lastMessageAt: 'desc' },
        take: 20,
        select: {
          id: true,
          channel: true,
          sessionId: true,
          userName: true,
          lastMessageAt: true,
          createdAt: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: { id: true, role: true, text: true, createdAt: true },
          },
        },
      }),
      // Тухайн хэрэглэгч рүү явуулсан имэйлийн түүх (EmailLog) — to=user.email.
      // @@index([to, createdAt]) бэлэн тул хурдан татна. Кирилл/латин том/жижиг
      // үсэг ялгахгүйгээр (insensitive) тааруулна.
      this.prisma.emailLog.findMany({
        where: { to: { equals: user.email, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          subject: true,
          campaign: true,
          status: true,
          createdAt: true,
          deliveredAt: true,
          bouncedAt: true,
        },
      }),
      // Имэйл нээлт (EmailOpen) — campaign-аар нь нээсэн эсэхийг тааруулна.
      this.prisma.emailOpen.findMany({
        where: { email: { equals: user.email, mode: 'insensitive' } },
        select: { campaign: true, openedAt: true },
      }),
      // Утас баталгаажуулалтын түүх (verify.mn) — PhoneVerifySession.
      // status: pending | verified | expired. Сүүлийн 50 оролдлого.
      this.prisma.phoneVerifySession.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          phone: true,
          status: true,
          createdAt: true,
          verifiedAt: true,
          expiresAt: true,
        },
      }),
    ]);

    // ─── SMS / утас баталгаажуулалтын түүх (verify.mn) ──────────────────────
    const smsHistory = smsSessionsRaw.map((s) => ({
      id: s.id,
      phone: s.phone,
      status: s.status,
      createdAt: s.createdAt,
      verifiedAt: s.verifiedAt,
      expiresAt: s.expiresAt,
    }));

    // ─── Имэйл түүх (EmailLog + EmailOpen) ──────────────────────────────────
    // Нээлтийг campaign-аар тааруулна: тухайн campaign-д ямар нэг EmailOpen
    // байвал opened=true. Нарийн (имэйл бүрээр) нээлт боломжгүй тул campaign
    // түвшинд тооцоолно. campaign=null (гүйлгээний имэйл) → нээлт хэмжихгүй.
    const openedCampaigns = new Set(
      emailOpensRaw.map((o) => o.campaign).filter(Boolean) as string[],
    );
    const emailHistory = emailLogsRaw.map((e) => ({
      id: e.id,
      subject: e.subject,
      campaign: e.campaign,
      status: e.status,
      createdAt: e.createdAt,
      deliveredAt: e.deliveredAt,
      bouncedAt: e.bouncedAt,
      opened: e.campaign ? openedCampaigns.has(e.campaign) : false,
    }));

    // Татсан түүх — DownloadLog.productId → Product (нэр/slug) resolve.
    const dlProductIds = [...new Set(downloadsRaw.map((d) => d.productId).filter(Boolean) as string[])];
    const dlProducts = dlProductIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: dlProductIds } },
          select: { id: true, title: true, slug: true },
        })
      : [];
    const dlProdMap = new Map(dlProducts.map((p) => [p.id, p]));
    const downloads = downloadsRaw.map((d) => {
      const p = d.productId ? dlProdMap.get(d.productId) : null;
      return {
        id: d.id,
        // fileName байхгүй бол product нэрийг ашиглана (бэлэн zip татсан тохиолдол).
        fileName: d.fileName ?? (p?.title ? `${p.title} (бүх файл)` : '(файл)'),
        productTitle: p?.title ?? null,
        productSlug: p?.slug ?? null,
        source: d.source, // paid | free | bundle
        createdAt: d.createdAt,
      };
    });

    // Үзсэн / дарсан-ийг ялгах + бүтээгдэхүүний нэр resolve
    const evProductIds = [...new Set(productEvents.map((e) => e.productId))];
    const evProducts = evProductIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: evProductIds } },
          select: { id: true, title: true, slug: true },
        })
      : [];
    const prodMap = new Map(evProducts.map((p) => [p.id, p]));
    const mapEvent = (e: (typeof productEvents)[number]) => ({
      id: e.id,
      productId: e.productId,
      productTitle: prodMap.get(e.productId)?.title ?? e.productSlug,
      productSlug: e.productSlug,
      device: e.device,
      createdAt: e.createdAt,
    });
    const viewedProducts = productEvents.filter((e) => e.type === 'view').map(mapEvent);
    const clickedLinks = productEvents.filter((e) => e.type === 'click').map(mapEvent);
    const cartedProducts = productEvents.filter((e) => e.type === 'cart').map(mapEvent);
    const purchasedEvents = productEvents.filter((e) => e.type === 'purchase').map(mapEvent);

    // Хайлт/хуудас — pageViews/searchEvents-ийг шууд хэлбэржүүлнэ
    const searchHistory = searchEventsRaw.map((s) => ({
      id: s.id,
      query: s.query,
      results: s.results,
      createdAt: s.createdAt,
    }));
    const pageViews = pageViewsRaw.map((p) => ({
      id: p.id,
      path: p.path,
      device: p.device,
      referrer: p.referrer,
      createdAt: p.createdAt,
    }));

    // Төхөөрөмжийн хуваарилалт (ProductEvent.device-аас)
    const deviceCounts: Record<string, number> = {};
    for (const e of productEvents) {
      if (e.device) deviceCounts[e.device] = (deviceCounts[e.device] ?? 0) + 1;
    }
    const devices = Object.entries(deviceCounts)
      .map(([device, count]) => ({ device, count }))
      .sort((a, b) => b.count - a.count);

    // Захиалгын статусын тойм
    const statusSummary = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {});

    // ─── Чатбот харилцаа (admin popup-д харах) ──────────────────────────────
    const chatConversations = chatConvsRaw.map((c) => ({
      id: c.id,
      channel: c.channel,
      sessionId: c.sessionId,
      userName: c.userName,
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
      // Мессежийг хуучин→шинэ дараалалд буцаана (харилцаа уншихад тохиромжтой)
      messages: [...c.messages].reverse().map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        createdAt: m.createdAt,
      })),
    }));
    const chatMessagesTotal = chatConversations.reduce((s, c) => s + c.messages.length, 0);

    // ─── LTV (Lifetime Value) — зөвхөн PAID захиалгаар тооцно ────────────────
    const paidOrdersList = orders.filter((o) => o.status === 'PAID');
    const ltvTotal = paidOrdersList.reduce((s, o) => s + Number(o.total), 0);
    const paidCount = paidOrdersList.length;
    const avgOrderValue = paidCount ? ltvTotal / paidCount : 0;
    // PAID захиалгууд createdAt буурахаар эрэмбэлэгдсэн (дээд findMany orderBy) —
    // эхний/сүүлийн худалдан авалт.
    const firstPurchaseAt = paidCount ? paidOrdersList[paidCount - 1].createdAt : null;
    const lastPurchaseAt = paidCount ? paidOrdersList[0].createdAt : null;
    const ltv = {
      total: ltvTotal, // нийт зарцуулсан (MNT)
      paidOrders: paidCount,
      avgOrderValue, // дундаж захиалгын дүн
      firstPurchaseAt,
      lastPurchaseAt,
    };

    // ─── Сонирхлын profile — top categories / top viewed products ──────────
    // Хэрэглэгчийн үзсэн (ProductEvent view) + авсан (PAID OrderItem) бүтээгдэхүүний
    // КАТЕГОРИ-оор эрэмбэлж, хамгийн их сонирхдог чиглэлийг гаргана.
    const purchasedProductIds = new Set(
      paidOrdersList.flatMap((o) => o.items.map((it) => it.product.id)),
    );
    // Сонирхол тооцоход хамаарах бүх productId (үзсэн + авсан).
    const interestProductIds = [
      ...new Set([
        ...productEvents.map((e) => e.productId),
        ...purchasedProductIds,
      ]),
    ];

    // Бүтээгдэхүүн → категори (categoryId + categoryIds) resolve.
    const interestProducts = interestProductIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: interestProductIds } },
          select: { id: true, title: true, slug: true, categoryId: true, categoryIds: true },
        })
      : [];
    const ipMap = new Map(interestProducts.map((p) => [p.id, p]));

    // Тухайн productId-ийн бүх категори (categoryId + categoryIds давхцалгүй).
    const categoriesOf = (pid: string): string[] => {
      const p = ipMap.get(pid);
      if (!p) return [];
      const set = new Set<string>();
      if (p.categoryId) set.add(p.categoryId);
      for (const cid of p.categoryIds ?? []) set.add(cid);
      return [...set];
    };

    // Категори бүрд жин: үзэлт=1, худалдан авалт=3 (авсан нь илүү хүчтэй дохио).
    const catScore: Record<string, number> = {};
    const viewedProductIds = productEvents.filter((e) => e.type === 'view').map((e) => e.productId);
    for (const pid of viewedProductIds) {
      for (const cid of categoriesOf(pid)) catScore[cid] = (catScore[cid] ?? 0) + 1;
    }
    for (const pid of purchasedProductIds) {
      for (const cid of categoriesOf(pid)) catScore[cid] = (catScore[cid] ?? 0) + 3;
    }
    const catIds = Object.keys(catScore);
    const cats = catIds.length
      ? await this.prisma.category.findMany({
          where: { id: { in: catIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const catMap = new Map(cats.map((c) => [c.id, c]));
    const topCategories = catIds
      .map((cid) => ({
        id: cid,
        name: catMap.get(cid)?.name ?? '(устсан ангилал)',
        slug: catMap.get(cid)?.slug ?? null,
        score: catScore[cid],
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // Top viewed products — үзэлтийн тоогоор эрэмбэлсэн (хамгийн их сонирхсон).
    const viewCountByProduct: Record<string, number> = {};
    for (const pid of viewedProductIds) {
      viewCountByProduct[pid] = (viewCountByProduct[pid] ?? 0) + 1;
    }
    const topViewedProducts = Object.entries(viewCountByProduct)
      .map(([pid, views]) => ({
        productId: pid,
        title: ipMap.get(pid)?.title ?? prodMap.get(pid)?.title ?? pid,
        slug: ipMap.get(pid)?.slug ?? prodMap.get(pid)?.slug ?? null,
        views,
        purchased: purchasedProductIds.has(pid),
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const interest = { topCategories, topViewedProducts };

    // ─── Chat → conversion ─────────────────────────────────────────────────
    // Хэрэглэгч чат хийсэн БА худалдан авсан эсэх. chatedAfter — чат харилцааны
    // дараа худалдан авалт хийсэн эсэх (хамгийн эртний чатаас хойш PAID байгаа эсэх).
    const hasChatted = chatConversations.length > 0;
    const hasPurchased = paidCount > 0;
    const earliestChatAt = hasChatted
      ? chatConversations.reduce<Date>(
          (min, c) => (c.createdAt < min ? c.createdAt : min),
          chatConversations[0].createdAt,
        )
      : null;
    const purchasedAfterChat =
      hasChatted && earliestChatAt
        ? paidOrdersList.some((o) => o.createdAt >= earliestChatAt)
        : false;
    const chatConversion = {
      hasChatted,
      hasPurchased,
      // Чат хийсэн хэрэглэгч худалдан авсан эсэх (энгийн conversion флаг)
      converted: hasChatted && hasPurchased,
      // Чат эхэлсний дараа худалдан авсан эсэх (чат нөлөөлсөн байж болзошгүй)
      purchasedAfterChat,
      conversations: chatConversations.length,
      messages: chatMessagesTotal,
    };

    return {
      user,
      orders,
      downloads,
      viewedProducts,
      clickedLinks,
      cartedProducts,
      purchasedEvents,
      searchHistory,
      pageViews,
      devices,
      auditLogs,
      chatConversations,
      emailHistory,
      smsHistory,
      ltv,
      interest,
      chatConversion,
      summary: {
        ordersTotal: orders.length,
        statusSummary,
        downloadsTotal: downloads.length,
        viewsTotal: viewedProducts.length,
        clicksTotal: clickedLinks.length,
        cartsTotal: cartedProducts.length,
        searchesTotal: searchHistory.length,
        pageViewsTotal: pageViews.length,
        paidOrders: paidCount,
        pendingOrders: orders.filter((o) => o.status === 'PENDING').length,
        chatConversationsTotal: chatConversations.length,
        chatMessagesTotal,
        ltvTotal,
      },
    };
  }

  async updateByAdmin(
    id: string,
    dto: { name?: string; role?: string; image?: string; phone?: string; email?: string },
    adminId?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Утас давхцал шалгах (хоосон → null)
    const phone = dto.phone === '' ? null : dto.phone;
    if (phone) {
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (existing && existing.id !== id) {
        throw new ConflictException('Энэ утасны дугаар өөр хэрэглэгчид бүртгэлтэй байна');
      }
    }

    // Email давхцал шалгах. Админ нь verify-гүйгээр ШУУД солино
    // (зочин биш бол emailVerified=now, зочин бол хэвээр).
    let emailData: { email: string; emailVerified: Date; isGuest: false } | undefined;
    if (dto.email !== undefined && dto.email !== '' &&
        dto.email.toLowerCase() !== user.email.toLowerCase()) {
      const normalizedEmail = dto.email.toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing && existing.id !== id) {
        throw new ConflictException('Энэ имэйл өөр хэрэглэгчид бүртгэлтэй байна');
      }
      emailData = { email: normalizedEmail, emailVerified: new Date(), isGuest: false };
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.phone !== undefined && { phone }),
        ...(dto.role !== undefined && { role: dto.role as any }),
        ...(emailData ?? {}),
      },
      select: USER_SELECT,
    });

    // Админы хийсэн өөрчлөлтийн түүх
    const audits: Parameters<typeof this.writeAudit>[0] = [];
    if (dto.name !== undefined)
      audits.push({ userId: id, field: 'name', oldValue: user.name, newValue: dto.name ?? null, actor: 'admin', actorId: adminId });
    if (dto.phone !== undefined)
      audits.push({ userId: id, field: 'phone', oldValue: user.phone, newValue: phone ?? null, actor: 'admin', actorId: adminId });
    if (dto.role !== undefined)
      audits.push({ userId: id, field: 'role', oldValue: user.role, newValue: dto.role, actor: 'admin', actorId: adminId });
    if (emailData)
      audits.push({ userId: id, field: 'email', oldValue: user.email, newValue: emailData.email, actor: 'admin', actorId: adminId });
    await this.writeAudit(audits);

    return updated;
  }

  /** Админ хэрэглэгчийн нууц үгийг ШУУД тохируулна (одоогийн нууц үг шаардахгүй) */
  async setPasswordByAdmin(id: string, newPassword: string, adminId?: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.oauthProvider) {
      throw new BadRequestException('OAuth бүртгэлд нууц үг тохируулах боломжгүй');
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.writeAudit([
      { userId: id, field: 'password', oldValue: null, newValue: 'Админ шинэчилсэн', actor: 'admin', actorId: adminId },
    ]);
    return { success: true };
  }

  async blockUser(id: string, blocked: boolean, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') throw new ForbiddenException('Админ хэрэглэгчийг block хийх боломжгүй');
    if (id === adminId) throw new ForbiddenException('Өөрийгөө block хийх боломжгүй');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { blocked },
      select: USER_SELECT,
    });
    await this.writeAudit([
      {
        userId: id,
        field: 'blocked',
        oldValue: user.blocked ? 'true' : 'false',
        newValue: blocked ? 'true' : 'false',
        actor: 'admin',
        actorId: adminId,
      },
    ]);
    return updated;
  }

  async deleteUser(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') throw new ForbiddenException('Админ хэрэглэгчийг устгах боломжгүй');
    if (id === adminId) throw new ForbiddenException('Өөрийгөө устгах боломжгүй');

    // Хэрэглэгчтэй холбоотой БҮХ өгөгдлийг устгана.
    // orders/reviews/downloads/wishlists/notifications/accounts/sessions нь
    // schema-д onDelete:Cascade тул user.delete-д автоматаар устана.
    // ZipJob (FK relation-гүй) болон EmailOtp (email-ээр холбоотой) гар аргаар устгана.
    await this.prisma.$transaction([
      this.prisma.zipJob.deleteMany({ where: { userId: id } }),
      this.prisma.emailOtp.deleteMany({ where: { email: user.email } }),
      this.prisma.phoneVerifySession.deleteMany({ where: { userId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);

    // Frontend res.json() амжилттай parse хийхэд { success: true } буцаана
    // (өмнө void буцаадгаас 'Unexpected end of JSON input' алдаа гардаг байсан).
    return { success: true };
  }

  // ─── Admin: хэрэглэгчид бүтээгдэхүүн ҮНЭГҮЙ идэвхжүүлэх (grant) ──────────────
  // total=0, status=PAID, source=ADMIN_GRANT захиалга үүсгэнэ. Ингэснээр бүх
  // эзэмшлийн логик (татах/сургалт/Миний сан) яг худалдаж авсан мэт ажиллана.

  /** Хэрэглэгчид сонгосон бүтээгдэхүүнүүдийг үнэгүй идэвхжүүлнэ. Аль хэдийн
   * эзэмшсэн (худалдаж авсан эсвэл grant) бүтээгдэхүүнийг алгасна. */
  async grantProductsToUser(userId: string, productIds: string[], adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');

    const ids = [...new Set((productIds || []).filter(Boolean))];
    if (!ids.length) throw new BadRequestException('Бүтээгдэхүүн сонгоно уу');

    // Бодит бүтээгдэхүүн эсэхийг шалгана
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, price: true, accessType: true, accessDays: true },
    });
    if (!products.length) throw new BadRequestException('Сонгосон бүтээгдэхүүн олдсонгүй');

    const productIdList = products.map((p) => p.id);

    // 1) Хэрэглэгч аль хэдийн эзэмшсэн (PAID order) бүтээгдэхүүнийг алгасна —
    //    эдгээр нь "Миний сан"-д аль хэдийн байгаа тул дахин олгохгүй (давхардахгүй).
    const ownedItems = await this.prisma.orderItem.findMany({
      where: {
        productId: { in: productIdList },
        order: { userId, status: OrderStatus.PAID },
      },
      select: { productId: true },
    });
    const ownedSet = new Set(ownedItems.map((i) => i.productId));
    const toGrant = products.filter((p) => !ownedSet.has(p.id));

    if (!toGrant.length) {
      return { granted: 0, skipped: products.length, message: 'Бүгд аль хэдийн идэвхтэй' };
    }

    const grantIds = toGrant.map((p) => p.id);

    // 2) Тухайн бүтээгдэхүүний ХҮЛЭЭГДЭЖ БУЙ (PENDING) захиалгын item-ийг
    //    цэвэрлэнэ. Хэрэглэгч худалдаж аваагүй (төлбөр хийгээгүй) байхад админ
    //    үнэгүй олгож байгаа тул хуучин pending давхардал болж үлдэх ёсгүй —
    //    admin олгосноор тэр бүтээгдэхүүн "Миний сан"-д PAID-аар орж, pending алга болно.
    const pendingItems = await this.prisma.orderItem.findMany({
      where: {
        productId: { in: grantIds },
        order: { userId, status: OrderStatus.PENDING },
      },
      select: { id: true, orderId: true },
    });

    // 3) Бүх өөрчлөлтийг нэг transaction-д: pending item устгах → хоосон болсон
    //    pending order-ийг устгах → шинэ PAID grant order үүсгэх.
    const order = await this.prisma.$transaction(async (tx) => {
      if (pendingItems.length) {
        const pendingItemIds = pendingItems.map((i) => i.id);
        await tx.orderItem.deleteMany({ where: { id: { in: pendingItemIds } } });

        // Item нь үлдээгүй PENDING order-уудыг бүхэлд нь устгана (хог үлдэхгүй).
        const affectedOrderIds = [...new Set(pendingItems.map((i) => i.orderId))];
        for (const oid of affectedOrderIds) {
          const remaining = await tx.orderItem.count({ where: { orderId: oid } });
          if (remaining === 0) {
            await tx.order.deleteMany({ where: { id: oid, status: OrderStatus.PENDING } });
          }
        }
      }

      // total=0, PAID, ADMIN_GRANT захиалга үүсгэнэ (item бүр price=0).
      // Хандалтын хугацаа (expiresAt) нь худалдаж авсантай адил тооцогдоно:
      // аль нэг LIFETIME бол насан туршийн (null), бүгд DAYS бол MAX(accessDays).
      const grantPaidAt = new Date();
      const grantExpiresAt = computeOrderExpiresAt(toGrant, grantPaidAt);
      return tx.order.create({
        data: {
          userId,
          total: 0,
          status: OrderStatus.PAID,
          paidAt: grantPaidAt,
          expiresAt: grantExpiresAt,
          source: 'ADMIN_GRANT',
          grantedByAdminId: adminId,
          items: {
            create: toGrant.map((p) => ({ productId: p.id, price: 0 })),
          },
        },
        include: { items: { include: { product: { select: { title: true } } } } },
      });
    });

    // Хэрэглэгчид имэйл (худалдаж авсан шиг — Миний санд нэмэгдсэн тухай)
    if (user.email) {
      this.email
        .sendPaymentConfirmation({
          to: user.email,
          name: user.name,
          orderId: order.id,
          total: 0,
          items: order.items.map((i) => ({ title: i.product.title, price: 0 })),
        })
        .catch(() => null);
    }

    return { granted: toGrant.length, skipped: ownedSet.size, orderId: order.id };
  }

  /** Хэрэглэгчид админаас идэвхжүүлсэн (ADMIN_GRANT) бүтээгдэхүүний жагсаалт. */
  async listGrantedProducts(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId, source: 'ADMIN_GRANT', status: OrderStatus.PAID },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        items: {
          select: {
            productId: true,
            product: {
              select: {
                id: true,
                title: true,
                type: true,
                price: true,
                images: { where: { isPrimary: true }, take: 1, select: { fileKey: true } },
              },
            },
          },
        },
      },
    });

    // Бүх grant item-ийг нэг жагсаалт болгоно (orderId хадгална — цуцлахад хэрэгтэй)
    const items = orders.flatMap((o) =>
      o.items.map((it) => ({
        orderId: o.id,
        grantedAt: o.createdAt,
        productId: it.productId,
        title: it.product.title,
        type: it.product.type,
        price: it.product.price,
        imageKey: it.product.images?.[0]?.fileKey ?? null,
      })),
    );
    return { items };
  }

  // ─── Phase 4: STAFF MANAGEMENT (зөвхөн SUPERADMIN) ──────────────────────────
  // SUPERADMIN бусад admin (EDITOR/ADMIN)-ийг үүсгэх, эрх солих, блоклох, устгах.
  // ⚠️ Загвар: НЭГ л SUPERADMIN — SUPERADMIN-ийг хэн ч role/block/delete хийхгүй,
  // шинээр SUPERADMIN үүсгэх/болгох ч хийхгүй. Өөрийгөө downgrade/block/delete хийхгүй.

  private readonly STAFF_ROLES = ['EDITOR', 'ADMIN', 'SUPERADMIN'] as const;
  private readonly STAFF_SELECT = {
    id: true,
    email: true,
    name: true,
    role: true,
    blocked: true,
    image: true,
    createdAt: true,
  } as const;

  /** Бүх admin (EDITOR/ADMIN/SUPERADMIN) жагсаалт. End-user (USER) хасна. */
  async listStaff() {
    // ⚠️ Array шууд буцаана (frontend AdminStaff[] хүлээдэг — { items } биш).
    return this.prisma.user.findMany({
      where: { role: { in: ['EDITOR', 'ADMIN', 'SUPERADMIN'] } },
      orderBy: [{ role: 'desc' }, { createdAt: 'desc' }],
      select: this.STAFF_SELECT,
    });
  }

  /** Шинэ admin (зөвхөн ADMIN) үүсгэх. Email давхцал шалгана. password байвал
   * bcrypt hash, эс бол null (нууц үггүй — дараа нь админ тохируулна).
   * permissions өгсөн бол resource бүрд granular эрх хадгална (default: хоосон). */
  async createStaff(
    dto: {
      email: string;
      name?: string;
      role: 'ADMIN';
      password?: string;
      permissions?: StaffPermissionInput[];
    },
    adminId: string,
  ) {
    // ⚠️ Зөвхөн ADMIN үүсгэнэ (SUPERADMIN/EDITOR хийхгүй).
    if (dto.role !== 'ADMIN') {
      throw new BadRequestException('Эрх нь зөвхөн ADMIN байна');
    }
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Энэ имэйл аль хэдийн бүртгэлтэй байна');
    }
    // ⚠️ Нууц үг ЗААВАЛ — admin энэ нууц үгээр нэвтэрнэ.
    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException('Нууц үг шаардлагатай (хамгийн багадаа 8 тэмдэгт)');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Permission-уудыг урьдчилж шүүж/баталгаажуулна (мэдэгдэхгүй resource хасна).
    const permRows = this.sanitizePermissions(dto.permissions);

    const created = await this.prisma.user.create({
      data: {
        email,
        name: dto.name?.trim() || null,
        role: dto.role,
        passwordHash,
        // Админаар үүсгэсэн тул имэйл баталгаажсан гэж үзнэ (зочин биш).
        emailVerified: new Date(),
        isGuest: false,
        ...(permRows.length
          ? {
              permissions: {
                createMany: {
                  data: permRows.map((p) => ({
                    resource: p.resource,
                    canView: p.canView,
                    canCreate: p.canCreate,
                    canEdit: p.canEdit,
                    canDelete: p.canDelete,
                  })),
                },
              },
            }
          : {}),
      },
      select: this.STAFF_SELECT,
    });

    await this.writeAudit([
      { userId: created.id, field: 'role', oldValue: null, newValue: dto.role, actor: 'admin', actorId: adminId },
    ]);
    return created;
  }

  /** Permission жагсаалтыг шүүнэ: зөвхөн зөвшөөрөгдсөн resource, нэг resource нэг
   * мөр (давхардлыг сүүлчийнхээр дарна). Үл мэдэгдэх resource-ийг алгасна. */
  private sanitizePermissions(
    permissions: StaffPermissionInput[] | undefined,
  ): StaffPermissionInput[] {
    if (!Array.isArray(permissions) || !permissions.length) return [];
    const allowed = new Set<string>(ALLOWED_RESOURCES);
    const map = new Map<string, StaffPermissionInput>();
    for (const p of permissions) {
      if (!p || !allowed.has(p.resource)) continue;
      map.set(p.resource, {
        resource: p.resource,
        canView: !!p.canView,
        canCreate: !!p.canCreate,
        canEdit: !!p.canEdit,
        canDelete: !!p.canDelete,
      });
    }
    return [...map.values()];
  }

  /** Нэг admin-ийн БҮХ resource permission (frontend permission засах форм-д).
   * Resource бүрд бичлэг (байхгүй бол бүгд false) буцаана. SUPERADMIN бол бүрэн эрх. */
  async getStaffPermissions(id: string) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundException('Админ олдсонгүй');
    if (target.role === 'SUPERADMIN') {
      return ALLOWED_RESOURCES.map((resource) => ({
        resource, canView: true, canCreate: true, canEdit: true, canDelete: true,
      }));
    }
    const rows = await this.prisma.adminPermission.findMany({
      where: { userId: id },
      select: { resource: true, canView: true, canCreate: true, canEdit: true, canDelete: true },
    });
    const map = new Map(rows.map((r) => [r.resource, r]));
    return ALLOWED_RESOURCES.map((resource) => {
      const p = map.get(resource);
      return {
        resource,
        canView: !!p?.canView,
        canCreate: !!p?.canCreate,
        canEdit: !!p?.canEdit,
        canDelete: !!p?.canDelete,
      };
    });
  }

  /** Admin-ийн resource permission-уудыг шинэчлэх (upsert). SUPERADMIN target бол
   * хориглоно (бүрэн эрхтэй, permission table-гүй). */
  async updateStaffPermissions(id: string, permissions: StaffPermissionInput[], adminId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundException('Админ олдсонгүй');
    if (target.role === 'SUPERADMIN') {
      throw new ForbiddenException('SUPERADMIN-ийн эрхийг өөрчлөх боломжгүй');
    }
    if (target.role === 'USER') {
      throw new BadRequestException('Энэ хэрэглэгч admin биш байна');
    }

    const permRows = this.sanitizePermissions(permissions);
    await this.prisma.$transaction(
      permRows.map((p) =>
        this.prisma.adminPermission.upsert({
          where: { userId_resource: { userId: id, resource: p.resource } },
          create: {
            userId: id,
            resource: p.resource,
            canView: p.canView,
            canCreate: p.canCreate,
            canEdit: p.canEdit,
            canDelete: p.canDelete,
          },
          update: {
            canView: p.canView,
            canCreate: p.canCreate,
            canEdit: p.canEdit,
            canDelete: p.canDelete,
          },
        }),
      ),
    );

    await this.writeAudit([
      { userId: id, field: 'permissions', oldValue: null, newValue: `${permRows.length} resource`, actor: 'admin', actorId: adminId },
    ]);
    return this.getStaffPermissions(id);
  }

  /** Тухайн admin-ийг олж, staff үйлдэл хийх боломжтой эсэхийг шалгана.
   * SUPERADMIN-д хүрэхгүй, өөрийгөө хамгаална. */
  private async getStaffTarget(id: string, adminId: string, action: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Админ олдсонгүй');
    if (target.role === 'SUPERADMIN') {
      throw new ForbiddenException(`SUPERADMIN-ийг ${action} боломжгүй`);
    }
    if (target.id === adminId) {
      throw new ForbiddenException(`Өөрийгөө ${action} боломжгүй`);
    }
    return target;
  }

  /** Admin-ийн эрх солих (зөвхөн ADMIN). SUPERADMIN болгож upgrade хийхгүй.
   * (EDITOR ашиглахаа больсон — бүх staff ADMIN, granular permission-аар ялгана.) */
  async updateStaffRole(id: string, role: 'ADMIN', adminId: string) {
    if (role !== 'ADMIN') {
      throw new BadRequestException('Эрх нь зөвхөн ADMIN байна');
    }
    const target = await this.getStaffTarget(id, adminId, 'эрхийг өөрчлөх');
    if (target.role === 'USER') {
      throw new BadRequestException('Энэ хэрэглэгч admin биш байна');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: this.STAFF_SELECT,
    });
    await this.writeAudit([
      { userId: id, field: 'role', oldValue: target.role, newValue: role, actor: 'admin', actorId: adminId },
    ]);
    return updated;
  }

  /** Admin-ийг блоклох/нээх. SUPERADMIN-ийг блоклохгүй, өөрийгөө блоклохгүй. */
  async blockStaff(id: string, blocked: boolean, adminId: string) {
    const target = await this.getStaffTarget(id, adminId, 'блоклох');
    const updated = await this.prisma.user.update({
      where: { id },
      data: { blocked },
      select: this.STAFF_SELECT,
    });
    await this.writeAudit([
      {
        userId: id,
        field: 'blocked',
        oldValue: target.blocked ? 'true' : 'false',
        newValue: blocked ? 'true' : 'false',
        actor: 'admin',
        actorId: adminId,
      },
    ]);
    return updated;
  }

  /** Admin-ийг устгах. SUPERADMIN устгахгүй, өөрийгөө устгахгүй.
   * Тэр admin-ийн контент createdByUserId=null болно (FK SetNull). */
  async deleteStaff(id: string, adminId: string) {
    await this.getStaffTarget(id, adminId, 'устгах');
    // Холбоотой ZipJob/EmailOtp гар аргаар (deleteUser-тэй ижил pattern).
    const target = await this.prisma.user.findUnique({ where: { id }, select: { email: true } });
    await this.prisma.$transaction([
      this.prisma.zipJob.deleteMany({ where: { userId: id } }),
      ...(target?.email ? [this.prisma.emailOtp.deleteMany({ where: { email: target.email } })] : []),
      this.prisma.phoneVerifySession.deleteMany({ where: { userId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    return { success: true };
  }

  /** Админаас идэвхжүүлсэн нэг бүтээгдэхүүнийг ЦУЦЛАХ (зөвхөн ADMIN_GRANT).
   * Худалдаж авсан (PURCHASE) захиалгыг цуцлахгүй. Нэг item бол захиалга
   * бүхэлдээ устгана, олон item бол зөвхөн тэр item-ийг устгана. */
  async revokeGrantedProduct(userId: string, productId: string) {
    // Тухайн хэрэглэгчийн ADMIN_GRANT order доторх энэ бүтээгдэхүүний item
    const item = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: { userId, source: 'ADMIN_GRANT', status: OrderStatus.PAID },
      },
      include: { order: { select: { id: true, _count: { select: { items: true } } } } },
    });

    if (!item) {
      throw new NotFoundException('Идэвхжүүлсэн бүтээгдэхүүн олдсонгүй (зөвхөн админ идэвхжүүлсэнийг цуцална)');
    }

    if (item.order._count.items <= 1) {
      // Захиалгад ганц л item — захиалга бүхэлдээ устгана (item cascade)
      await this.prisma.order.delete({ where: { id: item.order.id } });
    } else {
      // Олон item — зөвхөн энэ item-ийг устгана
      await this.prisma.orderItem.delete({ where: { id: item.id } });
    }

    return { success: true };
  }
}
