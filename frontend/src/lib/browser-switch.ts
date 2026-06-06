'use client';

import { isIOS, isAndroid } from '@/lib/download-helper';
import { transferApi } from '@/lib/api';

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
  return {
    cart: read('digitalger-cart'),
    wishlist: read('digitalger-wishlist'),
    coupons: read('digitalger-coupons'),
    guest: read('digitalger-guest'),
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
    const write = (k: string, v: unknown) => {
      if (v != null) {
        try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
      }
    };
    write('digitalger-cart', data.cart);
    write('digitalger-wishlist', data.wishlist);
    write('digitalger-coupons', data.coupons);
    write('digitalger-guest', data.guest);
    return true;
  } catch {
    return false;
  }
}
