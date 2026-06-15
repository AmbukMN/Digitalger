'use client';

import { getSession, signIn } from 'next-auth/react';
import { isIOS, isAndroid } from '@/lib/download-helper';
import { transferApi } from '@/lib/api';
import { resetBackfillFlag } from '@/lib/analytics';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import { useCouponStore } from '@/store/coupon';
import type { AppliedCoupon } from '@/store/coupon';
import type { ProductSummary } from '@/types/api';

interface RawCartItem {
  productId?: unknown;
  slug?: unknown;
  title?: unknown;
  price?: unknown;
  compareAtPrice?: unknown;
  thumbnailUrl?: unknown;
  couponCodes?: unknown;
  couponDiscount?: unknown;
}

// FB-ээс дамжсан cart дата нь Zustand persist wrapper ({ state: { items }, version })
// эсвэл шууд { items } байж магадгүй — хоёуланг шалгаж items массивыг гаргана.
// Буруу/бохир бол хоосон массив.
function extractCartItems(raw: unknown): RawCartItem[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  // persist wrapper: { state: { items: [...] }, version }
  const state = obj.state && typeof obj.state === 'object' ? (obj.state as Record<string, unknown>) : obj;
  const items = (state as Record<string, unknown>).items;
  if (!Array.isArray(items)) return [];
  return items.filter(
    (i): i is RawCartItem =>
      !!i && typeof i === 'object' && typeof (i as RawCartItem).productId === 'string',
  );
}

// FB-ээс дамжсан wishlist (Zustand persist wrapper эсвэл шууд)-аас items массивыг
// гаргана. Бохир/буруу элементийг (id-гүй) хасна — crash сэргийлнэ.
function extractWishlistItems(raw: unknown): ProductSummary[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  const state = obj.state && typeof obj.state === 'object' ? (obj.state as Record<string, unknown>) : obj;
  const items = (state as Record<string, unknown>).items;
  if (!Array.isArray(items)) return [];
  return items.filter(
    (i): i is ProductSummary =>
      !!i && typeof i === 'object' && typeof (i as ProductSummary).id === 'string',
  );
}

// FB-ээс дамжсан coupon map (Zustand persist wrapper эсвэл шууд)-аас
// Record<productId, AppliedCoupon[]>-ийг гаргана. Бохир бол хоосон объект.
function extractCouponMap(raw: unknown): Record<string, AppliedCoupon[]> {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const state = obj.state && typeof obj.state === 'object' ? (obj.state as Record<string, unknown>) : obj;
  const coupons = (state as Record<string, unknown>).coupons;
  if (!coupons || typeof coupons !== 'object' || Array.isArray(coupons)) return {};
  const out: Record<string, AppliedCoupon[]> = {};
  for (const [k, v] of Object.entries(coupons as Record<string, unknown>)) {
    if (Array.isArray(v)) out[k] = v as AppliedCoupon[];
  }
  return out;
}

// FB-ээс дамжсан, нэгтгэхээр хүлээгдэж буй сагсны items. restoreTransferState
// бэлдэж тавьна, rehydrate дууссаны дараа consumePendingCartMerge ажиллуулна.
type StoreCartItem = Parameters<ReturnType<typeof useCartStore.getState>['mergeFront']>[0][number];
let pendingCartMerge: StoreCartItem[] | null = null;

/**
 * rehydrate дууссаны ДАРАА дуудна. FB-ээс дамжсан сагсыг (хадгалагдсан бол)
 * одоогийн (rehydrate хийгдсэн) сагстай нэгтгэнэ — FB-гийнх ЭХЭНД, давхардлыг
 * productId-аар арилгана. Store action ашигладаг тул аюулгүй (бохир дата биш).
 */
export function consumePendingCartMerge(): void {
  if (!pendingCartMerge || !pendingCartMerge.length) {
    pendingCartMerge = null;
    return;
  }
  try {
    useCartStore.getState().mergeFront(pendingCartMerge);
  } catch (e) {
    console.error('[consumePendingCartMerge] failed', e);
  } finally {
    pendingCartMerge = null;
  }
}

// FB-ээс дамжсан, нэгтгэхээр хүлээгдэж буй wishlist/coupon. Cart-тай адил
// rehydrate дууссаны ДАРАА consume хийнэ (дарж бичихгүй, нэгтгэнэ).
let pendingWishlistMerge: ProductSummary[] | null = null;
let pendingCouponMerge: Record<string, AppliedCoupon[]> | null = null;

/** rehydrate-ийн ДАРАА: FB wishlist-ийг одоогийнхтой нэгтгэнэ (FB-гийнх ЭХЭНД). */
export function consumePendingWishlistMerge(): void {
  if (!pendingWishlistMerge || !pendingWishlistMerge.length) {
    pendingWishlistMerge = null;
    return;
  }
  try {
    useWishlistStore.getState().mergeFront(pendingWishlistMerge);
  } catch (e) {
    console.error('[consumePendingWishlistMerge] failed', e);
  } finally {
    pendingWishlistMerge = null;
  }
}

