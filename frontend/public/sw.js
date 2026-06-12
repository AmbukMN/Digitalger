/* DigitalGer Service Worker
 * Стратеги:
 *  - Navigation (HTML) → network-first, fail бол offline.html fallback (шинэ deploy шууд харагдана)
 *  - Static (_next/static, зураг, font) → cache-first + stale-while-revalidate (хурдан)
 *  - API (/api/) → network-only (кэшлэхгүй, шинэ дата)
 *  - Auth/payment/library динамик хуудас → кэшлэхгүй (зөвхөн навигацийн offline fallback)
 *
 * Deploy бүрд CACHE_NAME version-ийг ахиулна (dg-v1 → dg-v2 …) → хуучин cache автоматаар цэвэрлэгдэнэ.
 */

const CACHE_NAME = 'dg-v1';
const OFFLINE_URL = '/offline.html';

// Install үед precache хийх гол static (offline тул заавал бэлэн байх ёстой зүйлс)
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.json',
  '/brand/logo-color.png',
  '/brand/icon-192.png',
];

// ── INSTALL: precache + шинэ SW шууд идэвхжүүлэх ────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Нэг файл татагдахгүй байсан ч install бүтэлгүйтэхгүй (хувь хувиар нэмнэ)
      await Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' }))),
      );
    })(),
  );
  self.skipWaiting();
});

// ── ACTIVATE: хуучин cache цэвэрлэх + одоо байгаа client-уудыг шууд эзэмших ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// Кэшлэхгүй динамик зам (auth/payment/library — хувийн/мэдрэмтгий дата)
function isSensitivePath(pathname) {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/payment') ||
    pathname.startsWith('/library') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/orders')
  );
}

// Cache-first хийх static asset эсэх (_next/static, зураг, font)
function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/brand/') ||
    /\.(?:js|css|woff2?|ttf|otf|eot|png|jpe?g|svg|gif|webp|avif|ico)$/i.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Зөвхөн GET кэшлэнэ; бусдыг (POST/PUT…) шууд сүлжээгээр явуулна
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Зөвхөн өөрийн origin-ийг л боловсруулна (CDN/гадаад domain-д хүрэхгүй)
  if (url.origin !== self.location.origin) return;

  // 1) API → network-only (кэшлэхгүй)
  if (url.pathname.startsWith('/api/')) return;

  // 2) Navigation (HTML хуудас) → network-first, fail бол offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(request);
          return network;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ||
            new Response('Офлайн байна', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
        }
      })(),
    );
    return;
  }

  // 3) Мэдрэмтгий зам → шууд сүлжээ (кэшлэхгүй)
  if (isSensitivePath(url.pathname)) return;

  // 4) Static asset → cache-first + stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);

        const networkFetch = fetch(request)
          .then((response) => {
            // Зөвхөн амжилттай (200, basic) хариуг кэшлэнэ
            if (response && response.status === 200 && response.type === 'basic') {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => null);

        // Кэшэнд байвал шууд буцаана, дэвсгэрт шинэчилнэ (SWR)
        return cached || (await networkFetch) || Response.error();
      })(),
    );
    return;
  }

  // 5) Бусад GET → шууд сүлжээ (кэшлэхгүй)
});

// Шинэ SW-г шууд идэвхжүүлэх мессеж (frontend-аас илгээж болно)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
