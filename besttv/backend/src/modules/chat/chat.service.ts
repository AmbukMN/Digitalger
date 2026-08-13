import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * ⚠️⚠️ `facebook`/`instagram` ЗААВАЛ — n8n чатбот эдгээр сувгаас
 * мессеж дамжуулна. Жагсаалтад байхгүй бол чимээгүйгээр `web` болж,
 * админ панель дээр FB/IG-ээс ирсэн яриаг вэбийнхээс ЯЛГАЖ ЧАДАХГҮЙ
 * (schema-д `@@index([channel, lastMessageAt])` байгаа нь энэ ялгааг
 * хийхээр ТӨЛӨВЛӨСӨН гэдгийг харуулж байна).
 *
 * ⚠️ Чөлөөт текст болгож нээхгүй — endpoint нээлттэй тул дурын утга
 * оруулбал админы шүүлт замбараагүй болно.
 */
const ALLOWED_CHANNELS = new Set(['web', 'facebook', 'instagram']);
/**
 * ⚠️⚠️ `admin` ЗОРИУД БАЙХГҮЙ — `saveMessage` нь НЭЭЛТТЭЙ endpoint-оос
 * дуудагддаг тул халдлагч "админ" нэрийн өмнөөс мессеж бичиж phishing
 * хийж болно ("картын мэдээллээ энд илгээнэ үү").
 * Админы хариу нь `adminReply()`-аар л бичигдэнэ (тэр нь `saveMessage`
 * дамждаггүй, `@Roles(ADMIN)` хамгаалалттай).
 */
const ALLOWED_ROLES = new Set(['user', 'assistant']);
const MAX_TEXT_LENGTH = 8000;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

/** n8n-ээс ирэх санал болгосон кино */
export interface ChatTitleCard {
  id: string;
  title: string;
  slug: string;
  posterUrl?: string;
  url?: string;
  year?: number;
  rating?: number;
}

export interface SaveMessageInput {
  channel?: string;
  sessionId: string;
  role: string;
  text: string;
  userName?: string;
  userId?: string;
  titles?: ChatTitleCard[];
}

