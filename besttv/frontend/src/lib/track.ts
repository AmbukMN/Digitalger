'use client';

// BestTV tracking клиент — хуудас зочиллого, кино үзэлт, хайлт бүртгэнэ.
// ⚠️ ЗАРЧИМ: tracking нь UI-г ХЭЗЭЭ Ч удаашруулж, унагаахгүй.
//   • Хүсэлт бүр "fire-and-forget" (хариу хүлээхгүй, алдаа залгина)
//   • Хуудас хаагдах агшинд ч хүрэхийн тулд `sendBeacon` эхэнд оролдоно
//   • Нэвтэрсэн бол JWT-г Authorization-оор дамжуулна (beacon-д боломжгүй тул fetch)

import { getAccessToken } from './api';

// ─── Meta (Facebook) Pixel ──────────────────────────────────────────────────
/**
 * ⚠️⚠️ ЯАГААД ЭНД БАЙНА ВЭ: `trackTitle`/`trackSearch`/`trackPage` нь
 * аль хэдийн бүх зөв газраас дуудагддаг. Pixel-ийг ТЭНД холбовол
 * шинэ дуудлага нэмэх шаардлагагүй бөгөөд дотоод аналитик, Pixel
 * хоёр ХЭЗЭЭ Ч зөрөхгүй (нэг эх сурвалж).
 *
 * ⚠️ `site: 'besttv'` параметр ЗААВАЛ — Pixel нь DigitalGer-тэй
 * ХУВААЛЦАГДАЖ байгаа (Meta нь акаунт тутамд нэг л dataset
 * зөвшөөрдөг). Custom Conversion үүсгэхэд энэ параметрээр шүүнэ,
 * ингэснээр хоёр бизнесийн ROAS, audience, оновчлол САЛАНГИД байна.
 *
 * ⚠️ Pixel тохируулаагүй (`window.fbq` алга) бол ЧИМЭЭГҮЙ алгасна —
 * аналитик нь нэмэлт боломж, түүнээс болж сайт унах ёсгүй.
 */
type Fbq = (action: string, event: string, params?: Record<string, unknown>) => void;

function fbq(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const f = (window as unknown as { fbq?: Fbq }).fbq;
  if (typeof f !== 'function') return;
  try {
    f('track', event, { site: 'besttv', ...params });
  } catch {
    /* Pixel алдаа — UI-д нөлөөлөхгүй */
  }
}

/**
 * Стандарт бус үйл явдал (`trackCustom`).
 *
 * ⚠️ Meta нь стандарт нэрсийг л оновчлолд ашигладаг. Кино үзэх нь
 * стандартад байхгүй тул custom — audience байгуулахад хэрэгтэй ч
 * оновчлолын зорилт болгож болохгүй.
 */
function fbqCustom(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const f = (window as unknown as { fbq?: Fbq }).fbq;
  if (typeof f !== 'function') return;
  try {
    f('trackCustom', event, { site: 'besttv', ...params });
  } catch {
    /* үл хэрэгснэ */
  }
}

const SESSION_KEY = 'btv_session_id';

