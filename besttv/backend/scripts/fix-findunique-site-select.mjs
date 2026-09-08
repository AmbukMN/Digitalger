#!/usr/bin/env node
/**
 * `findUnique({ select })`-Д `site: true` НЭМНЭ — ХАМГААЛАЛТ СЭРГЭЭНЭ.
 *
 * ⚠️⚠️ ЯАГААД ЧУХАЛ ВЭ:
 *
 * Prisma-ийн site өргөтгөл нь `findUnique`-д `where` шүүлт НЭМДЭГГҮЙ
 * (unique түлхүүрт site байхгүй тохиолдол олон). Оронд нь буцсан
 * мөрийг POST-FILTER хийдэг:
 *
 *     if (scoped && 'site' in row && row.site !== site) return null;
 *
 * `select`-д `site` байхгүй бол буцсан объектод тэр талбар ОГТ
 * байхгүй → `'site' in row` нь `false` → **шалгалт бүхэлдээ
 * алгасагдана**.
 *
 * БОДИТ АЛДАА (аудитаар илэрсэн): `jwt.strategy.ts` дээр энэ нь
 * сайт хоорондын НЭВТРЭЛТИЙН ХИЛийг чимээгүй унтраасан — BestTV-д
 * нэвтэрсэн хэрэглэгчийн токеноор bestfilm.net руу орж болдог байв.
 *
 * ⚠️ 41 газар олдсон. Гараар засвал заавал нэгийг мартана.
 *
 * Хэрэглэх:
 *   node scripts/fix-findunique-site-select.mjs --dry
 *   node scripts/fix-findunique-site-select.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../src');
const DRY = process.argv.includes('--dry');

/* SCOPED модел → Prisma-ийн camelCase нэр */
const models = fs.readFileSync(path.join(SRC, 'common/site/site-models.ts'), 'utf8');
const scoped = new Set(
  (models.match(/SCOPED_MODELS[\s\S]*?\] as const/)?.[0] || '')
    .match(/^\s*'([A-Z]\w+)'/gm)
    ?.map((s) => s.trim().slice(1, -1)) || [],
);
const camel = new Map([...scoped].map((m) => [m[0].toLowerCase() + m.slice(1), m]));

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.ts$/.test(e.name) && !/\.spec\./.test(e.name)) out.push(p);
  }
  return out;
}

let fixed = 0;
let skipped = 0;
const report = [];

for (const file of walk(SRC)) {
  let src = fs.readFileSync(file, 'utf8');
  const before = src;

  /**
   * ⚠️ `prisma.<model>.findUnique({ … select: { … } … })` хэлбэрийг
   * олж, `select`-ийн ЭХЭНД `site: true,` нэмнэ.
   *
   * ⚠️ ЯАГААД `select:`-ийн ард нэмдэг вэ (төгсгөлд биш): `select`
   * блокийн дотор `_count`, үүрлэсэн `select` зэрэг байж болно —
   * төгсгөлийг олох нь найдваргүй. Эхэнд нэмэх нь ямар ч бүтэцтэй
   * ажиллана.
   */
  const re = /(prisma\.(\w+)\.findUnique\(\{)([\s\S]{0,800}?)(\n\s*\}\))/g;

  src = src.replace(re, (whole, head, modelName, body, tail) => {
    if (!camel.has(modelName)) return whole;
    if (!/\bselect\s*:\s*\{/.test(body)) return whole; // select байхгүй → бүх талбар ирнэ, ЗӨВ
    if (/\bsite\s*:\s*true/.test(body)) return whole; // аль хэдийн бий

    /* `select: {` -ийн ЭХНИЙ тохиолдлын ард шигтгэнэ */
    const patched = body.replace(
      /(\bselect\s*:\s*\{)/,
      "$1\n        /* ⚠️ `site` — өргөтгөлийн post-filter ажиллахад ЗААВАЛ */\n        site: true,",
    );
    if (patched === body) return whole;

    fixed++;
    report.push(`${path.relative(SRC, file).replace(/\\/g, '/')} — ${camel.get(modelName)}`);
    return head + patched + tail;
  });

  if (src !== before && !DRY) fs.writeFileSync(file, src, 'utf8');
}

console.log(`\nSCOPED модел: ${scoped.size}`);
console.log(`${DRY ? '(--dry) ' : ''}зассан: ${fixed}\n`);
for (const r of report) console.log(`  ✅ ${r}`);
if (skipped) console.log(`\n  ⏭️  алгассан: ${skipped}`);
