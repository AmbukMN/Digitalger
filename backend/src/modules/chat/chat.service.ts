import { Injectable, Logger } from '@nestjs/common';
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
  userId?: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    const safeUserId = await this.safeUserId(input.userId);
    const now = new Date();

    // sessionId unique тул upsert — байхгүй бол create, байвал lastMessageAt
    // шинэчилж, userName/userId өгсөн бол set хийнэ (хуучин утгыг устгахгүй).
    const conversation = await this.prisma.chatConversation.upsert({
      where: { sessionId },
      create: {
        channel,
        sessionId,
        lastMessageAt: now,
        ...(userName ? { userName } : {}),
        ...(safeUserId ? { userId: safeUserId } : {}),
      },
      update: {
        lastMessageAt: now,
        ...(userName ? { userName } : {}),
        ...(safeUserId ? { userId: safeUserId } : {}),
      },
      select: { id: true },
    });

    await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role,
        text,
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
}
