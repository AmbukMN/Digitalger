#!/usr/bin/env node
/**
 * ХАМГААЛАЛТГҮЙ `update`/`delete` — САЙТ ХООРОНД БИЧИХ ЦООРХОЙ.
 *
 * ⚠️⚠️ ЯАГААД ЭНЭ АЮУЛТАЙ ВЭ:
 *
 * Prisma-ийн site өргөтгөл нь `update`/`delete`-д `where` шүүлт
 * НЭМДЭГГҮЙ (unique op). `findUnique`-ийн ҮР ДҮНГ л post-filter
 * хийдэг. Тиймээс урьдчилсан шалгалтгүй бол:
 *
 *     PATCH /admin/plans/<bestfilm-ийн-id>   +  X-Site: besttv
 *     → 200, БОДИТООР өөрчлөгдөнө
 *
 * БОДИТ АЛДАА (агентын тестээр илэрсэн): BestTV-ийн админ сессээр
 * BestFilm-ийн багцын үнийг 99999 болгож, чат түлхүүрийг УСТГАЖ
 * чадсан.
 *
 * ЗӨВ ЗАГВАР (`faq.module.ts`, `pages.module.ts`):
 *     const row = await this.prisma.x.findFirst({ where: { id } });
 *     if (!row) throw new NotFoundException(...);
 *     return this.prisma.x.update({ where: { id }, data });
 *
 * ⚠️ `findFirst` — `findUnique` БИШ. `findFirst` нь site шүүлтийг
 * АВТОМАТААР авдаг.
 *
 * Хэрэглэх: node scripts/audit-unguarded-writes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../src');

/* SCOPED модел → Prisma camelCase */
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

const hits = [];

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');

  /* `prisma.<model>.update({ where: { id ... } })` / `.delete(...)` */
  const re = /prisma\.(\w+)\.(update|delete)\(\{\s*\n?\s*where:\s*\{\s*id[:,\s]/g;
  let m;
  while ((m = re.exec(src))) {
    const model = camel.get(m[1]);
    if (!model) continue;

    const lineNo = src.slice(0, m.index).split('\n').length;

    /**
     * ⚠️ ӨМНӨХ 25 мөрөнд хамгаалалт байгаа эсэх:
     *   · `findFirst` — site шүүлт автоматаар авна (ЗӨВ)
     *   · `runAcrossSites` / `resolveByRecord` — зориуд бүх сайт
     *   · `$transaction` доторх `tx.` — эцэг нь шалгасан байж болно
     *
     * ⚠️ `findUnique` нь ХАМГААЛАЛТ БИШ — түүний `select`-д `site`
     * байхгүй бол post-filter алгасагдана (тусад нь аудит бий).
     */
    const before = lines.slice(Math.max(0, lineNo - 26), lineNo).join('\n');
    const guarded =
      /findFirst\s*\(/.test(before) ||
      /runAcrossSites|resolveByRecord|runWithSiteAsync|withAllSites/.test(before) ||
      /NotFoundException/.test(before);

    if (guarded) continue;

    hits.push({
      file: path.relative(SRC, file).replace(/\\/g, '/'),
      line: lineNo,
      model,
      op: m[2],
    });
  }
}

console.log(`\nSCOPED модел: ${scoped.size}\n`);
if (!hits.length) {
  console.log('  ✅ Хамгаалалтгүй update/delete олдсонгүй\n');
} else {
  console.log(`  ⚠️  ${hits.length} хамгаалалтгүй бичих үйлдэл:\n`);
  for (const h of hits) {
    console.log(`  ${h.op === 'delete' ? '⛔' : '⚠️'} ${h.file}:${h.line}`);
    console.log(`     ${h.model}.${h.op} — өмнө нь \`findFirst\` шалгалт АЛГА`);
  }
  console.log(
    `\n  ⚠️ \`delete\` нь эргэлт буцалтгүй тул \`update\`-ээс НОЦТОЙ.\n`,
  );
}
process.exitCode = hits.length ? 1 : 0;
