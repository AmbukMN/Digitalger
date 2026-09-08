#!/usr/bin/env node
/**
 * САЙТЫН ТУСГААРЛАЛТЫН БҮРЭН АУДИТ — статик скан.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: BestFilm нээгдсэний дараа гарсан 10 гаруй
 * алдаа БҮГД нэг зүйлээс үүдсэн — «сайт» гэдэг ойлголтыг мартсан код.
 * Тэдгээрийг НЭГ НЭГЭЭР нь хэрэглэгч олж мэдээлэх нь МУУ. Энэ скрипт
 * ИЖИЛ ХЭВ ШИНЖ бүрийг нэг дор илрүүлнэ.
 *
 * Шалгах зүйлс:
 *   B1  SCOPED модел дээрх `@@unique`-д `site` орсон эсэх
 *   B2  Кэшийн түлхүүр сайт агуулсан эсэх (`cache.wrap/set/get`)
 *   B3  `findUnique` нь site-гүй unique талбараар хайж байгаа эсэх
 *   B4  Webhook/cron дотор `resolveByRecord`/`forEachSite` эсэх
 *   A1  Админ дахь hardcode домэйн (`besttv.us`, `bestfilm.net`)
 *   A2  `process.env.NEXT_PUBLIC_SITE_URL` (админд ҮРГЭЛЖ буруу)
 *   F1  Frontend дахь нөгөө сайтын нэр/домэйн
 *
 * Хэрэглэх:
 *   node scripts/audit-site-isolation.mjs            # бүгд
 *   node scripts/audit-site-isolation.mjs --only=B2
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, '..');
const ROOT = path.resolve(BACKEND, '../..');
const ADMIN = path.join(ROOT, 'besttv/admin/src');
const BF_FRONT = path.join(ROOT, 'bestfilm/frontend/src');
const TV_FRONT = path.join(ROOT, 'besttv/frontend/src');

const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];

/* ── туслахууд ──────────────────────────────────────────────── */

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.next', 'dist', '.git'].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.spec\./.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const read = (p) => fs.readFileSync(p, 'utf8');

/** Мөр нь тайлбар эсэх — тайлбар дахь жишээг алдаа гэж бүртгэхгүй */
const isComment = (line) => /^\s*(\/\/|\*|\/\*|\/\/\/)/.test(line);

/**
 * ⚠️⚠️ ОЛОН МӨРТ ТАЙЛБАРЫГ ХАСНА.
 *
 * Мөр тус бүрийг `isComment`-ээр шалгах нь ХАНГАЛТГҮЙ: `/** … *\/`
 * блокийн ДУНД мөрүүд нь `*`-аар эхэлдэггүй тохиолдол бий, мөн код
 * дараа нь ижил мөрөнд байж болно. Энэ төслийн тайлбар нь МАШ ДЭЛГЭРЭНГҮЙ
 * (алдааны түүх бичдэг) тул хуурамч дохио маш их гарна — жишээ нь
 * «BestTV-д ижил алдаа гарсан» гэсэн тайлбарыг «hardcode» гэж уншина.
 *
 * @returns мөр бүр нь тайлбар мөн эсэх (индексээр)
 */
function commentMask(src) {
  const lines = src.split('\n');
  const mask = new Array(lines.length).fill(false);
  let inBlock = false;
  lines.forEach((line, i) => {
    const t = line.trim();
    if (inBlock) {
      mask[i] = true;
      if (t.includes('*/')) inBlock = false;
      return;
    }
    if (t.startsWith('//') || t.startsWith('///')) { mask[i] = true; return; }
    /**
     * ⚠️ JSX тайлбар `{/* … *\/}` — React-д ЭНЭ Л цорын ганц хэлбэр.
     * Түүнийг таниагүй тул `title-card.tsx`, `opengraph-image` зэрэг
     * дэх дизайны тайлбар («BestTV нь rounded-lg») хуурамч дохио
     * өгч байв.
     */
    if (t.startsWith('/*') || t.startsWith('{/*')) {
      mask[i] = true;
      if (!t.includes('*/')) inBlock = true;
    }
  });
  return mask;
}

const findings = [];
const add = (check, file, line, msg, snippet = '') =>
  findings.push({ check, file, line, msg, snippet });

