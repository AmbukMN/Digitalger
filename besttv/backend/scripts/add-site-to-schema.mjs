/**
 * ⚠️⚠️ PRISMA СХЕМД `site` БАГАНА НЭМЭХ — нэг удаагийн скрипт.
 *
 * ЯАГААД СКРИПТ ВЭ: 48 моделд гараар нэмэх нь ЗААВАЛ алдаа гаргана
 * (нэгийг мартах, буруу модельд нэмэх). Скрипт нь `site-models.ts`-ийн
 * ЖАГСААЛТААС уншдаг тул нэг эх сурвалжтай.
 *
 * ЮУ ХИЙХ ВЭ:
 *   1. SCOPED модел бүрд   `site String @default("besttv")` + индекс
 *   2. Title-д             `sites String[] @default(["besttv"])`
 *   3. unique-үүдийг       `@unique` → `@@unique([талбар, site])`
 *
 * ⚠️ ДАХИН АЖИЛЛУУЛАХАД АЮУЛГҮЙ (idempotent) — аль хэдийн site-тай
 * моделийг алгасана.
 *
 * Ажиллуулах:  node scripts/add-site-to-schema.mjs
 *              node scripts/add-site-to-schema.mjs --dry   (зөвхөн харах)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const DRY = process.argv.includes('--dry');

/* ── site-models.ts-ээс жагсаалтыг УНШИНА (давхардуулж бичихгүй) ── */
const modelsSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'common', 'site', 'site-models.ts'),
  'utf8',
);
const pickList = (name) => {
  const m = modelsSrc.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!m) throw new Error(`${name} олдсонгүй — site-models.ts өөрчлөгдсөн үү?`);
  return [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]);
};
const SCOPED = pickList('SCOPED_MODELS');
const MULTI = pickList('MULTI_SITE_MODELS');

/**
 * ⚠️ САЙТААР САЛГАХ UNIQUE талбарууд.
 *
 * `@unique` → `@@unique([талбар, site])`. Ингэснээр нэг имэйл
 * хоёр сайтад тусдаа данстай байж чадна.
 *
 * ⚠️ guestToken-ыг ОРУУЛААГҮЙ — санамсаргүй UUID тул глобал давтагдашгүй
 * байх нь зөв (сайт хооронд ч давхцахгүй).
 */
const SPLIT_UNIQUE = {
  User: ['email', 'phone', 'googleId', 'facebookId', 'appleId'],
  Subscriber: ['email'],
  Coupon: ['code'],
  Page: ['slug'],
  EmailSuppression: ['email'],
};

let src = fs.readFileSync(SCHEMA, 'utf8');
const before = src;
const log = [];

/** Модел блокийг олж, callback-аар засна. */
function editModel(name, fn) {
  const re = new RegExp(`(^model\\s+${name}\\s*\\{)([\\s\\S]*?)(^\\})`, 'm');
  const m = src.match(re);
  if (!m) {
    log.push(`  ⚠️  ${name} — модел ОЛДСОНГҮЙ`);
    return false;
  }
  const body = fn(m[2], name);
  if (body === null) return false;
  src = src.replace(re, `$1${body}$3`);
  return true;
}

/* ────────────────────────────────────────────────────────
   1. SCOPED — `site` багана + индекс
   ──────────────────────────────────────────────────────── */
let added = 0;
for (const model of SCOPED) {
  const ok = editModel(model, (body, name) => {
    if (/^\s*site\s+String/m.test(body)) {
      log.push(`  ⏭  ${name} — site аль хэдийн бий`);
      return null;
    }

    /* `@@` эхэлсэн эхний мөрийн ӨМНӨ багана нэмнэ (Prisma-гийн ёс) */
    const lines = body.split('\n');
    const atIdx = lines.findIndex((l) => /^\s*@@/.test(l));
    const col =
      '\n  /** ⚠️ Аль сайтынх вэ — besttv | bestfilm. Автомат шүүлтэд ордог. */\n' +
      '  site String @default("besttv")\n';

    let out;
    if (atIdx === -1) {
      /* @@ мөр байхгүй — блокийн төгсгөлд */
      out = body.replace(/\s*$/, `\n${col}`);
    } else {
      lines.splice(atIdx, 0, col);
      out = lines.join('\n');
    }

    /* индекс — site дангаар нь ба createdAt-тай хосолсон */
    const hasCreatedAt = /^\s*createdAt\s+DateTime/m.test(body);
    let idx = '  @@index([site])\n';
    if (hasCreatedAt) idx += '  @@index([site, createdAt])\n';
    out = out.replace(/\s*$/, `\n${idx}`);

    added++;
    log.push(`  ✅ ${name} — site + индекс`);
    return out;
  });
  if (!ok) continue;
}