/**
 * Browser session бүрд тогтмол ID — зочин хэрэглэгчийг ч мөрдөнө.
 *
 * ⚠️ localStorage АЛДАА ШИДЭЖ БОЛНО (Safari private mode, FB webview-д
 * storage хориглосон). Аналитик нь НЭМЭЛТ боломж — түүнээс болж хуудас
 * унах ёсгүй тул уншиж/бичихийг хамгаална. Storage хаалттай үед session
 * ID нь тухайн ачаалалтад л хүчинтэй (мөрдөлт бага зэрэг алдагдана,
 * гэхдээ сайт хэвийн ажиллана).
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id: string | null = null;
  try {
    id = localStorage.getItem(SESSION_KEY);
  } catch {
    /* storage хаалттай */
  }
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem(SESSION_KEY, id);
    } catch {
      /* хадгалж чадсангүй — энэ ачаалалтад л хүчинтэй */
    }
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

  /**
   * ⚠️ ЗӨВХӨН `view` нь Meta-гийн СТАНДАРТ `ViewContent`.
   *
   * `play`/`complete` нь стандартад байхгүй тул custom — эдгээрийг
   * оновчлолын зорилт болгож БОЛОХГҮЙ, гэхдээ retargeting audience
   * («кино эхлүүлсэн ч багц аваагүй») байгуулахад маш үнэтэй.
   *
   * ⚠️ `progress` илгээхгүй — 10 секунд тутам ирдэг тул Pixel-ийг
   * үерлүүлж, бодит дохиог дарна.
   */
  if (data.type === 'view') {
    fbq('ViewContent', {
      content_type: 'product',
      content_ids: [data.titleId],
      content_name: data.titleName,
    });
  } else if (data.type === 'play') {
    fbqCustom('PlayStart', { content_ids: [data.titleId], content_name: data.titleName });
  } else if (data.type === 'complete') {
    fbqCustom('PlayComplete', { content_ids: [data.titleId], content_name: data.titleName });
  } else if (data.type === 'mylist_add') {
    fbq('AddToWishlist', { content_ids: [data.titleId], content_name: data.titleName });
  }
}

/** Хайлт */
export function trackSearch(query: string, results: number) {
  const q = query.trim();
  if (q.length < 2) return; // 1 үсгийн бичих явцыг бүртгэхгүй
  send('search', { query: q, results });
  fbq('Search', { search_string: q, content_type: 'product' });
}

// ─── Худалдан авалтын юүлүүр ────────────────────────────────────────────────

/**
 * QPay QR үүсч, хэрэглэгч төлөх гэж эхэллээ.
 *
 * ⚠️ Meta-гийн СТАНДАРТ `InitiateCheckout` — оновчлолын зорилт болгож
 * болно. Хэмжсэн: QR үүсгэсний 29% нь төлөгдөлгүй хугацаа дуусдаг тул
 * энэ болон `Purchase`-ийн зөрүү нь бодит алдагдлыг харуулна.
 */
export function trackCheckoutStart(opts: {
  paymentId: string;
  amount?: number;
  /** «Монгол кино багц» эсвэл киноны нэр */
  itemName?: string;
  kind?: 'plan' | 'topup' | 'rental';
}) {
  fbq('InitiateCheckout', {
    value: opts.amount,
    currency: 'MNT',
    content_type: opts.kind === 'rental' ? 'product' : 'product_group',
    content_ids: [opts.paymentId],
    content_name: opts.itemName,
  });
}

/**
 * ⚠️⚠️ ТӨЛБӨР АМЖИЛТТАЙ — ХАМГИЙН ЧУХАЛ ҮЙЛ ЯВДАЛ.
 *
 * Meta нь энэ дохиогоор л «хэн худалдаж авдаг» гэдгийг сурдаг.
 * Үүнгүйгээр рекламын оновчлол ажиллахгүй, ROAS харагдахгүй.
 *
 * ⚠️ `value` болон `currency` ЗААВАЛ — эс бөгөөс Meta нь ROAS
 * тооцоолж чадахгүй, зөвхөн «конверси болсон» гэж л мэдэнэ.
 *
 * ⚠️ `eventID` — Conversions API нэмэх өдөр browser болон серверийн
 * хоёр дохиог ЭНЭ ID-аар дедуплекаци хийнэ. Одооноос илгээж
 * байвал тэр өдөр код өөрчлөх шаардлагагүй.
 */
export function trackPurchase(opts: {
  paymentId: string;
  amount?: number;
  itemName?: string;
  kind?: 'plan' | 'topup' | 'rental';
}) {
  fbq('Purchase', {
    value: opts.amount,
    currency: 'MNT',
    content_type: opts.kind === 'rental' ? 'product' : 'product_group',
    content_ids: [opts.paymentId],
    content_name: opts.itemName,
    eventID: opts.paymentId,
  });
}

/** Шинэ бүртгэл — audience байгуулах, оновчлолын зорилт болгож болно */
export function trackRegistration(method?: string) {
  fbq('CompleteRegistration', { status: true, method });
}
