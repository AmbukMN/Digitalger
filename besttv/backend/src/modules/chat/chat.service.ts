import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const ALLOWED_CHANNELS = new Set(['web']);
const ALLOWED_ROLES = new Set(['user', 'assistant', 'admin']);
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
  async getMessagesForUser(sessionId: string, after?: string) {
    const sid = (sessionId ?? '').trim().slice(0, 64);
    if (!sid) return { handedOff: false, messages: [] };

    const conv = await this.prisma.chatConversation
      .findUnique({
        where: { sessionId: sid },
        select: { id: true, handedOff: true, userUnreadCount: true },
      })
      .catch(() => null);
    if (!conv) return { handedOff: false, messages: [] };

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

  async getUnreadForUser(sessionId: string) {
    const sid = (sessionId ?? '').trim().slice(0, 64);
    if (!sid) return { unread: 0, handedOff: false };
    const conv = await this.prisma.chatConversation
      .findUnique({
        where: { sessionId: sid },
        select: { userUnreadCount: true, handedOff: true },
      })
      .catch(() => null);
    return { unread: conv?.userUnreadCount ?? 0, handedOff: conv?.handedOff ?? false };
  }

  // ─── Админ ────────────────────────────────────────────────────────────────

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
        include: {
          user: { select: { id: true, name: true, email: true, avatarKey: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { text: true, role: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.chatConversation.count({ where }),
      this.prisma.chatConversation.count({ where: { adminUnread: true } }),
    ]);

    return { items, total, unreadTotal, page, pageSize };
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
      select: { id: true, userId: true, sessionId: true },
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

    return { ok: true as const, message, userId: conv.userId };
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
