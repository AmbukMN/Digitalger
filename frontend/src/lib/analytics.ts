'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// ─── Meta (Facebook) Pixel standard events ─────────────────────────────────
// Pixel-ийг admin SEO-д fbPixelId оруулсан үед layout.tsx ачаалдаг (window.fbq).
// fbq байхгүй (Pixel тохируулаагүй) бол чимээгүй алгасна — алдаа гарахгүй.
type Fbq = (action: string, event: string, params?: Record<string, unknown>) => void;
function fbqTrack(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (typeof fbq !== 'function') return;
  try {
    fbq('track', event, params);
  } catch {
    /* Pixel алдаа — үл хэрэгснэ */
  }
}

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = sessionStorage.getItem('dg_sid');
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('dg_sid', sid);
  }
  return sid;
}

// Navigation үед keepalive fetch найдваргүй — sendBeacon ашиглана
// sendBeacon нь GET дэмждэггүй, POST+Blob-той JSON дамжуулна
function send(endpoint: string, data: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const url = `${API_BASE}/api/analytics/${endpoint}`;
  const body = JSON.stringify({ ...data, sessionId: getSessionId() });
  const blob = new Blob([body], { type: 'application/json' });
  // sendBeacon нь page unload/navigate-д ч найдвартай ажилладаг
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, blob);
  } else {
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  }
}

export function trackPageView(path: string, referrer?: string) {
  send('pageview', { path, referrer: referrer ?? document.referrer });
}

// Meta Pixel-д үнэ дамжуулах туслах (MNT) — value+currency байвал conversion үнэ цэнэ
function priceParams(value?: number, productId?: string) {
  const p: Record<string, unknown> = { currency: 'MNT' };
  if (value != null && !Number.isNaN(value)) p.value = value;
  if (productId) p.content_ids = [productId];
  p.content_type = 'product';
  return p;
}

export function trackProductView(productId: string, productSlug: string, price?: number) {
  send('product-event', { type: 'view', productId, productSlug });
  fbqTrack('ViewContent', priceParams(price, productId));
}

export function trackProductClick(productId: string, productSlug: string) {
  send('product-event', { type: 'click', productId, productSlug });
}

export function trackAddToCart(productId: string, productSlug: string, price?: number) {
  send('product-event', { type: 'cart', productId, productSlug });
  fbqTrack('AddToCart', priceParams(price, productId));
}

export function trackAddToWishlist(productId: string, price?: number) {
  fbqTrack('AddToWishlist', priceParams(price, productId));
}

export function trackInitiateCheckout(value?: number, numItems?: number) {
  const p = priceParams(value);
  if (numItems != null) p.num_items = numItems;
  fbqTrack('InitiateCheckout', p);
}

export function trackPurchase(productId: string, productSlug: string, price?: number) {
  send('product-event', { type: 'purchase', productId, productSlug });
  // Purchase-д value+currency ЗААВАЛ (Meta conversion үнэ цэнэ)
  fbqTrack('Purchase', priceParams(price ?? 0, productId));
}

export function trackCompleteRegistration() {
  fbqTrack('CompleteRegistration');
}

export function trackContact() {
  fbqTrack('Contact');
}

export function trackSearch(query: string, results: number) {
  send('search', { query, results });
  fbqTrack('Search', { search_string: query });
}
