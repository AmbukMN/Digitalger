'use client';

import { api } from './api';

/** n8n-ээс ирэх санал болгосон кино/цуврал */
export interface ChatTitleCard {
  id: string | null;
  title: string;
  slug: string;
  posterUrl?: string | null;
  url?: string | null;
  year?: number | null;
  rating?: number | null;
}

export interface ServerChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'admin';
  text: string;
  titles?: ChatTitleCard[] | null;
  createdAt: string;
}

/** Чат доторх холбоосын OG урьдчилан харах */
export interface ChatLinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

export const chatApi = {
  /**
   * Холбоосын зураг/гарчиг татна (Messenger шиг карт).
   *
   * ⚠️ Backend нь ЗӨВХӨН besttv.us домэйныг зөвшөөрнө (SSRF хамгаалалт),
   * бусад бүх URL-д `null` буцаана — карт харагдахгүй, линк текст хэвээр.
   */
  linkPreview: (url: string) =>
    api<ChatLinkPreview | null>(`/chat/link-preview?url=${encodeURIComponent(url)}`),

  /** Нэвтрэх үед зочны яриаг өөрийн бүртгэлд холбоно (JWT шаардана) */
  linkSession: (sessionId: string) =>
    api<{ ok: boolean; linked: number }>('/chat/link-session', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }),

  /**
   * Админы шинэ хариу татах (polling).
   *
   * ⚠️⚠️ `auth: true` ЗААВАЛ — эс бөгөөс НЭВТЭРСЭН хэрэглэгч
   * админы хариуг ХЭЗЭЭ Ч АВАХГҮЙ (бодит алдаа).
   *
   * Backend нь ярианы эзэмшлийг шалгадаг: `conv.userId != null` бол
   * ЗӨВХӨН тэр хүн уншина (sessionId задарсан ч бусад хүн уншихгүй).
   * `auth: false` байсан тул Authorization header ЯВААГҮЙ → backend
   * талд `meId = undefined` → эзэмшлийн шалгалт хаагаад `messages: []`
   * буцаана. Админ хариу бичсэн ч хэрэглэгч рүү хүрэхгүй байв.
   *
   * ⚠️ Зочинд аюулгүй: токен байхгүй бол `api()` нь header нэмэхгүй,
   * backend-ийн `OptionalJwtAuthGuard` зочноор үзнэ (хуучин зан хэвээр).
   */
  getMessages: (sessionId: string, after?: string) =>
    api<{ handedOff: boolean; messages: ServerChatMessage[] }>(
      `/chat/messages?sessionId=${encodeURIComponent(sessionId)}${
        after ? `&after=${encodeURIComponent(after)}` : ''
      }`,
    ),

  /** Уншаагүй тоо (чат хаалттай үед) — ⚠️ мөн адил токен ЗААВАЛ */
  getUnread: (sessionId: string) =>
    api<{ unread: number; handedOff: boolean }>(
      `/chat/unread?sessionId=${encodeURIComponent(sessionId)}`,
    ),

  /**
   * Handoff үед хэрэглэгчийн мессежийг шууд backend-д (n8n дамжуулахгүй).
   *
   * ⚠️ Токен ЗААВАЛ — backend нь `@CurrentUser()`-ээр яриаг хэрэглэгчид
   * ХОЛБОДОГ. Токенгүй бол яриа зочны хэвээр үлдэж, админд «Зочин»
   * гэж харагдана (хэн бэ гэдэг нь мэдэгдэхгүй).
   */
  saveMessage: (sessionId: string, role: 'user', text: string) =>
    api<{ ok: boolean }>('/chat/save', {
      method: 'POST',
      body: JSON.stringify({ sessionId, role, text, channel: 'web' }),
    }),
};
