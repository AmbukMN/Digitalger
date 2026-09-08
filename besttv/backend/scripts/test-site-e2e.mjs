#!/usr/bin/env node
/**
 * САЙТЫН ТУСГААРЛАЛТЫН БҮРЭН E2E ТЕСТ — production дээр.
 *
 * ⚠️⚠️ ЗАРЧИМ:
 *   1. BestTV бол PRODUCTION — эвдэрсэн эсэхийг БҮХ шатанд шалгана
 *   2. Юу ч ҮҮСГЭХГҮЙ, ҮЛДЭЭХГҮЙ — өөрчилсөн бүхнээ СЭРГЭЭНЭ
 *   3. Сэргээлт бүтэлгүйтвэл ЧАНГА хашгирна (чимээгүй өнгөрөхгүй)
 *
 * Хамрах хүрээ:
 *   A. Нийтийн API — кэшийн тусгаарлалт
 *   B. Админ API — өгөгдөл зөрөх эсэх
 *   C. Title.sites — нэмэх/хасах/хамгаалалт
 *   D. Чатбот — брэнд/домэйн/карт
 *   E. Нэвтрэлт — сайт хооронд нэвтэрч БОЛОХГҮЙ
 *   F. SEO — canonical/og домэйн
 *
 * Хэрэглэх: node scripts/test-site-e2e.mjs
 */

const TV = 'https://besttv.us';
const BF = 'https://bestfilm.net';
const ADMIN_EMAIL = 'admin@besttv.mn';
const ADMIN_PASS = 'Mongol.,123';

let pass = 0;
let fail = 0;
const failures = [];

const ck = (name, ok, detail = '') => {
  ok ? pass++ : fail++;
  if (!ok) failures.push(`${name} — ${detail}`);
  console.log(`  ${ok ? '✅' : '❌'} ${name.padEnd(48)} ${detail}`);
};

const J = async (url, opts = {}) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(30_000), ...opts });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch { /* HTML буцаасан байж болно */ }
  return { status: r.status, ok: r.ok, json: j, text: t };
};
const arr = (j) => (Array.isArray(j) ? j : (j?.items ?? j?.data ?? []));

/* ─────────────────────────────────────────────────────────────
   A. НИЙТИЙН API — кэш тусгаарлагдсан уу
   ───────────────────────────────────────────────────────────── */

console.log('\n═══ A. Нийтийн API (кэшийн тусгаарлалт) ═══');

for (const ep of ['plans', 'banners', 'blog']) {
  const [a, b] = await Promise.all([J(`${BF}/api/${ep}`), J(`${TV}/api/${ep}`)]);
  const ia = arr(a.json).map((x) => x.id);
  const ib = arr(b.json).map((x) => x.id);
  const dup = ia.filter((x) => ib.includes(x));
  ck(`/${ep} давхардалгүй`, dup.length === 0, `bf=${ia.length} tv=${ib.length} давхцал=${dup.length}`);
}

/* ⚠️ Жанр/FAQ нь ХУВААЛЦСАН — давхцах нь ЗӨВ */
for (const ep of ['genres', 'faqs']) {
  const a = await J(`${BF}/api/${ep}`);
  ck(`/${ep} хуваалцсан (хоосон биш)`, arr(a.json).length > 0, `${arr(a.json).length} мөр`);
}

/* ─────────────────────────────────────────────────────────────
   B. АДМИН API
   ───────────────────────────────────────────────────────────── */

console.log('\n═══ B. Админ API ═══');