/* ────────────────────────────────────────────────────────
   2. MULTI — Title.sites String[]
   ──────────────────────────────────────────────────────── */
for (const model of MULTI) {
  editModel(model, (body, name) => {
    if (/^\s*sites\s+String\[\]/m.test(body)) {
      log.push(`  ⏭  ${name} — sites аль хэдийн бий`);
      return null;
    }
    const lines = body.split('\n');
    const atIdx = lines.findIndex((l) => /^\s*@@/.test(l));
    const col =
      '\n  /**\n' +
      '   * ⚠️⚠️ Аль сайтуудад НИЙТЛЭГДСЭН вэ.\n' +
      '   *\n' +
      '   * Кино нь ХУВААЛЦСАН — нэг удаа upload хийгээд хоёр сайтад\n' +
      '   * харагдана (R2 зай 2 дахин хэмнэнэ). Тиймээс ганц `site`\n' +
      '   * биш, массив.\n' +
      '   *\n' +
      '   * Шүүлт: `where: { sites: { has: "bestfilm" } }`\n' +
      '   */\n' +
      '  sites String[] @default(["besttv"])\n';
    if (atIdx === -1) {
      log.push(`  ✅ ${name} — sites (блокийн төгсгөлд)`);
      return body.replace(/\s*$/, `\n${col}\n  @@index([sites], type: Gin)\n`);
    }
    lines.splice(atIdx, 0, col);
    log.push(`  ✅ ${name} — sites + GIN индекс`);
    return lines.join('\n').replace(/\s*$/, '\n  @@index([sites], type: Gin)\n');
  });
}

/* ────────────────────────────────────────────────────────
   3. unique-үүдийг сайтаар салгах
   ──────────────────────────────────────────────────────── */
for (const [model, fields] of Object.entries(SPLIT_UNIQUE)) {
  editModel(model, (body, name) => {
    let out = body;
    const compound = [];
    for (const f of fields) {
      /* `email  String  @unique` → `@unique` хасна */
      const re = new RegExp(`(^\\s*${f}\\s+String\\??[^\\n]*?)\\s@unique`, 'm');
      if (re.test(out)) {
        out = out.replace(re, '$1');
        compound.push(f);
      }
    }
    if (!compound.length) {
      log.push(`  ⏭  ${name} — unique аль хэдийн салгагдсан`);
      return null;
    }
    /* `@@unique([f, site])` мөрүүдийг нэмнэ */
    const block = compound
      .map((f) => `  @@unique([${f}, site])`)
      .join('\n');
    log.push(`  ✅ ${name} — unique салгав: ${compound.join(', ')}`);
    return out.replace(/\s*$/, `\n${block}\n`);
  });
}

/* ── Хадгалах ── */
console.log('┌─ Prisma схемд site нэмэх ─────────────────────');
log.forEach((l) => console.log(l));
console.log('└───────────────────────────────────────────────');
console.log(`SCOPED: ${SCOPED.length} модел · MULTI: ${MULTI.length} · нэмсэн: ${added}`);

if (DRY) {
  console.log('\n--dry — файл ӨӨРЧЛӨГДӨӨГҮЙ');
} else if (src === before) {
  console.log('\nӨөрчлөлт байхгүй — схем аль хэдийн бэлэн');
} else {
  fs.writeFileSync(SCHEMA + '.bak', before, 'utf8');
  fs.writeFileSync(SCHEMA, src, 'utf8');
  console.log(`\n✅ Хадгалав. Нөөц: schema.prisma.bak`);
  console.log('   Дараа нь:  npx prisma format && npx prisma validate');
}
