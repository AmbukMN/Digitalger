import {
  Controller,
  Delete,
  Get,
  Global,
  Injectable,
  Logger,
  Module,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PushService } from './push.service';
import { Body } from '@nestjs/common';

/**
 * ХЭРЭГЛЭГЧИЙН МЭДЭГДЭЛ.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: дансаар төлсөн хэрэглэгч «баталгаажсан уу?»
 * гэдгээ мэдэхгүй хүлээнэ. Имэйл хоцордог/спамд ордог, Telegram нь
 * зөвхөн админд. Сайт дээр шууд харагдах мэдэгдэл нь дэмжлэгийн
 * дуудлагыг эрс багасгана.
 *
 * ⚠️ Мэдэгдэл үүсгэх нь ХЭЗЭЭ Ч алдаа шидэхгүй — үндсэн үйлдэл
 * (төлбөр баталгаажуулах) мэдэгдлээс болж зогсох ёсгүй.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    /** ⚠️ Гар утасны push — мэдэгдэл үүсэх бүрд автоматаар явна */
    private readonly push: PushService,
  ) {}

  /**
   * Мэдэгдэл үүсгэнэ.
   *
   * ⚠️ `void`-оор дуудагдана — `await` шаардахгүй. Алдаа гарвал зөвхөн
   * лог үлдэнэ.
   */
  create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    link?: string,
  ): void {
    void this.prisma.notification
      .create({ data: { userId, type, title, body, link: link ?? null } })
      .catch((e) => {
        this.logger.warn(`Мэдэгдэл үүсгэж чадсангүй (user=${userId}): ${String(e)}`);
      });

    /**
     * ⚠️⚠️ ГАР УТСАНД PUSH — энэ нь мэдэгдлийн НЭГ цэг тул шинэ төрөл
     * нэмэхэд push автоматаар явна (тусад нь дуудах шаардлагагүй).
     *
     * ⚠️ `void` — push унасан ч үндсэн үйлдэл (төлбөр баталгаажуулах)
     * зогсох ЁСГҮЙ. `sendToUser` дотроо бүх алдааг барьдаг.
     */
    void this.push.sendToUser(userId, title, body, link ? { link } : undefined);
  }

  /**
   * Транзакц дотор үүсгэх хувилбар.
   * ⚠️ Төлбөр баталгаажих + мэдэгдэл нь АТОМАР байх шаардлагатай үед.
   */
  async createTx(
    tx: Prisma.TransactionClient,
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    link?: string,
  ): Promise<void> {
    await tx.notification.create({
      data: { userId, type, title, body, link: link ?? null },
    });
  }

  async list(userId: string, limit = 30) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
  }

  /**
   * ⚠️⚠️ PUSH ТОКЕН БҮРТГЭХ (upsert).
   *
   * Апп нээгдэх бүрд дуудагдана. Токен ижил бол шинэчилнэ.
   *
   * ⚠️ `token` нь UNIQUE тул НЭГ УТСАНД өөр хэрэглэгч нэвтэрвэл `userId`
   * шинэчлэгдэнэ — эс бөгөөс өмнөх эзний хувийн мэдэгдэл (төлбөр,
   * багц) шинэ хүнд очно.
   *
   * ⚠️ `enabled: true` — дахин бүртгэхэд асаана. Хэрэглэгч аппаа
   * дахин суулгасан бол push ажиллах хүлээлттэй.
   */
  async registerPushToken(
    userId: string,
    dto: { token: string; platform: string; appVersion?: string; deviceName?: string },
  ) {
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
        appVersion: dto.appVersion ?? null,
        deviceName: dto.deviceName ?? null,
      },
      update: {
        userId,
        platform: dto.platform,
        appVersion: dto.appVersion ?? null,
        deviceName: dto.deviceName ?? null,
        enabled: true,
        lastUsedAt: new Date(),
      },
    });
    return { ok: true };
  }

  /**
   * Push асаах/унтраах.
   * ⚠️ Токеныг УСТГАХГҮЙ — дахин асаахад ижил токен ашиглана
   * (Expo шинэ токен өгөх шаардлагагүй).
   */
  async togglePush(userId: string, enabled: boolean) {
    const { count } = await this.prisma.deviceToken.updateMany({
      where: { userId },
      data: { enabled },
    });
    return { ok: true, devices: count };
  }

  /**
   * Гарахад тухайн ТӨХӨӨРӨМЖИЙН токеныг устгана.
   * ⚠️ `userId` шалгана — өөр хүний токен устгахаас (IDOR) хамгаална.
   */
  async removePushToken(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { token, userId } });
    return { ok: true };
  }

  /** Зөвхөн уншаагүйн тоо — хонхны улаан цэгт (хөнгөн query) */
  async unreadCount(userId: string): Promise<{ unread: number }> {
    const unread = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { unread };
  }

  async markRead(userId: string, id: string) {
    /* ⚠️ `updateMany` + userId — өөр хүний мэдэгдэл уншсан болгох
       IDOR-оос хамгаална */
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, count: res.count };
  }

  async remove(userId: string, id: string) {
    await this.prisma.notification.deleteMany({ where: { id, userId } });
    return { ok: true };
  }

  /**
   * ─── АДМИНЫ ДОХИО (badge + feed) ──────────────────────────────
   *
   * ⚠️⚠️ Энэ нь ХЭРЭГЛЭГЧИЙН `Notification`-ООС ТУСДАА зүйл.
   * Хэрэглэгчид мэдэгдэл бичдэг бол админд нь БОДИТ ӨГӨГДЛӨӨС
   * (шинэ төлбөр, шинэ хэрэглэгч, шинэ чат) тоолж харуулна —
   * тусад нь мөр үүсгэдэггүй тул хоцрох, давхардах эрсдэлгүй.
   *
   * ⚠️ `AdminSeen` хүснэгт нь админ бүрд, хэсэг бүрд «хэзээ
   * үзсэн»-ийг хадгална. Түүнээс хойшхийг ШИНЭ гэж тооцно.
   */
  private async seenMap(adminId: string): Promise<Record<string, Date>> {
    const rows = await this.prisma.adminSeen.findMany({
      where: { adminId },
      select: { section: true, lastSeenAt: true },
    });
    return Object.fromEntries(rows.map((r) => [r.section, r.lastSeenAt]));
  }

  /**
   * ⚠️ Хэзээ ч үзээгүй хэсэгт БҮХ түүхийг «шинэ» гэж тоолохгүй —
   * анх нэвтэрсэн админд 5000 гэсэн утгагүй тоо гарна. 7 хоногоор
   * хязгаарлана.
   */
  private since(map: Record<string, Date>, section: string): Date {
    const fallback = new Date(Date.now() - 7 * 86_400_000);
    const seen = map[section];
    return seen && seen > fallback ? seen : fallback;
  }

  /** Sidebar-ийн улаан тоо — хэсэг бүрийн ШИНЭ тоо */
  async adminBadges(adminId: string): Promise<Record<string, number>> {
    const map = await this.seenMap(adminId);

    const [users, payments, reviews, chat, subscribers] = await Promise.all([
      this.prisma.user.count({
        where: { createdAt: { gt: this.since(map, 'users') } },
      }),
      /* ⚠️ Зөвхөн ТӨЛӨГДСӨН — PENDING нь орлого биш */
      this.prisma.payment.count({
        where: { status: 'PAID', paidAt: { gt: this.since(map, 'payments') } },
      }),
      this.prisma.review.count({
        where: { createdAt: { gt: this.since(map, 'reviews') } },
      }),
      /* ⚠️ Хэрэглэгчийн мессеж л (админы хариу биш) */
      this.prisma.chatMessage.count({
        where: { role: 'user', createdAt: { gt: this.since(map, 'chat') } },
      }),
      this.prisma.subscriber.count({
        where: { createdAt: { gt: this.since(map, 'subscribers') } },
      }),
    ]);

    /**
     * ⚠️⚠️ ДАНСНЫ ТӨЛБӨР — ҮЙЛДЭЛ ШААРДСАН. Бусад нь «мэдээлэл»
     * бол энэ нь «шалгаж батал» гэсэн ажил. Тиймээс «шинэ»-гээр
     * биш, ХҮЛЭЭГДЭЖ БУЙ бүхнээр тоолно (үзсэн ч ажил дуусахгүй).
     */
    const bankPending = await this.prisma.payment.count({
      where: { status: 'PENDING', bankClaimedAt: { not: null } },
    });

    return { users, payments, reviews, chat, subscribers, bank: bankPending };
  }

  /**
   * Хонхны жагсаалт — сүүлийн үйл явдлууд.
   *
   * ⚠️ Хэсэг бүрээс 5-аар авч нийлүүлээд огноогоор эрэмбэлнэ.
   * Нэг хэсэг олон бол бусдыг дарах ёсгүй (админ бүх төрлийг харна).
   */
  async adminFeed(adminId: string) {
    const map = await this.seenMap(adminId);
    const take = 5;

    const [users, payments, reviews, chats, bank] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, name: true, email: true, createdAt: true },
      }),
      this.prisma.payment.findMany({
        where: { status: 'PAID' },
        orderBy: { paidAt: 'desc' },
        take,
        select: {
          id: true,
          amount: true,
          paidAt: true,
          isWalletTopup: true,
          plan: { select: { name: true } },
          user: { select: { name: true, email: true } },
        },
      }),
      this.prisma.review.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
          title: { select: { title: true } },
        },
      }),
      this.prisma.chatMessage.findMany({
        where: { role: 'user' },
        orderBy: { createdAt: 'desc' },
        take,
        /* ⚠️ Талбарын нэр нь `text` (`content` БИШ) */
        select: {
          id: true,
          text: true,
          createdAt: true,
          conversationId: true,
        },
      }),
      /* ⚠️ Дансны төлбөр — ҮЙЛДЭЛ шаардсан тул feed-д ч гарна */
      this.prisma.payment.findMany({
        where: { status: 'PENDING', bankClaimedAt: { not: null } },
        orderBy: { bankClaimedAt: 'desc' },
        take,
        select: {
          id: true,
          amount: true,
          bankReference: true,
          bankClaimedAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

    const who = (u: { name: string | null; email: string } | null) =>
      u?.name ?? u?.email ?? 'Тодорхойгүй';
    const money = (n: number) => `${n.toLocaleString()}\u20ae`;

    const items = [
      ...users.map((u) => ({
        id: `user-${u.id}`,
        section: 'users',
        title: 'Шинэ хэрэглэгч',
        detail: who(u),
        at: u.createdAt.toISOString(),
        href: '/users',
        unread: u.createdAt > this.since(map, 'users'),
      })),
      ...payments.map((p) => ({
        id: `pay-${p.id}`,
        section: 'payments',
        title: p.isWalletTopup ? 'Хэтэвч цэнэглэлт' : 'Төлбөр орлоо',
        detail: `${money(p.amount)} \u00b7 ${who(p.user)}${p.plan ? ` \u00b7 ${p.plan.name}` : ''}`,
        at: (p.paidAt ?? new Date()).toISOString(),
        href: '/payments',
        unread: !!p.paidAt && p.paidAt > this.since(map, 'payments'),
      })),
      ...bank.map((p) => ({
        id: `bank-${p.id}`,
        section: 'bank',
        title: 'Дансаар шилжүүлэв — шалгана уу',
        detail: `${money(p.amount)} \u00b7 ${p.bankReference} \u00b7 ${who(p.user)}`,
        at: (p.bankClaimedAt ?? new Date()).toISOString(),
        href: '/bank',
        /* ⚠️ ҮРГЭЛЖ unread — админ баталгаажуулах хүртэл ажил дуусахгүй */
        unread: true,
      })),
      ...reviews.map((r) => ({
        id: `rev-${r.id}`,
        section: 'reviews',
        title: `Сэтгэгдэл (${r.rating}\u2605)`,
        detail: `${who(r.user)} \u00b7 ${r.title?.title ?? ''}${r.comment ? ` \u2014 ${r.comment.slice(0, 40)}` : ''}`,
        at: r.createdAt.toISOString(),
        href: '/reviews',
        unread: r.createdAt > this.since(map, 'reviews'),
      })),
      ...chats.map((c) => ({
        id: `chat-${c.id}`,
        section: 'chat',
        title: 'Чатын мессеж',
        detail: c.text.slice(0, 60),
        at: c.createdAt.toISOString(),
        href: `/chat?id=${c.conversationId}`,
        unread: c.createdAt > this.since(map, 'chat'),
      })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));

    return { items: items.slice(0, 25), unreadTotal: items.filter((i) => i.unread).length };
  }

  /** Хэсгийг «үзсэн» гэж тэмдэглэнэ */
  async markSectionSeen(adminId: string, section: string) {
    await this.prisma.adminSeen.upsert({
      where: { adminId_section: { adminId, section } },
      create: { adminId, section, lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    });
    return { ok: true };
  }

  /** Хэсэг бүрийн сүүлд үзсэн огноо — жагсаалтад «ШИНЭ» тэмдэг тавихад */
  async lastSeen(adminId: string): Promise<Record<string, string | null>> {
    const map = await this.seenMap(adminId);
    return Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, v.toISOString()]),
    );
  }

  /** Админ: бүх хэрэглэгчийн мэдэгдэл (tracking-д) */
  adminForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