/** rehydrate-ийн ДАРАА: FB coupon-ийг одоогийнхтой нэгтгэнэ (FB-гийнх ЭХЭНД). */
export function consumePendingCouponMerge(): void {
  if (!pendingCouponMerge || !Object.keys(pendingCouponMerge).length) {
    pendingCouponMerge = null;
    return;
  }
  try {
    useCouponStore.getState().mergeFront(pendingCouponMerge);
  } catch (e) {
    console.error('[consumePendingCouponMerge] failed', e);
  } finally {
    pendingCouponMerge = null;
  }
}

// ─── FB/IG → системийн браузар руу state дамжуулж шилжих ────────────────────
//
// FB/IG доторх браузар нь тусдаа cookie/storage орчинтой + файл татаж чаддаггүй.
// Тиймээс login/төлбөрийн өмнө системийн браузар (Safari/Chrome) руу шилжүүлнэ.
// Хэрэглэгчийн сагс/wishlist/coupon/guest-ийг backend-д түр хадгалж token авна,
// системийн браузар тэр token-оор state-ээ сэргээнэ — дахин сагслах шаардлагагүй.

// localStorage-аас бүх шилжүүлэх state + нэвтэрсэн session token-ийг цуглуулна.
// async — NextAuth session-ийг getSession()-аар авах тул.
async function collectState(): Promise<Record<string, unknown>> {
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

  // ── SESSION TOKEN: FB webview-д нэвтэрсэн бол refreshToken-ийг дамжуулна. ──
  // Системийн браузар энэ refreshToken-оор автомат нэвтэрнэ (дахин нэвтрэхгүй).
  // ⚠️ Аюулгүй: refreshToken backend TransferState (30мин TTL)-д хадгалагдана,
  // URL-д ил гарахгүй (?t=transferToken л явна). Браузарт нэвтрэхэд /auth/refresh
  // дуудагдаж шинэ token rotate хийгдэнэ (хуучин нь хүчингүй болно).
  let refreshToken: string | null = null;
  try {
    const session = await getSession();
    refreshToken = (session as { refreshToken?: string } | null)?.refreshToken ?? null;
  } catch { /* нэвтрээгүй эсвэл session авч чадсангүй — token-гүй дамжина */ }

  return {
    cart: read('digitalger-cart'),
    wishlist: read('digitalger-wishlist'),
    coupons: read('digitalger-coupons'),
    recentlyViewed: read('digitalger-recently-viewed'), // "Таны саяхан үзсэн"
    guest: read('digitalger-guest'),
    // FB браузарт хэрэглэгчийн үүсгэсэн бусад чухал state:
    chatSession: raw('dg-chat-session'),     // AI чатын session ID
    chatHistory: trimmedChat,                // AI чатын сүүлийн 15 мессеж
    theme: raw('digitalger-theme'),          // сонгосон өнгөний горим
    analyticsSid,                            // FB-ийн analytics sessionId (tracking backfill-д)
    refreshToken,                            // нэвтэрсэн session token (auto re-login)
  };
}

