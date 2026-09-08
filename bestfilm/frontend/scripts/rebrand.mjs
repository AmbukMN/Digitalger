/**
 * ⚠️⚠️ BESTFILM FRONTEND — БРЭНД СОЛИХ (нэг удаагийн скрипт).
 *
 * Энэ frontend нь BestTV-ээс хуулагдсан. Кодод тархсан «BestTV»
 * бичээсийг `BRAND` тохиргоо руу шилжүүлнэ.
 *
 * ⚠️⚠️ ХӨНДӨХГҮЙ ЗҮЙЛС:
 *   · `@besttv/shared` импорт — ХУВААЛЦСАН пакет, нэр нь өөрчлөгдөхгүй
 *   · `besttv-player` гэх мэт localStorage түлхүүр — хөтөч дэх
 *     өгөгдөл, өөрчилвөл хэрэглэгчийн тохиргоо алга болно... ГЭХДЭЭ
 *     BestFilm нь ӨӨР домэйн тул localStorage ч тусдаа → аюулгүй,
 *     нэрийг нь цэвэрлэвэл ойлгомжтой
 *   · Тайлбар доторх «BestTV» — код биш
 *
 * Ажиллуулах:  node scripts/rebrand.mjs
 *              node scripts/rebrand.mjs --dry
 */
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const ROOT = path.join(import.meta.dirname, '..', 'src');

/** import мөрийг файлын сүүлийн import-ын дараа нэмнэ */
function addImport(src, spec, marker) {
  if (src.includes(marker)) return src;
  const imports = [...src.matchAll(/^import [^\n]*;$/gm)];
  if (!imports.length) return `${spec}\n${src}`;
  const last = imports[imports.length - 1];
  const at = last.index + last[0].length;
  return src.slice(0, at) + '\n' + spec + src.slice(at);
}

/**
 * Орлуулалтууд — [хайх, солих, importХэрэгтэйЭсэх]
 *
 * ⚠️ Дараалал ЧУХАЛ: урт нь эхэлнэ (богино нь урт дотор орохгүй).
 */
const SUBS = [
  /* ── SEO / мета ── */
  [`'BestTV — Үз, мэдэр, дахин үз'`, 'BRAND.metaTitle', true],
  [`seo?.siteName ?? 'BestTV'`, 'seo?.siteName ?? BRAND.name', true],
  [`seo?.siteName || 'BestTV'`, 'seo?.siteName || BRAND.name', true],
  [`brand?.siteName ?? 'BestTV'`, 'brand?.siteName ?? BRAND.name', true],
  [`name: 'BestTV',`, 'name: BRAND.name,', true],

  /* ── Киноны тайлбар ── */
  ['`${title.title} — BestTV дээр онлайнаар үзэх`', '`${title.title} — ${BRAND.name} дээр онлайнаар үзэх`', true],

  /* ── Чат ── */
  [`'BestTV Багийн гишүүн'`, '`${BRAND.name} Багийн гишүүн`', true],
  [`'BestTV AI'`, '`${BRAND.name} AI`', true],
  [`'BestTV баг'`, '`${BRAND.name} баг`', true],
  ['Би BestTV-ийн AI туслах', 'Би ${BRAND.name}-ийн AI туслах', true],

  /* ── Холбоо барих ── */
  ['support@besttv.us', 'support@bestfilm.net', false],

  /* ── localStorage / DOM id — домэйн тусдаа тул аюулгүй ── */
  [`storage="besttv-player"`, 'storage="bestfilm-player"', false],
  [`id: 'besttv-bridge'`, `id: 'bestfilm-bridge'`, false],

  /* ── Analytics ── */
  [`site: 'besttv'`, `site: 'bestfilm'`, false],

  /* ── Chat webhook ── */
  [
    `'https://bot.digitalger.mn/webhook/besttv-chat'`,
    `'https://bot.digitalger.mn/webhook/bestfilm-chat'`,
    false,
  ],
];

const IMPORT_SPEC = "import { BRAND } from '@/lib/brand';";

/** Файлуудыг рекурсээр цуглуулна */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !p.includes('lib\\brand.ts') && !p.includes('lib/brand.ts')) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(ROOT);
let touched = 0;
let total = 0;
const hits = new Map();

for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  let needImport = false;
  let n = 0;

  for (const [find, repl, wantsImport] of SUBS) {
    if (!s.includes(find)) continue;
    const c = s.split(find).length - 1;
    s = s.split(find).join(repl);
    n += c;
    if (wantsImport) needImport = true;
    hits.set(find, (hits.get(find) ?? 0) + c);
  }

  if (n && needImport) s = addImport(s, IMPORT_SPEC, "from '@/lib/brand'");

  if (s !== before) {
    if (!DRY) fs.writeFileSync(file, s, 'utf8');
    const rel = path.relative(path.join(ROOT, '..'), file).split('\\').join('/');
    console.log(`  ✅ ${rel} — ${n}`);
    touched++;
    total += n;
  }
}

console.log(`\n${touched} файл · ${total} орлуулалт${DRY ? '  (--dry, бичээгүй)' : ''}`);

/* ⚠️ Ашиглагдаагүй хэв маягийг МЭДЭГДЭНЭ — чимээгүй алгасахгүй */
const unused = SUBS.filter(([f]) => !hits.has(f));
if (unused.length) {
  console.log('\n⚠️ ОЛДООГҮЙ хэв маягууд (кодод байхгүй эсвэл өөрчлөгдсөн):');
  unused.forEach(([f]) => console.log(`   · ${f.slice(0, 72)}`));
}