/**
 * ⚠️ Аппаас push токен бүртгэх.
 *
 * Апп нээгдэх бүрд илгээнэ (Expo токен ӨӨРЧЛӨГДӨЖ болно — апп
 * шинэчлэгдэх, өгөгдөл цэвэрлэгдэх үед). Тиймээс `upsert`.
 */
class RegisterPushDto {
  @IsString()
  token: string;

  @IsIn(['ios', 'android'])
  platform: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;
}

class PushToggleDto {
  @IsBoolean()
  enabled: boolean;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  /**
   * ⚠️⚠️ ГАР УТАСНЫ PUSH ТОКЕН БҮРТГЭХ.
   *
   * Апп нээгдэх бүрд дуудна. Токен ижил бол зөвхөн `lastUsedAt`,
   * `appVersion` шинэчлэгдэнэ.
   *
   * ⚠️ Токен нь UNIQUE тул НЭГ утсанд өөр хэрэглэгч нэвтэрвэл `userId`
   * шинэчлэгдэнэ — эс бөгөөс өмнөх хүний мэдэгдэл шинэ хүнд очно.
   */
  @Post('push/register')
  registerPush(@CurrentUser() user: JwtPayload, @Body() dto: RegisterPushDto) {
    return this.svc.registerPushToken(user.sub, dto);
  }

