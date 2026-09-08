/**
 * ⚠️⚠️ САЙТЫН ХАМРАХ ХҮРЭЭГ БАТЛАХ — deploy-ийн ӨМНӨ ЗААВАЛ.
 *
 * Хоёр эх сурвалж зөрөх нь ЧИМЭЭГҮЙ АЛДАА:
 *   · `site-models.ts`-д SCOPED гэж бичсэн ч схемд `site` алга
 *     → Prisma «Unknown argument site» гэж ажиллах үедээ унана
 *   · Схемд `site` бий ч жагсаалтад алга
 *     → шүүлт хийгдэхгүй, ӨГӨГДӨЛ ХОЛИЛДОНО
 *
 * Ажиллуулах: node scripts/verify-site-coverage.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const modelsSrc = fs.readFileSync(
  path.join(root, 'src/common/site/site-models.ts'),
  'utf8',
);
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');

const pick = (name) => {
  const m = modelsSrc.match(new RegExp(`${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!m) throw new Error(`${name} олдсонгүй`);
  return [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]);
};

const SCOPED = pick('SCOPED_MODELS');
const SHARED = pick('SHARED_MODELS');
const MULTI = pick('MULTI_SITE_MODELS');

/** Схемээс модел блокуудыг тасалж авна */
const blocks = new Map();
for (const m of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
  blocks.set(m[1], m[2]);
}

let fail = 0;
const err = (s) => {
  console.log(`  ⛔ ${s}`);
  fail++;
};

console.log('\n╔═══ САЙТЫН ХАМРАХ ХҮРЭЭ ═══╗\n');

/* ── 1. SCOPED бүр схемд `site`-тай эсэх ── */
console.log(`── 1. SCOPED (${SCOPED.length} модел) ──`);
for (const name of SCOPED) {
  const body = blocks.get(name);
  if (!body) {
    err(`${name} — схемд МОДЕЛ алга`);
    continue;
  }
  if (!/^\s*site\s+String/m.test(body)) err(`${name} — схемд site БАГАНА алга`);
}
console.log(fail ? '' : '  ✅ бүгд site-тай');

/* ── 2. MULTI нь `sites[]`-тай эсэх ── */
const before2 = fail;
console.log(`\n── 2. MULTI (${MULTI.length} модел) ──`);
for (const name of MULTI) {
  const body = blocks.get(name);
  if (!body) {
    err(`${name} — схемд алга`);
    continue;
  }
  if (!/^\s*sites\s+String\[\]/m.test(body)) err(`${name} — sites[] алга`);
}
console.log(fail === before2 ? '  ✅ sites[] бий' : '');

/* ── 3. SHARED-д `site` БАЙХ ЁСГҮЙ ── */
const before3 = fail;
console.log(`\n── 3. SHARED (${SHARED.length} модел) ──`);
for (const name of SHARED) {
  const body = blocks.get(name);
  if (!body) continue;
  if (MULTI.includes(name)) continue; // Title — sites[] нь зөв
  if (/^\s*site\s+String/m.test(body)) {
    err(`${name} — SHARED атал site бий (жагсаалт зөрсөн?)`);
  }
}
console.log(fail === before3 ? '  ✅ site байхгүй (зөв)' : '');

/* ── 4. Схемд site-тай ч жагсаалтад АЛГА (хамгийн аюултай) ── */
const before4 = fail;
console.log('\n── 4. Схемд site бий ч жагсаалтад алга ──');
const known = new Set([...SCOPED, ...SHARED, ...MULTI]);
for (const [name, body] of blocks) {
  if (!/^\s*site\s+String/m.test(body)) continue;
  if (SCOPED.includes(name)) continue;
  err(`${name} — схемд site бий, SCOPED_MODELS-д АЛГА → шүүлт хийгдэхгүй!`);
}
console.log(fail === before4 ? '  ✅ зөрүүгүй' : '');

/* ── 5. Схемийн модел бүр ангилагдсан эсэх ── */
const before5 = fail;
console.log('\n── 5. Ангилагдаагүй модел ──');
for (const name of blocks.keys()) {
  if (!known.has(name)) err(`${name} — SCOPED/SHARED/MULTI аль нь ч биш`);
}
console.log(fail === before5 ? '  ✅ бүгд ангилагдсан' : '');

/* ── 6. unique-үүд site-аар салгагдсан эсэх ── */
const before6 = fail;
console.log('\n── 6. Салгагдсан unique ──');
const MUST_SPLIT = {
  User: ['email', 'phone', 'googleId', 'facebookId', 'appleId'],
  Subscriber: ['email'],
  Coupon: ['code'],
  Page: ['slug'],
  EmailSuppression: ['email'],
};
for (const [model, fields] of Object.entries(MUST_SPLIT)) {
  const body = blocks.get(model);
  if (!body) continue;
  for (const f of fields) {
    /* ⚠️ Талбар дээр `@unique` ҮЛДСЭН бол салгагдаагүй */
    if (new RegExp(`^\\s*${f}\\s+String\\??[^\\n]*@unique`, 'm').test(body)) {
      err(`${model}.${f} — @unique ҮЛДСЭН (сайтаар салгагдаагүй)`);
    }
    if (!body.includes(`@@unique([${f}, site])`)) {
      err(`${model} — @@unique([${f}, site]) алга`);
    }
  }
}
console.log(fail === before6 ? '  ✅ бүгд салгагдсан' : '');

console.log(
  fail
    ? `\n╚═══ ⛔ ${fail} АЛДАА ═══╝\n`
    : `\n╚═══ ✅ ${SCOPED.length} SCOPED · ${SHARED.length} SHARED · ${MULTI.length} MULTI — зөрүүгүй ═══╝\n`,
);
process.exit(fail ? 1 : 0);
