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

export const chatApi = {
  /** Нэвтрэх үед зочны яриаг өөрийн бүртгэлд холбоно (JWT шаардана) */
  linkSession: (sessionId: string) =>
    api<{ ok: boolean; linked: number }>('/chat/link-session', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }),

  /** Админы шинэ хариу татах (polling) */
  getMessages: (sessionId: string, after?: string) =>
    api<{ handedOff: boolean; messages: ServerChatMessage[] }>(
      `/chat/messages?sessionId=${encodeURIComponent(sessionId)}${
        after ? `&after=${encodeURIComponent(after)}` : ''
      }`,
      { auth: false },
    ),

  /** Уншаагүй тоо (чат хаалттай үед) */
  getUnread: (sessionId: string) =>
    api<{ unread: number; handedOff: boolean }>(
      `/chat/unread?sessionId=${encodeURIComponent(sessionId)}`,
      { auth: false },
    ),

  /** Handoff үед хэрэглэгчийн мессежийг шууд backend-д (n8n дамжуулахгүй) */
  saveMessage: (sessionId: string, role: 'user', text: string) =>
    api<{ ok: boolean }>('/chat/save', {
      method: 'POST',
      body: JSON.stringify({ sessionId, role, text, channel: 'web' }),
      auth: false,
    }),
};
