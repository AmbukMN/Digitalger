import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/**
 * ДЭМЖЛЭГИЙН ЧАТ.
 *
 * ⚠️ Вэбтэй ЯГ ИЖИЛ урсгал: `sessionId` + 6 сек polling. Backend нэг
 * бөгөөд n8n AI туслах хоёуланд нь хариулна (нэг эх сурвалж).
 */

const KEY = 'btv_chat_session';

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'admin';
  text: string;
  createdAt: string;
  titles?: { id: string; title: string; slug: string; posterUrl?: string | null }[];
}

/**
 * ⚠️⚠️ `sessionId` нь ХАМГААЛАЛТЫН ХИЛ — үүнийг мэдсэн хүн тухайн
 * ярианы БҮХ мессежийг уншина.
 *
 * `Math.random()` нь криптографийн хувьд найдваргүй (үр дүнг таамаглах
 * боломжтой) тул `expo-crypto`-гийн UUID ашиглана.
 *
 * ⚠️ `SecureStore`-д хадгална — гарсан ч яриа хэвээр (вэбийн
 * `localStorage`-тай ижил зарчим).
 */
export async function getSessionId(): Promise<string> {
  try {
    const cur = await SecureStore.getItemAsync(KEY);
    if (cur) return cur;
    const fresh = 'app_' + Crypto.randomUUID().replace(/-/g, '');
    await SecureStore.setItemAsync(KEY, fresh);
    return fresh;
  } catch {
    /* ⚠️ SecureStore унавал түр session — яриа хадгалагдахгүй ч
       чат ажиллана (бүрэн эвдрэхээс дээр) */
    return 'app_tmp_' + Crypto.randomUUID().replace(/-/g, '');
  }
}

/** Ярианы түүх — 6 сек тутам шинэчилнэ */
export function useChatMessages(enabled: boolean) {
  return useQuery({
    queryKey: ['chat-messages'],
    queryFn: async () => {
      const sid = await getSessionId();
      return api<{ messages: ChatMsg[]; handedOff: boolean }>(
        `/chat/messages?sessionId=${encodeURIComponent(sid)}`,
      );
    },
    enabled,
    /* ⚠️ 6 сек — вэбтэй ижил. Богино бол батарей иднэ, урт бол
       админы хариу удаан ирнэ. */
    refetchInterval: enabled ? 6000 : false,
    staleTime: 0,
  });
}

/** Зурвас илгээх */
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      const sid = await getSessionId();
      return api('/chat/save', {
        method: 'POST',
        body: JSON.stringify({
          channel: 'app',
          sessionId: sid,
          text,
        }),
      });
    },
    /* ⚠️ Илгээмэгц шинэчилнэ — өөрийн зурвас шууд харагдана */
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['chat-messages'] }),
  });
}

/**
 * ⚠️ Нэвтэрсэн үед session-ыг бүртгэлтэй хэрэглэгчтэй ХОЛБОНО —
 * админ хэнтэй ярьж байгааг мэдэх ёстой.
 */
export async function linkChatSession(): Promise<void> {
  try {
    const sid = await getSessionId();
    await api('/chat/link-session', {
      method: 'POST',
      body: JSON.stringify({ sessionId: sid }),
    });
  } catch {
    /* Нэвтрээгүй эсвэл сүлжээгүй — чат зочноор ажиллана */
  }
}
