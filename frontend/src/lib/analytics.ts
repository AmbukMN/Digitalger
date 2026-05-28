'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = sessionStorage.getItem('dg_sid');
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('dg_sid', sid);
  }
  return sid;
}

function send(endpoint: string, data: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const url = `${API_BASE}/api/analytics/${endpoint}`;
  const body = JSON.stringify({ ...data, sessionId: getSessionId() });
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
  } else {
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  }
}

export function trackPageView(path: string, referrer?: string) {
  send('pageview', { path, referrer: referrer ?? document.referrer });
}

export function trackProductView(productId: string, productSlug: string) {
  send('product-event', { type: 'view', productId, productSlug });
}

export function trackProductClick(productId: string, productSlug: string) {
  send('product-event', { type: 'click', productId, productSlug });
}

export function trackAddToCart(productId: string, productSlug: string) {
  send('product-event', { type: 'cart', productId, productSlug });
}

export function trackPurchase(productId: string, productSlug: string) {
  send('product-event', { type: 'purchase', productId, productSlug });
}

export function trackSearch(query: string, results: number) {
  send('search', { query, results });
}