  /** Аппаас push унтраах/асаах (токеныг устгахгүй) */
  @Post('push/toggle')
  togglePush(@CurrentUser() user: JwtPayload, @Body() dto: PushToggleDto) {
    return this.svc.togglePush(user.sub, dto.enabled);
  }

  /**
   * Гарахад дуудна — тухайн ТӨХӨӨРӨМЖИЙН токеныг устгана.
   * ⚠️ Устгахгүй бол гарсан хэрэглэгчид мэдэгдэл ирсээр байна.
   */
  @Delete('push/:token')
  removePush(@CurrentUser() user: JwtPayload, @Param('token') token: string) {
    return this.svc.removePushToken(user.sub, token);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.svc.list(user.sub, limit ? Number(limit) : 30);
  }

  /**
   * ⚠️ Хөнгөн endpoint — хонхны тоог 60 секунд тутам шалгана.
   * Бүтэн жагсаалт татвал хэрэггүй өгөгдөл дамжина.
   */
  @Get('unread-count')
  unread(@CurrentUser() user: JwtPayload) {
    return this.svc.unreadCount(user.sub);
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.markRead(user.sub, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.svc.markAllRead(user.sub);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.remove(user.sub, id);
  }
}

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class NotificationsAdminController {
  constructor(private readonly svc: NotificationsService) {}

  /**
   * Sidebar-ийн улаан тоо.
   * ⚠️ 30 секунд тутам дуудагддаг тул ХӨНГӨН байх ёстой (зөвхөн count).
   */
  @Get('badges')
  badges(@CurrentUser() user: JwtPayload) {
    return this.svc.adminBadges(user.sub);
  }

  /** Хонхны жагсаалт */
  @Get('feed')
  feed(@CurrentUser() user: JwtPayload) {
    return this.svc.adminFeed(user.sub);
  }

  /** Хэсэг бүрийн сүүлд үзсэн огноо */
  @Get('last-seen')
  lastSeen(@CurrentUser() user: JwtPayload) {
    return this.svc.lastSeen(user.sub);
  }

  /**
   * Хэсгийг «үзсэн» гэж тэмдэглэнэ.
   * ⚠️ `:section` нь чөлөөт текст — DB-д unique(adminId, section) тул
   * буруу нэр орсон ч хор хөнөөлгүй, зүгээр л ашиглагдахгүй мөр үүснэ.
   */
  @Post('seen/:section')
  markSeen(@CurrentUser() user: JwtPayload, @Param('section') section: string) {
    return this.svc.markSectionSeen(user.sub, section);
  }

  /** Хэрэглэгчийн мэдэгдлийн түүх — tracking хэсэгт */
  @Get('user/:userId')
  forUser(@Param('userId') userId: string) {
    return this.svc.adminForUser(userId);
  }
}

/**
 * ⚠️ `@Global` — мэдэгдэл нь олон модулиас үүсгэгдэнэ (bank, payments,
 * subscriptions). Модуль бүрд import шаардвал шинэ газарт мартагдана.
 */
@Global()
@Module({
  controllers: [NotificationsController, NotificationsAdminController],
  providers: [NotificationsService, PushService],
  /* ⚠️ `PushService` экспортлоно — «шинэ анги гарлаа» гэх мэт бөөн
     мэдэгдлийг titles/videos модулиас шууд илгээнэ */
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