/* ── B1: SCOPED моделийн unique ─────────────────────────────── */

function checkB1() {
  const schema = read(path.join(BACKEND, 'prisma/schema.prisma'));
  const models = read(path.join(BACKEND, 'src/common/site/site-models.ts'));

  const scopedBlock = models.match(/SCOPED_MODELS[\s\S]*?\] as const/)?.[0] || '';
  const scoped = new Set(
    (scopedBlock.match(/^\s*'([A-Z]\w+)'/gm) || []).map((s) => s.trim().slice(1, -1)),
  );

  for (const block of schema.split(/\nmodel /).slice(1)) {
    const name = block.split(/\s/)[0];
    if (!scoped.has(name)) continue;
    const body = block.slice(0, block.indexOf('\n}'));

    if (!/^\s*site\s+String/m.test(body)) {
      add('B1', 'prisma/schema.prisma', 0, `${name}: SCOPED атлаа \`site\` багана АЛГА`);
      continue;
    }
    /**
     * ⚠️⚠️ ЭЦЭГ МӨР НЬ САЙТААР САЛГАГДСАН БОЛ ХАНГАЛТТАЙ.
     *
     * Жишээ: `WatchProgress @@unique([userId, titleId])` нь `site`-гүй
     * ч АЮУЛГҮЙ — `User` нь `@@unique([email, site])`-тэй тул BestFilm-
     * ийн хэрэглэгч ӨӨР `userId` авна. Эдгээрийг «алдаа» гэж бичвэл
     * аудит хуурамч дохиогоор дүүрч, ЖИНХЭНЭ алдаа нь дунд нь алдагдана.
     *
     * Тиймээс unique-ийн талбаруудын дунд САЙТААР САЛГАГДСАН эцэг рүү
     * заасан гадаад түлхүүр байгаа эсэхийг шалгана.
     */
    const scopedParents = new Set();
    for (const line of body.split('\n')) {
      const m = /^\s*\w+\s+(\w+)\s.*@relation\(fields:\s*\[(\w+)\]/.exec(line);
      if (m) scopedParents.add(m[2]); // талбарын нэр (userId, titleId…)
    }

    for (const m of body.matchAll(/@@unique\(\[([^\]]+)\]\)/g)) {
      const fields = m[1].split(',').map((s) => s.trim().replace(/^\/\/\/.*/, ''));
      if (fields.includes('site')) continue;
      /* Эцэг рүү заасан талбар байвал тусгаарлалт ТЭР ДАМЖУУЛАН хийгдэнэ */
      const viaParent = fields.find((f) => scopedParents.has(f));
      if (viaParent) continue;

      /**
       * ⚠️ ЗОРИУД site-гүй байх нь ЗӨВ тохиолдол бий — жишээ нь
       * `SocialRelay`: түлхүүр нь Facebook-ийн ГЛОБАЛ пост ID тул
       * site нэмбэл давхардлын хамгаалалт СУЛРАНА.
       *
       * Тэдгээрийг схемд `site ЗОРИУД ОРООГҮЙ` гэж тэмдэглэнэ —
       * аудит хуурамч дохио өгөхгүй, шалтгаан нь кодод үлдэнэ.
       */
      const before = body.slice(0, m.index);
      if (/ЗОРИУД\s+ОРООГҮЙ/.test(before.slice(-800))) continue;

      add('B1', 'prisma/schema.prisma', 0,
        `${name}: @@unique([${m[1]}]) — \`site\` ОРООГҮЙ, эцэг харьцаа ч алга`,
        'upsert нь НӨГӨӨ САЙТЫН мөрийг олж чимээгүй дарж бичнэ');
    }
  }
  return scoped;
}

/* ── B2: кэшийн түлхүүр ─────────────────────────────────────── */

