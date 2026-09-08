/**
 * ⚠️⚠️ САЙТ ТАНИХ ЛОГИКИЙН ТЕСТ — `site.resolve.ts`.
 *
 * Энэ бол БҮХ шүүлтийн ЭХЛЭЛ. Энд буруу таньвал бүх өгөгдөл
 * буруу сайтад очно.
 *
 * ⚠️ DB, Redis ХЭРЭГГҮЙ — цэвэр функцийн тест.
 *
 * Ажиллуулах: node test/site/resolve.test.mjs
 */

/* ── site.constants.ts-ийн хуулбар ── */
const SITES = ['besttv', 'bestfilm'];
const DEFAULT_SITE = 'besttv';
const SITE_HEADER = 'x-site';
const SITE_DOMAIN = { besttv: 'besttv.us', bestfilm: 'bestfilm.net' };
const isSite = (v) => typeof v === 'string' && SITES.includes(v);
const ALL = 'all';

/* ── site.resolve.ts-ийн хуулбар ── */
function siteFromHost(host) {
  if (!host) return null;
  const clean = host.toLowerCase().split(':')[0];
  for (const [site, domain] of Object.entries(SITE_DOMAIN)) {
    if (clean === domain || clean.endsWith(`.${domain}`)) return site;
  }
  return null;
}
function siteFromUrl(value) {
  if (!value) return null;
  try {
    return siteFromHost(new URL(value).host);
  } catch {
    return null;
  }
}
function resolveSite(req) {
  const header = req.headers[SITE_HEADER];
  const raw = Array.isArray(header) ? header[0] : header;
  if (raw === ALL) return { site: DEFAULT_SITE, allSites: true };
  if (isSite(raw)) return { site: raw, allSites: false };
  const fromOrigin = siteFromUrl(req.headers.origin) ?? siteFromUrl(req.headers.referer);
  if (fromOrigin) return { site: fromOrigin, allSites: false };
  const fromHost = siteFromHost(req.headers.host);
  if (fromHost) return { site: fromHost, allSites: false };
  return { site: DEFAULT_SITE, allSites: false };
}

/* ── Тест ── */
let pass = 0, fail = 0;
const t = (name, headers, expectSite, expectAll = false) => {
  const r = resolveSite({ headers });
  const ok = r.site === expectSite && r.allSites === expectAll;
  console.log(
    `  ${ok ? '✅' : '❌'} ${name}${ok ? '' : ` — ${r.site}/${r.allSites} (${expectSite}/${expectAll} хүлээсэн)`}`,
  );
  ok ? pass++ : fail++;
};

console.log('\n╔═══ САЙТ ТАНИХ ТЕСТ ═══╗\n');

console.log('── 1. X-Site толгой (хамгийн итгэлтэй) ──');
t('X-Site: bestfilm', { 'x-site': 'bestfilm' }, 'bestfilm');
t('X-Site: besttv', { 'x-site': 'besttv' }, 'besttv');
t('X-Site: all → allSites', { 'x-site': 'all' }, 'besttv', true);
t('X-Site: буруу утга → besttv', { 'x-site': 'hacker' }, 'besttv');
t('X-Site массив (олон толгой)', { 'x-site': ['bestfilm', 'besttv'] }, 'bestfilm');

console.log('\n── 2. Origin (хөтчийн хандалт) ──');
t('Origin bestfilm.net', { origin: 'https://bestfilm.net' }, 'bestfilm');
t('Origin www.bestfilm.net', { origin: 'https://www.bestfilm.net' }, 'bestfilm');
t('Origin besttv.us', { origin: 'https://besttv.us' }, 'besttv');
t('Origin admin.besttv.us', { origin: 'https://admin.besttv.us' }, 'besttv');
t('Origin порттой', { origin: 'http://bestfilm.net:3102' }, 'bestfilm');

console.log('\n── 3. Referer (Origin байхгүй үед) ──');
t('Referer bestfilm', { referer: 'https://bestfilm.net/movies' }, 'bestfilm');
t('Origin давамгайлна', { origin: 'https://besttv.us', referer: 'https://bestfilm.net' }, 'besttv');

console.log('\n── 4. Host (шууд API хандалт) ──');
t('Host api.bestfilm.net', { host: 'api.bestfilm.net' }, 'bestfilm');
t('Host besttv.us', { host: 'besttv.us' }, 'besttv');

console.log('\n── 5. Fallback — одоогийн зан төлөв ХЭВЭЭР ──');
t('толгойгүй → besttv', {}, 'besttv');
t('docker дотоод host', { host: 'backend' }, 'besttv');
t('localhost', { host: 'localhost:4100' }, 'besttv');
t('QPay webhook (толгойгүй)', { host: 'api.besttv.us' }, 'besttv');

console.log('\n── 6. ⚠️ ХАМГААЛАЛТ — хуурамч домэйн ──');
t('bestfilm.net.evil.com', { origin: 'https://bestfilm.net.evil.com' }, 'besttv');
t('evilbestfilm.net', { origin: 'https://evilbestfilm.net' }, 'besttv');
t('bestfilm.net-evil.com', { origin: 'https://bestfilm.net-evil.com' }, 'besttv');
t('буруу URL', { origin: 'not-a-url' }, 'besttv');

console.log('\n── 7. Том/жижиг үсэг ──');
t('BESTFILM.NET', { origin: 'https://BESTFILM.NET' }, 'bestfilm');
t('X-Site: BestFilm (том үсэг) → besttv', { 'x-site': 'BestFilm' }, 'besttv');

console.log(`\n╚═══ ${pass} амжилттай · ${fail} унасан ═══╝\n`);
process.exit(fail ? 1 : 0);
