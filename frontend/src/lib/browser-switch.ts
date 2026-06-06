'use client';

import { isIOS, isAndroid } from '@/lib/download-helper';
import { transferApi } from '@/lib/api';
import { resetBackfillFlag } from '@/lib/analytics';

// ─── FB/IG → системийн браузар руу state дамжуулж шилжих ────────────────────
//
// FB/IG доторх браузар нь тусдаа cookie/storage орчинтой + файл татаж чаддаггүй.
// Тиймээс login/төлбөрийн өмнө системийн браузар (Safari/Chrome) руу шилжүүлнэ.
// Хэрэглэгчийн сагс/wishlist/coupon/guest-ийг backend-д түр хадгалж token авна,
// системийн браузар тэр token-оор state-ээ сэргээнэ — дахин сагслах шаардлагагүй.

// localStorage-аас бүх шилжүүлэх state-ийг цуглуулна.
function collectState(): Record<string, unknown> {
  if (typeof localStorage === 'undefined') return {};
  const read = (k: string) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  // raw (JSON биш) утгыг шууд унших — theme/chat-session нь энгийн string
  const raw = (k: string) => {
    try { return localStorage.getItem(k); } catch { return null; }
  };
  // Chat history payload-ийг багасгахын тулд сүүлийн 15 мессежээр тайрна.
  const chatHistory = read('dg-chat-history');
  const trimmedChat = Array.isArray(chatHistory) ? chatHistory.slice(-15) : chatHistory;

  // analytics sessionId (dg_sid) нь sessionStorage-д. Үүнийг дамжуулснаар
  // системийн браузарт нэвтрэхэд FB-д хийсэн үзэлт/дарсныг (тэр session-аар
  // бичигдсэн) хэрэглэгчид backfill-аар холбоно — эс бол FB-ийн tracking
  // алдагдана (шинэ браузарт шинэ sessionId үүснэ).
  let analyticsSid: string | null = null;
  try { analyticsSid = sessionStorage.getItem('dg_sid'); } catch { /* ignore */ }

  return {
    cart: read('digitalger-cart'),
    wishlist: read('digitalger-wishlist'),
    coupons: read('digitalger-coupons'),
    guest: read('digitalger-guest'),
    // FB браузарт хэрэглэгчийн үүсгэсэн бусад чухал state:
    chatSession: raw('dg-chat-session'),     // AI чатын session ID
    chatHistory: trimmedChat,                // AI чатын сүүлийн 15 мессеж
    theme: raw('digitalger-theme'),          // сонгосон өнгөний горим
    analyticsSid,                            // FB-ийн analytics sessionId (tracking backfill-д)
  };
}

// Системийн браузар руу URL-ийг нээхийг оролдоно (iOS x-safari / Android intent).
function openSystemBrowser(url: string) {
  if (isIOS()) {
    window.location.href = `x-safari-${url}`;
    return;
  }
  if (isAndroid()) {
    const noScheme = url.replace(/^https?:\/\//, '');
    window.location.href = `intent://${noScheme}#Intent;scheme=https;package=com.android.chrome;end`;
    return;
  }
  window.location.href = url;
}

/**
 * State-ийг backend-д хадгалж, системийн браузар руу шилжих URL үүсгэнэ.
 * @param targetPath шилжих зам (жиш: '/checkout', '/cart')
 * @returns { url } системийн браузарт нээх бүрэн URL (?t=token-той)
 */
export async function buildTransferUrl(targetPath: string): Promise<string> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://digitalger.mn');
  let token = '';
  try {
    const res = await transferApi.save(collectState());
    token = res.token;
  } catch {
    // backend амжилтгүй — token-гүй ч шилжүүлнэ (state дамжихгүй ч)
  }
  const sep = targetPath.includes('?') ? '&' : '?';
  const tokenPart = token ? `${sep}t=${token}` : '';
  return `${siteUrl}${targetPath}${tokenPart}`;
}

/**
 * State хадгалаад системийн браузар руу шилжихийг оролдоно (scheme-ээр).
 * @returns шилжүүлэх URL (modal-д "Линк хуулах"/"Нээх" товчинд ашиглана)
 */