// Системийн браузар руу URL-ийг нээхийг оролдоно.
// ⚠️ Тодорхой апп (Chrome/Safari) ЗААХГҮЙ — хэрэглэгчийн DEFAULT browser автоматаар
// сонгогдоно (Chrome байхгүй ч Samsung Internet/Firefox-оор нээгдэнэ).
function openSystemBrowser(url: string) {
  if (isAndroid()) {
    // Android intent — package ЗААХГҮЙ тул систем default browser-ийг сонгоно.
    // S.browser_fallback_url — intent ажиллахгүй бол энгийн URL руу унана.
    const noScheme = url.replace(/^https?:\/\//, '');
    const fallback = encodeURIComponent(url);
    window.location.href =
      `intent://${noScheme}#Intent;scheme=https;` +
      `S.browser_fallback_url=${fallback};end`;
    return;
  }
  if (isIOS()) {
    // iOS хувилбараар scheme өөр ажилладаг:
    //  - iOS 16+ (iPhone14/15/16): x-safari- / mobilesafari-tab: АЖИЛЛАНА → шууд шилжинэ.
    //  - iOS 15 (iPhone7): scheme "Open app?" асуугаад НЭЭХГҮЙ → modal-ийн заавар руу унана.
    // Тиймээс scheme-ийг туршина (iOS16+ нэг товшилтоор шилжинэ), iOS15-д
    // ажиллахгүй бол modal handleSwitch 1.5с дараа зааврыг тод харуулна.
    try {
      window.location.href = `com-apple-mobilesafari-tab:${url}`;
    } catch { /* доош унана */ }
    setTimeout(() => {
      try { window.location.href = `x-safari-${url}`; } catch { /* modal fallback */ }
    }, 400);
    return;
  }
  window.location.href = url;
}

// ── Линк хуулах — 3 түвшний fallback (FB webview/iOS15-д clipboard унадаг) ──
// 1) navigator.clipboard (орчин үеийн), 2) document.execCommand('copy') (хуучин),
// 3) хоёул унавал false → дуудагч линкийг дэлгэцэнд харуулж гар сонголт өгнө.
// Ингэснээр ЯМАР Ч тохиолдолд хэрэглэгч линкгүй гацахгүй.
export async function copyLinkRobust(text: string): Promise<boolean> {
  // 1) Орчин үеийн API (HTTPS + permission)
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* доош унана */ }
  // 2) Хуучин execCommand (FB webview/iOS15-д ажилладаг)
  try {
    if (typeof document !== 'undefined') {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.setAttribute('readonly', '');
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length); // iOS-д заавал
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) return true;
    }
  } catch { /* доош унана */ }
  // 3) Хоёул унасан — дуудагч линкийг харуулна
  return false;
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
    const res = await transferApi.save(await collectState());
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
    // Сагс: FB-гийн сагсыг ДАРЖ БИЧИХГҮЙ, НЭГТГЭНЭ. FB-гийнхийг ЭХЭНД тавьж,
    // Safari-д өмнө байсан (FB-д байхгүй) бүтээгдэхүүнийг араас нь хадгална.
    // ⚠️ Энд cart-ийг localStorage-д шууд бичихгүй — rehydrate (StoreHydration
    // finally) ДАРААНЬ ажилладаг тул FB items-ийг түр хадгалж, rehydrate
    // дууссаны дараа mergeFront action-аар нэгтгэнэ (доорх consumePendingCartMerge).
    try {
      const fbItems = extractCartItems(data.cart);
      if (fbItems.length) {
        pendingCartMerge = fbItems.map((i) => ({
          productId: String(i.productId),
          slug: typeof i.slug === 'string' ? i.slug : '',
          title: typeof i.title === 'string' ? i.title : '',
          price: Number(i.price) || 0,
          compareAtPrice:
            i.compareAtPrice == null ? null : Number(i.compareAtPrice) || null,
          thumbnailUrl: typeof i.thumbnailUrl === 'string' ? i.thumbnailUrl : null,
          ...(Array.isArray(i.couponCodes) ? { couponCodes: i.couponCodes as string[] } : {}),
          ...(typeof i.couponDiscount === 'number' ? { couponDiscount: i.couponDiscount } : {}),
        }));
      }
    } catch (e) {
      console.error('[restoreTransferState] cart merge prepare failed', e);
    }

    // Wishlist: cart-тай адил ДАРЖ БИЧИХГҮЙ, НЭГТГЭНЭ. FB-гийн favourite-ийг
    // ЭХЭНД тавьж, браузарт өмнө байсан (FB-д байхгүй) wishlist-ийг хадгална.
    // localStorage-д шууд бичихгүй — rehydrate ДАРААНЬ ажилладаг тул түр хадгалж,
    // rehydrate дууссаны дараа mergeFront action-аар нэгтгэнэ.
    try {
      const fbWishlist = extractWishlistItems(data.wishlist);
      if (fbWishlist.length) pendingWishlistMerge = fbWishlist;
    } catch (e) {
      console.error('[restoreTransferState] wishlist merge prepare failed', e);
    }

    // Coupon: мөн адил НЭГТГЭНЭ (product тус бүрд FB код ЭХЭНД, давхардалгүй).
    try {
      const fbCoupons = extractCouponMap(data.coupons);
      if (Object.keys(fbCoupons).length) pendingCouponMerge = fbCoupons;
    } catch (e) {
      console.error('[restoreTransferState] coupon merge prepare failed', e);
    }

    write('dg-chat-history', data.chatHistory);
    writeRaw('dg-chat-session', data.chatSession);
    writeRaw('digitalger-theme', data.theme);
    // "Таны саяхан үзсэн" — FB-д үзсэн бүтээгдэхүүн шинэ браузарт дамжина.
    // localStorage-д өмнө байхгүй (шинэ браузар) бол шууд бичнэ; rehydrate
    // дараа нь уншина. (Merge хийхгүй — recently-viewed нь түр түүх тул дарж бичнэ.)
    if (data.recentlyViewed != null) {
      try {
        const existing = localStorage.getItem('digitalger-recently-viewed');
        if (!existing) localStorage.setItem('digitalger-recently-viewed', JSON.stringify(data.recentlyViewed));
      } catch { /* ignore */ }
    }

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

    // ── SESSION TOKEN: refreshToken дамжсан бол автомат нэвтрүүлнэ (дахин нэвтрэхгүй) ──
    // ⚠️ Системийн браузарт АЛЬ ХЭДИЙН нэвтэрсэн (өөр) хэрэглэгч байвал ДАРЖ
    // нэвтрэхгүй — түүний session-ийг хадгална (guest conflict логиктой адил).
    // Зөвхөн нэвтрээгүй (зочин) үед л FB-ийн session-ийг сэргээнэ.
    if (typeof data.refreshToken === 'string' && data.refreshToken) {
      try {
        const current = await getSession();
        if (!current?.accessToken) {
          // CredentialsProvider-ийн "transfer" режим — refreshToken-оор session
          // гаргана (password шаардахгүй). redirect:false — SPA-д хэвээр үлдэнэ.
          await signIn('credentials', {
            transferRefreshToken: data.refreshToken,
            redirect: false,
          });
        }
      } catch (e) {
        console.error('[restoreTransferState] auto re-login failed', e);
      }
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