const login = await J(`${TV}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
});
ck('админ нэвтрэлт', login.ok, `${login.status}`);
if (!login.ok) {
  console.error('\n⛔ Нэвтэрч чадсангүй — үлдсэн тестийг алгаслаа');
  process.exit(1);
}
const TOKEN = login.json.accessToken;
const H = (site, extra = {}) => ({
  Authorization: `Bearer ${TOKEN}`,
  'x-site': site,
  'Content-Type': 'application/json',
  ...extra,
});
const A = (path, site, opts = {}) => J(`${TV}/api${path}`, { headers: H(site), ...opts });

for (const ep of ['/admin/pages', '/admin/banners', '/admin/blog', '/admin/plans',
                  '/admin/genres', '/admin/notifications/last-seen']) {
  const t0 = Date.now();
  const [a, b] = await Promise.all([A(ep, 'besttv'), A(ep, 'bestfilm')]);
  const ms = Date.now() - t0;
  ck(`${ep}`, a.ok && b.ok && ms < 4000, `tv=${a.status} bf=${b.status} ${ms}ms`);
}

/* ⚠️ Жанрын `isVisible` талбар ирж байна уу (сайт бүрийн харагдац) */
const g = await A('/admin/genres', 'bestfilm');
ck('жанрт `isVisible` ирнэ', arr(g.json).every((x) => x.isVisible !== undefined),
  `${arr(g.json).length} жанр`);

/* ─────────────────────────────────────────────────────────────
   C. Title.sites — ХАМГИЙН ЭРСДЭЛТЭЙ ХЭСЭГ
   ───────────────────────────────────────────────────────────── */

console.log('\n═══ C. Title.sites (нэмэх / хасах / хамгаалалт) ═══');

const list = await A('/admin/titles?limit=1', 'besttv');
const T = arr(list.json)[0] ?? list.json?.items?.[0];
if (!T) {
  console.error('⛔ Туршилтын кино олдсонгүй');
  process.exit(1);
}
const detail0 = await A(`/admin/titles/${T.id}`, 'besttv');
const ORIGINAL = detail0.json.sites;
console.log(`  Туршилтын кино: «${T.title}»  анхны sites=${JSON.stringify(ORIGINAL)}`);
ck('detail-д `sites` ирнэ', Array.isArray(ORIGINAL), JSON.stringify(ORIGINAL));

const bulkSite = (site, enabled, ids = [T.id]) =>
  A('/admin/titles/bulk/site', 'besttv', {
    method: 'POST',
    body: JSON.stringify({ ids, site, enabled }),
  });

/** ⚠️ Тест дуусахад ЗААВАЛ дуудна — анхны төлөвийг сэргээнэ */
async function restore() {
  const now = (await A(`/admin/titles/${T.id}`, 'besttv')).json?.sites;
  if (JSON.stringify([...(now ?? [])].sort()) === JSON.stringify([...ORIGINAL].sort())) return true;
  /* Дутуу сайтыг нэмж сэргээнэ */
  for (const s of ORIGINAL) {
    if (!now?.includes(s)) await bulkSite(s, true);
  }
  const after = (await A(`/admin/titles/${T.id}`, 'besttv')).json?.sites;
  return JSON.stringify([...(after ?? [])].sort()) === JSON.stringify([...ORIGINAL].sort());
}

try {
  /* C1. Танихгүй сайт → 400 */
  const bad = await bulkSite('hakerz', true);
  ck('танихгүй сайт татгалзана', bad.status === 400, `${bad.status}`);

  /* C2. Хоосон ids → 400 */
  const empty = await bulkSite('bestfilm', true, []);
  ck('хоосон жагсаалт татгалзана', empty.status === 400, `${empty.status}`);

  /* C3. ⚠️ ӨӨРИЙН сайтаас хасахыг хориглоно (тестээр илэрсэн алдаа) */
  const self = await bulkSite('besttv', false);
  const afterSelf = (await A(`/admin/titles/${T.id}`, 'besttv')).json?.sites;
  ck('ӨӨРИЙН сайтаас хасахыг хориглоно',
    afterSelf?.includes('besttv') === true,
    `blocked=${self.json?.blocked?.length ?? 0} sites=${JSON.stringify(afterSelf)}`);

  /* C4. Нөгөө сайтаас хасах — зөвшөөрнө */
  if (ORIGINAL.includes('bestfilm')) {
    const off = await bulkSite('bestfilm', false);
    const afterOff = (await A(`/admin/titles/${T.id}`, 'besttv')).json?.sites;
    ck('нөгөө сайтаас хасна', !afterOff?.includes('bestfilm'), JSON.stringify(afterOff));

    /* C5. Нийтийн талд ҮНЭХЭЭР нуугдсан уу */
    const pubBf = await J(`${BF}/api/titles/${T.slug}`);
    const pubTv = await J(`${TV}/api/titles/${T.slug}`);
    ck('BestFilm-д нуугдсан', pubBf.status === 404, `${pubBf.status}`);
    ck('⚠️ BestTV-д ХЭВЭЭР', pubTv.status === 200, `${pubTv.status}`);

    /* C6. Буцааж нэмэх */
    await bulkSite('bestfilm', true);
    const back = (await A(`/admin/titles/${T.id}`, 'besttv')).json?.sites;
    ck('буцааж нэмнэ', back?.includes('bestfilm') === true, JSON.stringify(back));

    const pubBf2 = await J(`${BF}/api/titles/${T.slug}`);
    ck('BestFilm-д буцаж гарлаа', pubBf2.status === 200, `${pubBf2.status}`);
  }
} finally {
  /* ⚠️⚠️ ЯМАР Ч тохиолдолд сэргээнэ */
  const ok = await restore();
  ck('⚠️ АНХНЫ ТӨЛӨВ СЭРГЭСЭН', ok,
    ok ? JSON.stringify(ORIGINAL) : '⛔⛔ ГАРААР ЗАСНА УУ!');
}

/* ─────────────────────────────────────────────────────────────
   D. ЧАТБОТ
   ───────────────────────────────────────────────────────────── */

console.log('\n═══ D. Чатбот (брэнд / домэйн / карт) ═══');

const SESSIONS = [];
const chat = async (message, site) => {
  const sessionId = `e2e_${site}_${Math.random().toString(36).slice(2, 9)}`;
  SESSIONS.push(sessionId);
  const r = await J('https://bot.digitalger.mn/webhook/besttv-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message, site }),
    signal: AbortSignal.timeout(90_000),
  });
  return { status: r.status, reply: r.json?.reply ?? '', titles: r.json?.titles ?? [] };
};

const QUESTIONS = ['сайн уу', 'холбоо барих', 'багц ямар үнэтэй вэ',
                   'яаж төлбөр төлөх вэ', 'бүртгүүлэх', 'хар жагсаалт'];

for (const [site, other, otherDom] of [
  ['besttv', 'BestFilm', 'bestfilm.net'],
  ['bestfilm', 'BestTV', 'besttv.us'],
]) {
  for (const q of QUESTIONS) {
    const r = await chat(q, site);
    const leak = new RegExp(`${other}|${otherDom.replace('.', '\\.')}`).test(r.reply);
    ck(`[${site}] «${q}»`, r.status === 200 && !leak,
      `${r.status} карт${r.titles.length}${leak ? ` ⛔${other} ГАРСАН` : ''}`);
  }
}

/* ─────────────────────────────────────────────────────────────
   E. НЭВТРЭЛТИЙН ТУСГААРЛАЛТ
   ───────────────────────────────────────────────────────────── */

console.log('\n═══ E. Нэвтрэлт (сайт хооронд ХААЛТТАЙ) ═══');

const crossLogin = await J(`${BF}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
});
ck('BestTV админ → BestFilm нэвтэрч ЧАДАХГҮЙ', crossLogin.status === 401, `${crossLogin.status}`);