export async function switchToSystemBrowser(targetPath: string): Promise<string> {
  const url = await buildTransferUrl(targetPath);
  openSystemBrowser(url);
  return url;
}

/**
 * Системийн браузарт ?t=token байвал backend-аас state сэргээж localStorage-д
 * бичнэ. providers-ийн mount дээр дуудна. Сэргээсэн бол true, эс бол false.
 */
export async function restoreTransferState(token: string): Promise<boolean> {
  try {
    const { payload } = await transferApi.consume(token);
    const data = payload as Record<string, unknown>;
    if (typeof localStorage === 'undefined' || !data) return false;
    // JSON object key-нүүд (Zustand persist) — JSON.stringify-аар бичнэ
    const write = (k: string, v: unknown) => {
      if (v != null) {
        try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
      }
    };
    // raw string key-нүүд (theme/chat-session) — шууд бичнэ
    const writeRaw = (k: string, v: unknown) => {
      if (typeof v === 'string' && v) {
        try { localStorage.setItem(k, v); } catch { /* ignore */ }
      }
    };
    // Сагс/wishlist/coupon: FB-ийх тэргүүлнэ (дарж бичнэ) — хэрэглэгч FB-д
    // сүүлд сагсалсан тул түүнийг хүссэн гэж үзнэ.
    write('digitalger-cart', data.cart);
    write('digitalger-wishlist', data.wishlist);
    write('digitalger-coupons', data.coupons);
    write('dg-chat-history', data.chatHistory);
    writeRaw('dg-chat-session', data.chatSession);
    writeRaw('digitalger-theme', data.theme);

    // FB-ийн analytics sessionId-ийг системийн браузарт хадгална (sessionStorage).
    // Ингэснээр энд нэвтрэхэд backfill нь FB-д хийсэн бүх үзэлт/дарсныг (тэр
    // session-аар бичигдсэн) хэрэглэгчид холбоно. Системд аль хэдийн dg_sid
    // байсан ч FB-ийнхээр сольно — FB-ийн tracking-ийг алдахгүйн тулд.
    if (typeof data.analyticsSid === 'string' && data.analyticsSid) {
      try { sessionStorage.setItem('dg_sid', data.analyticsSid); } catch { /* ignore */ }
      // sessionId солигдсон тул backfill дахин ажиллахаар flag reset (хэрэв
      // нэвтэрсэн хэрэглэгч шилжсэн бол хуучин sid-аар хийгдсэн байж магадгүй).
      resetBackfillFlag();
    }

    // ⚠️ GUEST CONFLICT: Системийн браузарт АЛЬ ХЭДИЙН guest session байгаа бол
    // FB-ийн guest-ийг ДАРЖ БИЧИХГҮЙ. Учир нь системийн браузарт нэвтэрсэн
    // хэрэглэгч (эсвэл өөрийн guest) байж магадгүй — түүнийг хадгална, FB зочны
    // account руу албадан шилжүүлэхгүй. Зөвхөн guest БАЙХГҮЙ (анх удаа) үед FB
    // guest-ийг авна.
    let hasLocalGuest = false;
    try { hasLocalGuest = !!localStorage.getItem('digitalger-guest'); } catch { /* ignore */ }
    if (!hasLocalGuest) {
      write('digitalger-guest', data.guest);
    }

    // Theme-ийг DOM-д ШУУД хэрэглэнэ — ThemeProvider mount-д аль хэдийн уншсан
    // тул localStorage бичсэн ч эхний рендерт үйлчлэхгүй. <html> class-ийг шууд
    // шинэчилснээр refresh-гүйгээр зөв горим харагдана.
    if (typeof data.theme === 'string' && typeof document !== 'undefined') {
      const root = document.documentElement;
      const resolved = data.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : data.theme;
      if (resolved === 'dark' || resolved === 'light') {
        root.classList.remove('light', 'dark');
        root.classList.add(resolved);
      }
    }
    return true;
  } catch {
    return false;
  }
}
