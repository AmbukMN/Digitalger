import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

// Чат суваг — n8n workflow-аас ирэх утга (web chat / FB / IG).
export type ChatChannel = 'web' | 'facebook' | 'instagram';
export type ChatRole = 'user' | 'assistant';

const ALLOWED_CHANNELS: ChatChannel[] = ['web', 'facebook', 'instagram'];
const ALLOWED_ROLES: ChatRole[] = ['user', 'assistant'];
// Нэг мессежийн текстийн дээд урт (спам/DB дүүргэхээс хамгаалах).
const MAX_TEXT_LENGTH = 8000;

export interface SaveChatInput {
  channel: string;
  sessionId: string;
  role: string;
  text: string;
  userName?: string;
  userImage?: string; // FB/IG profile зураг (n8n Get User Profile-аас)
  userId?: string;
  // AI бот санал болгосон бүтээгдэхүүний card (assistant мессеж дээр n8n дамжуулна).
  products?: unknown;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * FB/IG Messenger хэрэглэгч рүү Graph Send API-аар мессеж илгээх.
   * sessionId = PSID (page-scoped user id). FB_PAGE_ACCESS_TOKEN env шаардлагатай.
   * Алдаа гарвал залгина (admin reply DB-д хадгалагдсан хэвээр — мессеж алдагдахгүй).
   */
  private async sendFbMessage(psid: string, text: string): Promise<void> {
    const token = this.config.get<string>('FB_PAGE_ACCESS_TOKEN');
    if (!token || !psid || !text) return;
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: psid },
            messaging_type: 'RESPONSE',
            message: { text },
          }),
        },
      );
      if (!res.ok) {
        this.logger.warn(`FB send fail ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
    } catch (e) {
      this.logger.warn(`FB send error: ${String(e).slice(0, 200)}`);
    }
  }

  // Дамжуулсан userId DB-д бодитоор оршдог эсэхийг шалгана (хуурамч/устсан id-аас
  // FK алдаа гарахаас сэргийлж, fail-open — байхгүй бол undefined).
  private async safeUserId(userId?: string): Promise<string | undefined> {
    if (!userId) return undefined;
    try {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      return u ? userId : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * n8n чатбот мессеж бүрийг хадгална (web/FB/IG). sessionId-аар conversation-ийг
   * upsert хийж, шинэ ChatMessage үүсгэнэ. lastMessageAt-г шинэчилнэ.
   *   - Зочин (нэвтрээгүй) үед userId байхгүй — sessionId-аар хадгалж, дараа нь
   *     хэрэглэгч нэвтрэхэд linkSession-аар userId-д холбоно (backfill).
   *   - userName/userId өгвөл (нэвтэрсэн / FB-IG profile) set хийнэ.
   * ⚠️ n8n-аас олон удаа дуудагдана тул хурдан, найдвартай байх ёстой.
   */
  async saveMessage(input: SaveChatInput) {
    const channel = ALLOWED_CHANNELS.includes(input.channel as ChatChannel)
      ? (input.channel as ChatChannel)
      : 'web';
    const role = ALLOWED_ROLES.includes(input.role as ChatRole)
      ? (input.role as ChatRole)
      : 'user';

    const sessionId = (input.sessionId ?? '').trim();
    const text = (input.text ?? '').slice(0, MAX_TEXT_LENGTH);

    // sessionId/text хоосон бол хадгалах утгагүй — чимээгүй өнгөрнө (n8n-д 200).
    if (!sessionId || !text) {
      return { ok: true, skipped: true };
    }

    const userName = input.userName?.trim() || undefined;
    const userImage = input.userImage?.trim() || undefined;
    const safeUserId = await this.safeUserId(input.userId);
    const now = new Date();

    // sessionId unique тул upsert — байхгүй бол create, байвал lastMessageAt
    // шинэчилж, userName/userId өгсөн бол set хийнэ (хуучин утгыг устгахгүй).
    // Хэрэглэгчийн (user) шинэ мессеж → admin уншаагүй (sidebar badge асна).
    // assistant (AI) мессеж adminUnread болгохгүй (зөвхөн хэрэглэгч бичсэнд анхаарна).
    const markAdminUnread = role === 'user';

    const conversation = await this.prisma.chatConversation.upsert({
      where: { sessionId },
      create: {
        channel,
        sessionId,
        lastMessageAt: now,
        adminUnread: markAdminUnread,
        ...(userName ? { userName } : {}),
        ...(userImage ? { userImage } : {}),
        ...(safeUserId ? { userId: safeUserId } : {}),
      },
      update: {
        // ⚠️ channel-ийг ч шинэчилнэ — нэг хэрэглэгч (sessionId) FB→IG шилжвэл хамгийн
        // сүүлийн платформоор. Өмнө update-д channel байхгүй тул хуучин facebook
        // conversation-д IG мессеж нэмэгдэхэд facebook хэвээр (admin-д буруу ялгаатай) байв.
        channel,
        lastMessageAt: now,
        ...(markAdminUnread ? { adminUnread: true } : {}),
        ...(userName ? { userName } : {}),
        ...(userImage ? { userImage } : {}),
        ...(safeUserId ? { userId: safeUserId } : {}),
      },
      select: { id: true },
    });

    // Products card — зөвхөн assistant мессеж дээр, массив бол (дээд 12, спам хязгаар).
    // Хэрэглэгчид харагдсан card-ийг ЯГ хадгална → admin ижлээр харна.
    let products: unknown[] | undefined;
    if (role === 'assistant' && Array.isArray(input.products) && input.products.length) {
      products = input.products.slice(0, 12);
    }

    await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role,
        text,
        ...(products ? { products: products as object } : {}),
      },
    });

    return { ok: true, conversationId: conversation.id };
  }

  /**
   * Backfill — нэвтэрсэн хэрэглэгч өөрийн web chat session-ийг өөртөө холбоно.
   * Зочин үед чат sessionId-аар (userId=null) хадгалагдсан байдаг. Хэрэглэгч
   * нэвтрэхэд frontend энэ endpoint-ийг дуудаж, тэр session-ийг userId-д холбоно.
   * ⚠️ userId-ийг ЗААВАЛ token-оос авна (body-оос биш) — өөр хүний чат session
   * булаахаас сэргийлж.
   */
  async linkSession(sessionId: string, userId: string) {
    const sid = (sessionId ?? '').trim();
    if (!sid || !userId) return { ok: true, linked: 0 };
    const safe = await this.safeUserId(userId);
    if (!safe) return { ok: true, linked: 0 };

    try {
      const res = await this.prisma.chatConversation.updateMany({
        // Зөвхөн хараахан хэн нэгэнд холбогдоогүй (эсвэл өөрийн) session-ийг
        // холбоно — өөр userId-тай session-ийг булаахгүй.
        where: { sessionId: sid, OR: [{ userId: null }, { userId: safe }] },
        data: { userId: safe },
      });
      return { ok: true, linked: res.count };
    } catch (e) {
      // Backfill амжилтгүй болсон ч нэвтрэлтэд нөлөөлөхгүй (best-effort).
      this.logger.warn(`linkSession failed: ${(e as Error).message}`);
      return { ok: true, linked: 0 };
    }
  }

  // ─── ХЭРЭГЛЭГЧ ТАЛД (frontend polling) ───────────────────────────────────────

  /**
   * Хэрэглэгчийн чат цонх нээлттэй үед polling — sessionId-ийн ШИНЭ мессежүүдийг
   * (after огнооноос хойш) татна. Ингэснээр admin гар хариу бичихэд хэрэглэгч
   * харна. handedOff төлөв + admin мессеж (role='admin')-ийг ялгаж буцаана.
   * Polling татах үед userUnreadCount=0 болгоно (хэрэглэгч харсан гэж үзнэ).
   */
  async getMessagesForUser(sessionId: string, afterIso?: string) {
    const sid = (sessionId ?? '').trim();
    if (!sid) return { handedOff: false, messages: [] };
    const conv = await this.prisma.chatConversation.findUnique({
      where: { sessionId: sid },
      select: { id: true, handedOff: true },
    });
    if (!conv) return { handedOff: false, messages: [] };

    const after = afterIso ? new Date(afterIso) : null;
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        conversationId: conv.id,
        ...(after && !Number.isNaN(after.getTime()) ? { createdAt: { gt: after } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { id: true, role: true, text: true, products: true, createdAt: true },
    });

    // Хэрэглэгч шинэ мессеж татсан = admin-ийн хариуг харсан → userUnread тэглэнэ.
    if (messages.some((m) => m.role === 'admin')) {
      await this.prisma.chatConversation
        .update({ where: { id: conv.id }, data: { userUnreadCount: 0 } })
        .catch(() => null);
    }
    return { handedOff: conv.handedOff, messages };
  }

  /** Floating badge — хэрэглэгчид хэдэн уншаагүй admin мессеж байгаа (chat хаалттай үед). */
  async getUserUnread(sessionId: string) {
    const sid = (sessionId ?? '').trim();
    if (!sid) return { unread: 0, handedOff: false };
    const conv = await this.prisma.chatConversation.findUnique({
      where: { sessionId: sid },
      select: { userUnreadCount: true, handedOff: true },
    });
    return { unread: conv?.userUnreadCount ?? 0, handedOff: conv?.handedOff ?? false };
  }

  // ─── ADMIN ТАЛД ──────────────────────────────────────────────────────────────

  /** Admin: бүх чат жагсаалт (pagination + уншаагүй/handedoff filter). */
  async listConversations(opts: { page?: number; pageSize?: number; onlyUnread?: boolean }) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));
    const where = opts.onlyUnread ? { adminUnread: true } : {};
    const [items, total, unreadTotal] = await Promise.all([
      this.prisma.chatConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, channel: true, sessionId: true, userName: true, userImage: true,
          adminUnread: true, handedOff: true, lastMessageAt: true,
          user: { select: { id: true, name: true, email: true, image: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { role: true, text: true, createdAt: true },
          },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.chatConversation.count({ where }),
      this.prisma.chatConversation.count({ where: { adminUnread: true } }),
    ]);
    return { items, total, unreadTotal, page, pageSize };
  }

  /** Admin: нэг чат дэлгэрэнгүй (нээхэд adminUnread=false). */
  async getConversation(id: string) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id },
      select: {
        id: true, channel: true, sessionId: true, userName: true, userImage: true,
        adminUnread: true, handedOff: true, lastMessageAt: true,
        user: { select: { id: true, name: true, email: true, image: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 200,
          select: { id: true, role: true, text: true, products: true, createdAt: true },
        },
      },
    });
    if (!conv) return null;
    // Нээхэд уншсан болгоно (badge цэвэрлэх).
    if (conv.adminUnread) {
      await this.prisma.chatConversation
        .update({ where: { id }, data: { adminUnread: false } })
        .catch(() => null);
    }
    return conv;
  }

  /**
   * Admin: гар хариу бичих (role='admin'). userUnreadCount++ (хэрэглэгч badge),
   * adminUnread=false (admin хариулсан). Дуудагч (controller) хэрэглэгчид
   * email/in-app notification илгээнэ (энд биш — DB логик л).
   */
  async adminReply(id: string, text: string) {
    const t = (text ?? '').trim().slice(0, MAX_TEXT_LENGTH);
    if (!t) return null;
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id },
      select: { id: true, sessionId: true, userId: true, channel: true },
    });
    if (!conv) return null;
    const msg = await this.prisma.chatMessage.create({
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
    // ⚠️ FB/IG хэрэглэгчид admin-ийн хариуг Messenger руу ШУУД илгээнэ
    // (sessionId = PSID). Web бол frontend polling-оор хүрнэ (FB send хэрэггүй).
    if (conv.channel === 'facebook' || conv.channel === 'instagram') {
      await this.sendFbMessage(conv.sessionId, t);
    }
    return { message: msg, sessionId: conv.sessionId, userId: conv.userId };
  }

  /** Admin: чат авах/AI-д буцаах toggle (handedOff). true=admin авна, AI унтарна. */
  async setHandoff(id: string, handedOff: boolean) {
    await this.prisma.chatConversation
      .update({ where: { id }, data: { handedOff, ...(handedOff ? { adminUnread: false } : {}) } })
      .catch(() => null);
    return { ok: true, handedOff };
  }
}