/**
 * Чатын лог — n8n AI туслахтай хийсэн яриаг хадгалж, админд харуулна.
 *
 * ⚠️ AI-ийн ЯРИАНЫ САНАХ ОЙ энд БАЙХГҮЙ — n8n-ийн Postgres memory-д байдаг.
 * Энд зөвхөн CRM зорилгын лог + админы гар хариулт.
 *
 * ⚠️ Бүх бичилт fail-open: чат хэзээ ч 500 өгөхгүй, `{ ok: true }` буцаана.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** userId бодитоор оршиж байгаа эсэх — FK алдаанаас сэргийлнэ */
  private async safeUserId(userId?: string): Promise<string | undefined> {
    if (!userId) return undefined;
    const u = await this.prisma.user
      .findUnique({ where: { id: userId }, select: { id: true } })
      .catch(() => null);
    return u?.id;
  }

  async saveMessage(input: SaveMessageInput) {
    const sessionId = (input.sessionId ?? '').trim().slice(0, 64);
    const text = (input.text ?? '').trim().slice(0, MAX_TEXT_LENGTH);
    const role = ALLOWED_ROLES.has(input.role) ? input.role : 'user';
    const channel = ALLOWED_CHANNELS.has(input.channel ?? '') ? input.channel! : 'web';

    if (!sessionId || !text) return { ok: true, skipped: true };

    try {
      // Хэрэглэгчийн бичсэн текстээс имэйл автоматаар таана (холбоо барих)
      let capturedEmail: string | undefined;
      if (role === 'user') {
        const m = text.match(EMAIL_RE);
        if (m) capturedEmail = m[0].toLowerCase();
      }

      const safeUserId = await this.safeUserId(input.userId);
      const now = new Date();
      const markAdminUnread = role === 'user';

      const conversation = await this.prisma.chatConversation.upsert({
        where: { sessionId },
        create: {
          channel,
          sessionId,
          lastMessageAt: now,
          adminUnread: markAdminUnread,
          ...(input.userName ? { userName: input.userName.slice(0, 120) } : {}),
          ...(capturedEmail ? { userEmail: capturedEmail } : {}),
          ...(safeUserId ? { userId: safeUserId } : {}),
        },
        update: {
          lastMessageAt: now,
          ...(markAdminUnread ? { adminUnread: true } : {}),
          ...(input.userName ? { userName: input.userName.slice(0, 120) } : {}),
          ...(capturedEmail ? { userEmail: capturedEmail } : {}),
          ...(safeUserId ? { userId: safeUserId } : {}),
        },
        select: { id: true },
      });

      const message = await this.prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role,
          text,
          ...(input.titles?.length ? { titles: input.titles as object } : {}),
        },
      });

      return { ok: true, conversationId: conversation.id, messageId: message.id };
    } catch (err) {
      this.logger.warn(`Чат хадгалахад алдаа: ${(err as Error).message}`);
      return { ok: true, skipped: true };
    }
  }

  /** Нэвтрэх үед зочны яриаг хэрэглэгчид холбоно (backfill) */
  async linkSession(sessionId: string, userId: string) {
    const sid = (sessionId ?? '').trim().slice(0, 64);
    if (!sid) return { ok: true, linked: 0 };
    const safe = await this.safeUserId(userId);
    if (!safe) return { ok: true, linked: 0 };

    // ⚠️ OR нөхцөл — өөр хэрэглэгчийн session-ыг булаахаас сэргийлнэ
    const res = await this.prisma.chatConversation
      .updateMany({
        where: { sessionId: sid, OR: [{ userId: null }, { userId: safe }] },
        data: { userId: safe },
      })
      .catch(() => null);

    return { ok: true, linked: res?.count ?? 0 };
  }

  /** Хэрэглэгчийн polling — админы шинэ хариу авах */
  /**
   * @param meId — нэвтэрсэн хэрэглэгчийн id (token-оос). Зочин бол null.
   */
  async getMessagesForUser(sessionId: string, after?: string, meId?: string | null) {
    const sid = (sessionId ?? '').trim().slice(0, 64);
    if (!sid) return { handedOff: false, messages: [] };

    const conv = await this.prisma.chatConversation
      .findUnique({
        where: { sessionId: sid },
        select: { id: true, handedOff: true, userUnreadCount: true, userId: true },
      })
      .catch(() => null);
    if (!conv) return { handedOff: false, messages: [] };

    /**
     * ⚠️⚠️ ЭЗЭМШЛИЙН ШАЛГАЛТ — БУСДЫН ЯРИА УНШИХААС хамгаална.
     *
     * `sessionId` нь localStorage-д хадгалагддаг бөгөөд лог, Referer,
     * дэлгэцийн зураг зэргээр задарч болно. Урьд нь шалгалт ОГТ
     * байгаагүй тул мэдсэн хүн ярианы БҮХ мессежийг (мөн ярианаас
     * автоматаар салгасан ИМЭЙЛ) уншиж чаддаг байв.
     *
     * ⚠️ Яриа хэрэглэгчид ХОЛБОГДСОН (`userId != null`) байвал ЗӨВХӨН
     * тэр хүн уншина. Зочны яриа (`userId == null`) нь sessionId-аараа
     * л хамгаалагдана — тэнд нэвтрэлт байхгүй тул өөр арга байхгүй.
     */
    if (conv.userId && conv.userId !== meId) {
      return { handedOff: false, messages: [] };
    }

    const afterDate = after ? new Date(after) : undefined;
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        conversationId: conv.id,
        ...(afterDate && !isNaN(afterDate.getTime()) ? { createdAt: { gt: afterDate } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { id: true, role: true, text: true, titles: true, createdAt: true },
    });

    // Админы мессежийг хэрэглэгч харсан тул тоолуур тэглэнэ
    if (conv.userUnreadCount > 0 && messages.some((m) => m.role === 'admin')) {
      await this.prisma.chatConversation
        .update({ where: { id: conv.id }, data: { userUnreadCount: 0 } })
        .catch(() => null);
    }

    return { handedOff: conv.handedOff, messages };
  }

  async getUnreadForUser(sessionId: string, meId?: string | null) {
    const sid = (sessionId ?? '').trim().slice(0, 64);
    if (!sid) return { unread: 0, handedOff: false };
    const conv = await this.prisma.chatConversation
      .findUnique({
        where: { sessionId: sid },
        select: { userUnreadCount: true, handedOff: true, userId: true },
      })
      .catch(() => null);
    /* ⚠️ `getMessagesForUser`-тэй ижил эзэмшлийн шалгалт */
    if (conv?.userId && conv.userId !== meId) return { unread: 0, handedOff: false };
    return { unread: conv?.userUnreadCount ?? 0, handedOff: conv?.handedOff ?? false };
  }

  // ─── Админ ────────────────────────────────────────────────────────────────

  async listConversations(opts: {
    page?: number;
    pageSize?: number;
    onlyUnread?: boolean;
    q?: string;
    channel?: string;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));

    /**
     * ⚠️⚠️ ХАЙЛТ — өмнө нь ОГТ БАЙГААГҮЙ.
     *
     * `pageSize` дээд тал нь 50 тул 51 дэх яриа руу хүрэх ямар ч арга
     * байхгүй байв (хуудаслалт ч админ талд байхгүй). Хэрэглэгч
     * "миний бичсэн зурвасыг хараарай" гэж залгахад тэр яриаг ОЛОХ
     * боломжгүй — тусламжийн ажил бүтэхгүй.
     *
     * ⚠️ Имэйл/нэрээс ГАДНА мессежийн агуулгаар ч хайна — зочин
     * хэрэглэгч (userId = null) нь имэйлгүй тул зөвхөн бичсэн
     * зурвасаараа л олдоно.
     */
    const needle = opts.q?.trim();
    /**
     * ⚠️ Сувгийн шүүлт — FB/IG чатбот ажиллаж эхэлмэгц вэбийн яриатай
     * холилдоно. «Facebook-ээс ирсэн хариулаагүй зурвасууд» гэсэн
     * ажлын урсгал шүүлтгүйгээр боломжгүй.
     *
     * ⚠️ Зөвшөөрөгдсөн утгыг л авна — дурын текст шидвэл хоосон
     * жагсаалт буцаж, админ «яриа алга болсон» гэж бодно.
     */
    const channel =
      opts.channel && ALLOWED_CHANNELS.has(opts.channel) ? opts.channel : undefined;
    const where: Prisma.ChatConversationWhereInput = {
      ...(opts.onlyUnread ? { adminUnread: true } : {}),
      ...(channel ? { channel } : {}),
      ...(needle
        ? {
            OR: [
              { user: { email: { contains: needle, mode: 'insensitive' } } },
              { user: { name: { contains: needle, mode: 'insensitive' } } },
              { messages: { some: { text: { contains: needle, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [items, total, unreadTotal, byChannel] = await Promise.all([
      this.prisma.chatConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, name: true, email: true, avatarKey: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { text: true, role: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.chatConversation.count({ where }),
      this.prisma.chatConversation.count({ where: { adminUnread: true } }),
      /**
       * ⚠️ Суваг тус бүрийн тоо — шүүлтийн товч дээр «FB 12» гэж
       * харуулна. Тоогүй бол админ хоосон табыг дарж шалгах хэрэгтэй
       * болно. `where`-ээс ХАМААРАХГҮЙ (бүх сувгийн бодит тоо).
       */
      this.prisma.chatConversation.groupBy({
        by: ['channel'],
        _count: { _all: true },
      }),
    ]);

    const channelCounts: Record<string, number> = {};
    for (const row of byChannel) channelCounts[row.channel] = row._count._all;

    /* ⚠️ `totalPages` — админы `<Pagination>` энэ талбарыг шаардана */
    return {
      items,
      total,
      unreadTotal,
      channelCounts,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getConversation(id: string) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, avatarKey: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 200,
          select: { id: true, role: true, text: true, titles: true, createdAt: true },
        },
      },
    });
    if (!conv) return null;

    if (conv.adminUnread) {
      await this.prisma.chatConversation
        .update({ where: { id }, data: { adminUnread: false } })
        .catch(() => null);
    }
    return conv;
  }

  /** Админ гар аргаар хариулах */
  async adminReply(id: string, text: string) {
    const t = (text ?? '').trim().slice(0, MAX_TEXT_LENGTH);
    if (!t) return { ok: false as const };

    const conv = await this.prisma.chatConversation.findUnique({
      where: { id },
      select: { id: true, userId: true, sessionId: true, channel: true },
    });
    if (!conv) return { ok: false as const };

    const message = await this.prisma.chatMessage.create({
      data: { conversationId: id, role: 'admin', text: t },
      select: { id: true, role: true, text: true, createdAt: true },
    });

    await this.prisma.chatConversation.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        adminUnread: false,
        userUnreadCount: { increment: 1 },
      },
    });

    /**
     * ⚠️⚠️ FB/IG-д хариуг MESSENGER РҮҮ илгээнэ.
     *
     * Вэбийн хэрэглэгч сайт руугаа орж хариуг харна. Гэтэл Facebook/
     * Instagram-аас бичсэн хүн МАНАЙ САЙТ РУУ ОРДОГГҮЙ — DB-д бичээд
     * орхивол админы хариу хэнд ч хүрэхгүй, хэрэглэгч хариу аваагүй
     * гэж бодоод орхино.
     *
     * ⚠️ Алдаа гарвал ШИДЭХГҮЙ — админд «илгээгдлээ» гэж харагдсан
     * атлаа DB-д хадгалагдахгүй байх нь илүү муу. Оронд нь буцаах
     * утганд `delivered` талбараар мэдэгдэнэ.
     */
    let delivered: boolean | undefined;
    if (conv.channel === 'facebook' || conv.channel === 'instagram') {
      delivered = await this.sendToMessenger(conv.sessionId, t);
    }

    return { ok: true as const, message, userId: conv.userId, delivered };
  }

  /**
   * Facebook/Instagram Messenger руу текст илгээнэ.
   *
   * ⚠️ `sessionId` нь FB/IG-ийн PSID (n8n тэрийг sessionId болгож бичдэг).
   * ⚠️ Token байхгүй бол чимээгүй унтрахгүй — ЛОГ бичнэ, эс бөгөөс
   *    админ хариу явахгүй байгааг мэдэхгүй.
   */
  private async sendToMessenger(psid: string, text: string): Promise<boolean> {
    const token = process.env.FB_PAGE_ACCESS_TOKEN;
    if (!token) {
      this.logger.error(
        'FB_PAGE_ACCESS_TOKEN тохируулаагүй — админы хариу Messenger рүү ИЛГЭЭГДСЭНГҮЙ',
      );
      return false;
    }
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: psid },
            message: { text: text.slice(0, 1900) },
            /* ⚠️ Хүний оператор гэдгийг Meta-д мэдэгдэнэ — 24 цагийн
               дүрмийн хувьд RESPONSE-оос уян хатан */
            messaging_type: 'RESPONSE',
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`Messenger илгээлт амжилтгүй (${res.status}): ${body.slice(0, 300)}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.error(`Messenger илгээлт алдаа: ${(e as Error).message}`);
      return false;
    }
  }

  /**
   * n8n-д зориулсан ХӨНГӨН төлөв шалгалт.
   *
   * ⚠️ Яриа хараахан үүсээгүй (анхны мессеж) бол `handedOff: false` —
   * шинэ хэрэглэгчид AI хариулах ёстой.
   */
  async sessionState(sessionId: string): Promise<{ handedOff: boolean; exists: boolean }> {
    if (!sessionId) return { handedOff: false, exists: false };
    const conv = await this.prisma.chatConversation
      .findUnique({ where: { sessionId }, select: { handedOff: true } })
      .catch(() => null);
    return { handedOff: conv?.handedOff ?? false, exists: !!conv };
  }

  /** AI-г унтраах / буцааж асаах */
  async setHandoff(id: string, handedOff: boolean) {
    await this.prisma.chatConversation
      .update({
        where: { id },
        data: { handedOff, ...(handedOff ? { adminUnread: false } : {}) },
      })
      .catch(() => null);
    return { ok: true, handedOff };
  }

  /**
   * Олон яриаг нэг дор устгана (админ — тест яриа цэвэрлэх).
   *
   * ⚠️  нь  тул мессежүүд нь ДАГАЖ
   * устана — тусад нь устгах шаардлагагүй.
   */
  /**
   * Олон яриаг нэг дор устгана (админ — тест яриа цэвэрлэх).
   *
   * ⚠️ `ChatMessage` нь `onDelete: Cascade` тул мессежүүд нь ДАГАЖ устана —
   * тусад нь устгах шаардлагагүй.
   */
  async bulkDelete(ids: string[]) {
    if (!ids.length) return { deleted: 0 };
    const res = await this.prisma.chatConversation.deleteMany({
      where: { id: { in: ids } },
    });
    return { deleted: res.count };
  }

  async unreadCount() {
    const unreadTotal = await this.prisma.chatConversation.count({ where: { adminUnread: true } });
    return { unreadTotal };
  }
}
