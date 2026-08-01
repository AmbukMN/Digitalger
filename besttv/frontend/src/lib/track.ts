'use client';

// BestTV tracking клиент — хуудас зочиллого, кино үзэлт, хайлт бүртгэнэ.
// ⚠️ ЗАРЧИМ: tracking нь UI-г ХЭЗЭЭ Ч удаашруулж, унагаахгүй.
//   • Хүсэлт бүр "fire-and-forget" (хариу хүлээхгүй, алдаа залгина)
//   • Хуудас хаагдах агшинд ч хүрэхийн тулд `sendBeacon` эхэнд оролдоно
//   • Нэвтэрсэн бол JWT-г Authorization-оор дамжуулна (beacon-д боломжгүй тул fetch)

import { getAccessToken } from './api';

const SESSION_KEY = 'btv_session_id';

/** Browser session бүрд тогтмол ID — зочин хэрэглэгчийг ч мөрдөнө */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function send(path: string, payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const url = `/api/track/${path}`;
  const body = JSON.stringify({ ...payload, sessionId: getSessionId() });
  const token = getAccessToken();

  // Нэвтрээгүй үед beacon хамгийн найдвартай (хуудас хаагдсан ч явна).
  // Нэвтэрсэн үед header шаардлагатай тул fetch + keepalive.
  if (!token && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    } catch {
      /* доош fetch руу шилжинэ */
    }
  }

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    keepalive: true,
  }).catch(() => null); // ⚠️ алдааг залгина — UI-д нөлөөлөхгүй
}

/** Хуудас зочиллого */
export function trackPage(path: string) {
  send('page', {
    path,
    referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
  });
}

/** Кино/цуврал дээрх үйлдэл */
export function trackTitle(data: {
  type: 'view' | 'play' | 'progress' | 'complete' | 'mylist_add' | 'mylist_remove';
  titleId: string;
  titleSlug?: string;
  titleName?: string;
  episodeId?: string;
  positionSec?: number;
  durationSec?: number;
}) {
  send('title', data);
}

/** Хайлт */
export function trackSearch(query: string, results: number) {
  const q = query.trim();
  if (q.length < 2) return; // 1 үсгийн бичих явцыг бүртгэхгүй
  send('search', { query: q, results });
}