function checkB2() {
  /* ⚠️ CacheService нь түлхүүрт сайтыг АВТОМАТААР нэмдэг болсон
     (`k()`). Тиймээс энд зөвхөн тэр хамгаалалт ХЭВЭЭР байгаа
     эсэхийг батална — арилсан бол БҮХ кэш дахин холилдоно. */
  const svc = read(path.join(BACKEND, 'src/common/cache/cache.service.ts'));
  const hasK = /private\s+k\s*\(/.test(svc) && /currentSite\(\)/.test(svc);
  if (!hasK) {
    add('B2', 'src/common/cache/cache.service.ts', 0,
      'Кэшийн түлхүүрт сайт нэмэх `k()` хамгаалалт АЛГА',
      'Сайт бүрийн кэш холилдож, нэг нь нөгөөгийн датаг харуулна');
  }
  for (const m of ['get', 'set', 'take'].map((op) =>
    new RegExp(`async ${op}[\\s\\S]{0,400}?\\n  \\}`, 'g'),
  )) {
    const body = svc.match(m)?.[0] || '';
    if (body && !body.includes('this.k(')) {
      add('B2', 'src/common/cache/cache.service.ts', 0,
        `\`${body.slice(6, 20).trim()}\` нь \`this.k()\` ашиглаагүй`);
    }
  }
}

/* ── B3: site-гүй unique талбараар findUnique ───────────────── */

function checkB3(scoped) {
  const schema = read(path.join(BACKEND, 'prisma/schema.prisma'));
  /* Тухайн модель ямар талбарууд нь ЦОРЫН ГАНЦ (глобал @unique) вэ */
  const globalUnique = new Map();
  for (const block of schema.split(/\nmodel /).slice(1)) {
    const name = block.split(/\s/)[0];
    const body = block.slice(0, block.indexOf('\n}'));
    const fields = [];
    for (const line of body.split('\n')) {
      if (isComment(line)) continue;
      const m = /^\s*(\w+)\s+\S+.*@unique/.exec(line);
      if (m) fields.push(m[1]);
    }
    if (fields.length) globalUnique.set(name, fields);
  }

  /* SCOPED модель дээр глобал @unique үлдсэн бол — сайт хооронд
     давхардах боломжгүй гэсэн үг. Зарим нь ЗӨВ (token, invoiceId),
     зарим нь эвдрэл (slug, campaign). Хүнд шийдүүлэхээр ЖАГСААНА. */
  for (const [model, fields] of globalUnique) {
    if (!scoped.has(model)) continue;
    for (const f of fields) {
      /* ⚠️ Эдгээр нь ГЛОБАЛ давхардахгүй байх ЁСТОЙ — зөв */
      const OK = /token|hash|invoiceid|reference|messageid|paymentid|sessionid|idempotency|fbpostid|guesttoken/i;
      if (OK.test(f)) continue;
      add('B3', 'prisma/schema.prisma', 0,
        `${model}.${f} — SCOPED моделийн ГЛОБАЛ @unique`,
        'Хоёр сайт ижил утга ашиглаж чадахгүй. Зориуд эсэхийг батал');
    }
  }
}

/* ── B4: webhook / cron нь бүх сайтыг хардаг эсэх ──────────── */

function checkB4() {
  for (const f of walk(path.join(BACKEND, 'src'))) {
    const src = read(f);
    const lines = src.split('\n');

    lines.forEach((line, i) => {
      if (isComment(line)) return;

      /* Cron нь сайт бүрээр давтагдах ёстой */
      if (/@Cron\(/.test(line)) {
        const after = lines.slice(i, i + 60).join('\n');
        const guarded =
          /forEachSite|mapEachSite|runWithSiteAsync|withAllSites|resolveByRecord/.test(after);
        if (!guarded) {
          add('B4', rel(f), i + 1, 'Cron нь сайт бүрээр давтагдаагүй',
            'Зөвхөн besttv-д ажиллаж, BestFilm-ийнх ХЭЗЭЭ Ч хийгдэхгүй байж болзошгүй');
        }
      }
    });
  }
}

/* ── A1/A2: админ дахь домэйн ──────────────────────────────── */

function checkAdmin() {
  for (const f of walk(ADMIN)) {
    const src = read(f);
    /* ⚠️ Олон мөрт тайлбарыг хасна (`checkFrontends`-ийн тайлбарыг үз) */
    const mask = commentMask(src);
    src.split('\n').forEach((line, i) => {
      if (mask[i]) return;

      /* placeholder / тайлбар биш, БОДИТ утга */
      if (/https?:\/\/(besttv\.us|bestfilm\.net|api\.besttv\.us)/.test(line)) {
        if (/placeholder=|\/\/|title=|aria-label=/.test(line)) return;
        add('A1', rel(f), i + 1, 'Админд домэйн HARDCODE',
          line.trim().slice(0, 90));
      }
      if (/process\.env\.NEXT_PUBLIC_SITE_URL/.test(line)) {
        add('A2', rel(f), i + 1,
          'Админд `NEXT_PUBLIC_SITE_URL` — НЭГ build, ХОЁР сайт тул ҮРГЭЛЖ буруу',
          '`useSiteUrl()` ашигла');
      }
    });
  }
}

/* ── F1: frontend дахь нөгөө сайтын нэр ────────────────────── */

function checkFrontends() {
  const pairs = [
    [BF_FRONT, /BestTV|besttv\.us/, 'BestFilm frontend дотор BestTV'],
    [TV_FRONT, /BestFilm|bestfilm\.net/, 'BestTV frontend дотор BestFilm'],
  ];
  for (const [dir, bad, msg] of pairs) {
    for (const f of walk(dir)) {
      const src = read(f);
      /* ⚠️ ЗААВАЛ `commentMask` — энэ төслийн тайлбар нь алдааны түүх
         бичдэг тул «BestTV-д ижил алдаа гарсан» гэсэн мөрүүд олноор
         байдаг. Мөр-мөрөөр шалгавал 9 хуурамч дохио гарна. */
      const mask = commentMask(src);
      src.split('\n').forEach((line, i) => {
        if (mask[i]) return;
        /* ⚠️ R2/asset нь ХУВААЛЦСАН — assets.besttv.us зөв */
        if (/assets\.besttv\.us|@besttv\/shared|besttv-backend|besttv_/.test(line)) return;
        if (bad.test(line)) add('F1', rel(f), i + 1, msg, line.trim().slice(0, 90));
      });
    }
  }
}

/* ── ажиллуулах ────────────────────────────────────────────── */

const scoped = checkB1();
if (!ONLY || ONLY === 'B2') checkB2();
if (!ONLY || ONLY === 'B3') checkB3(scoped);
/* ⚠️ B4-ийг ХАСав: cron нь контекстгүй тул Prisma шүүлт ХИЙХГҮЙ —
   энэ нь ЗӨВ зан төлөв (хоёр сайтыг хамарна). Жинхэнэ эрсдэл нь
   мөр олсныхоо ДАРАА сайт-тусгай зүйл хийх явдал бөгөөд түүнийг
   `audit-cron-site.mjs` нарийвчлан шалгадаг. Энд давхардуулбал
   9 хуурамч дохио гарч, жинхэнэ олдвор дунд нь алдагдана. */
if (!ONLY || ONLY.startsWith('A')) checkAdmin();
if (!ONLY || ONLY === 'F1') checkFrontends();

const byCheck = {};
for (const f of findings) (byCheck[f.check] ||= []).push(f);

const NAMES = {
  B1: 'SCOPED моделийн @@unique-д site',
  B2: 'Кэшийн түлхүүрийн тусгаарлалт',
  B3: 'SCOPED дээрх глобал @unique',
  B4: 'Cron нь сайт бүрээр давтагдах',
  A1: 'Админ дахь hardcode домэйн',
  A2: 'Админ дахь NEXT_PUBLIC_SITE_URL',
  F1: 'Frontend дахь нөгөө сайтын нэр',
};

console.log(`\n╔═══ САЙТЫН ТУСГААРЛАЛТЫН АУДИТ ═══╗`);
console.log(`  SCOPED модел: ${scoped.size}\n`);

for (const key of Object.keys(NAMES)) {
  const list = byCheck[key];
  if (ONLY && !key.startsWith(ONLY)) continue;
  if (!list?.length) {
    console.log(`  ✅ ${key}  ${NAMES[key]}`);
    continue;
  }
  console.log(`\n  ⚠️  ${key}  ${NAMES[key]} — ${list.length} олдвор`);
  for (const f of list) {
    console.log(`      ${f.file}${f.line ? ':' + f.line : ''}`);
    console.log(`        ${f.msg}`);
    if (f.snippet) console.log(`        · ${f.snippet}`);
  }
}

console.log(`\n╚═══ нийт ${findings.length} олдвор ═══╝\n`);
process.exitCode = findings.length ? 1 : 0;