/* ─────────────────────────────────────────────────────────────
   F. SEO
   ───────────────────────────────────────────────────────────── */

console.log('\n═══ F. SEO ═══');

const [hBf, hTv] = await Promise.all([J(`${BF}/`), J(`${TV}/`)]);
ck('BestFilm HTML — «BestTV» алга', !/BestTV/.test(hBf.text));

/**
 * ⚠️ `canonical` / `og:url` нь bestfilm.net заасан эсэх.
 *
 * ⚠️ HTML дотор `besttv.us` олон удаа гарна — тэр нь `assets.besttv.us`
 * буюу ХУВААЛЦСАН R2 зургийн хаяг (1933 удаа). Түүнийг «алдаа» гэж
 * үзвэл тест мөнхөд улаан үлдэнэ. Тиймээс ЯГ шошгыг шалгана.
 */
const canon = /<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i.exec(hBf.text)?.[1] ?? '';
const ogUrl = /<meta[^>]*property="og:url"[^>]*content="([^"]+)"/i.exec(hBf.text)?.[1] ?? '';
ck('BestFilm canonical + og:url',
  canon.includes('bestfilm.net') && ogUrl.includes('bestfilm.net'),
  `canonical=${canon || '—'} og:url=${ogUrl || '—'}`);
ck('⚠️ BestTV HTML — «BestTV» бий', /BestTV/.test(hTv.text));
for (const [d, name] of [[BF, 'BestFilm'], [TV, 'BestTV']]) {
  const rb = await J(`${d}/robots.txt`);
  const sm = await J(`${d}/sitemap.xml`);
  ck(`${name} robots+sitemap`, rb.status === 200 && sm.status === 200, `${rb.status}/${sm.status}`);
}

/* ─────────────────────────────────────────────────────────────
   ДҮН
   ───────────────────────────────────────────────────────────── */

console.log(`\n╔═══════════════════════════════════════╗`);
console.log(`║  ${String(pass).padStart(3)} ✅   ${String(fail).padStart(3)} ❌                     ║`);
console.log(`╚═══════════════════════════════════════╝`);
if (failures.length) {
  console.log('\nУНАСАН:');
  for (const f of failures) console.log(`  · ${f}`);
}
console.log(`\n⚠️ Тестийн чат session: ${SESSIONS.length} — ЦЭВЭРЛЭНЭ:`);
console.log(`   DELETE FROM "ChatMessage" WHERE "conversationId" IN (SELECT id FROM "ChatConversation" WHERE "sessionId" LIKE 'e2e_%');`);
console.log(`   DELETE FROM "ChatConversation" WHERE "sessionId" LIKE 'e2e_%';`);

process.exitCode = fail ? 1 : 0;
