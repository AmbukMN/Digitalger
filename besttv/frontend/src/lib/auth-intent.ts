'use client';

/**
 * Нэвтрэлтийн "санамж" — хэрэглэгч ХААНА байсан, ЮУ хийх гэж байсныг хадгална.
 *
 * ⚠️ Асуудал: хэрэглэгч ямар нэг үйлдэл (багц авах, түрээслэх, сэтгэгдэл
 * бичих) хийх гэж байгаад нэвтрэх шаардлагатай болоход, нэвтэрсний дараа
 * нүүр хуудас руу шидэгдээд ЮУ хийж байснаа алддаг байсан.
 *
 * Шийдэл 2 давхар:
 *   1. `?next=` — буцаж очих ЗАМ (URL-д, OAuth redirect-ийг ч давна)
 *   2. sessionStorage дахь `intent` — тэр хуудсанд буцаж очмогц ҮРГЭЛЖЛҮҮЛЭХ
 *      үйлдэл (жишээ: "QPay-ээр энэ багцыг ав")
 *
 * sessionStorage сонгосон шалтгаан: таб хаагдвал устана (хуучирсан intent
 * дараа сарын дараа гэнэт ажиллахгүй), гэхдээ OAuth-ын гадаад redirect-ийг
 * давж үлдэнэ (localStorage шиг үүрд үлдэхгүй).
 */

const KEY = 'btv-auth-intent';
/** Хуучирсан intent-ийг үл тоомсорлох хугацаа (30 мин) */
const TTL_MS = 30 * 60 * 1000;

export type AuthIntent =
  | { type: 'buy-plan'; planId: string; method: 'wallet' | 'qpay'; couponCode?: string }
  | { type: 'rent-title'; titleId: string }
  | { type: 'topup'; amount: number };

interface StoredIntent {
  intent: AuthIntent;
  at: number;
}

/** Нэвтрэхийн өмнө "юу хийх гэж байсныг" хадгална */
export function saveAuthIntent(intent: AuthIntent) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ intent, at: Date.now() } satisfies StoredIntent));
  } catch {
    /* private mode — алгасна, зам (?next=) хэвээр ажиллана */
  }
}

/**
 * Хадгалсан үйлдлийг УНШААД ЦЭВЭРЛЭНЭ (нэг л удаа ажиллана).
 * Хугацаа хэтэрсэн бол null.
 */
export function consumeAuthIntent(): AuthIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as StoredIntent;
    if (!parsed?.intent || Date.now() - parsed.at > TTL_MS) return null;
    return parsed.intent;
  } catch {
    return null;
  }
}

export function clearAuthIntent() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* алгасна */
  }
}

/**
 * Одоогийн бүтэн зам (path + query + hash) — `?next=` утга болгоно.
 *
 * ⚠️ /login дээр байхад дахин /login-ыг next болгож ГОГЦОО үүсгэхгүй.
 */
export function currentPath(): string {
  if (typeof window === 'undefined') return '/';
  const { pathname, search, hash } = window.location;
  if (pathname.startsWith('/login')) {
    const existing = new URLSearchParams(search).get('next');
    return existing && existing.startsWith('/') && !existing.startsWith('//') ? existing : '/';
  }
  return `${pathname}${search}${hash}` || '/';
}

/**
 * Нэвтрэх хуудасны URL — буцах замыг агуулсан.
 * @param next буцаж очих зам (өгөхгүй бол одоогийн хуудас)
 */
export function loginUrl(next?: string): string {
  const target = next ?? currentPath();
  return target && target !== '/' ? `/login?next=${encodeURIComponent(target)}` : '/login';
}

/**
 * Нэвтрэх рүү явуулахын өмнө үйлдлийг хадгална.
 * @returns нэвтрэх хуудасны URL
 */
export function loginUrlWithIntent(intent: AuthIntent, next?: string): string {
  saveAuthIntent(intent);
  return loginUrl(next);
}

/* ─── Худалдан авалтын дараа буцах зам ───────────────────────────────────
 * ⚠️ Хэрэглэгч КИНО үзэх гэж багц/түрээс авахад төлбөр төлсний дараа
 * /pricing дээр үлдээд, өөрөө буцаж хайх шаардлагатай байсан.
 * Энэ нь тухайн киног санаж, эрх нээгдмэгц ТЭР КИНО руу нь буцаана.
 * ─────────────────────────────────────────────────────────────────────── */

const RETURN_KEY = 'btv-post-purchase-return';

/** Багц/түрээс авахаар /pricing руу явахын өмнө дуудна */
export function savePostPurchaseReturn(path?: string) {
  if (typeof window === 'undefined') return;
  const target = path ?? currentPath();
  // /pricing, /login руу буцаах нь утгагүй (гогцоо үүснэ)
  if (!target.startsWith('/') || /^\/(pricing|login)/.test(target)) return;
  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ path: target, at: Date.now() }));
  } catch {
    /* private mode — алгасна */
  }
}

/** Уншаад ЦЭВЭРЛЭНЭ (нэг л удаа). Хугацаа хэтэрсэн бол null. */
export function consumePostPurchaseReturn(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RETURN_KEY);
    const parsed = JSON.parse(raw) as { path: string; at: number };
    if (!parsed?.path || Date.now() - parsed.at > TTL_MS) return null;
    // ⚠️ Зөвхөн дотоод зам — нээлттэй чиглүүлэлтээс сэргийлнэ
    return parsed.path.startsWith('/') && !parsed.path.startsWith('//') ? parsed.path : null;
  } catch {
    return null;
  }
}
