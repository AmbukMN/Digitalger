/**
 * ⚠️⚠️ САЙТААР САЛГАГДААГҮЙ ЗҮЙЛСИЙГ ОЛОХ — БҮРЭН СКАН.
 *
 * Prisma өргөтгөл нь моделийн query-г автоматаар шүүдэг. Гэхдээ
 * ДАРААХ ГАЗРУУД хамрагдахгүй — гараар шалгах ЁСТОЙ:
 *
 *   1. `$queryRaw`            — өргөтгөлөөр дамждаггүй
 *   2. `Settings` түлхүүр     — модел SHARED, түлхүүрээр салгана
 *   3. Хатуу бичсэн домэйн    — besttv.us, @besttv.mn
 *   4. Хатуу бичсэн брэнд     — «BestTV» текст
 *   5. Хатуу бичсэн өнгө      — #e50914
 *   6. env хувьсагч           — FRONTEND_URL, MAIL_FROM (нэг утга)
 *   7. Гадаад webhook зам     — /webhook/besttv-*
 *
 * Ажиллуулах: node scripts/audit-site-gaps.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', 'src');

/** Шалгахгүй файлууд — эдгээр нь САЙТЫН тодорхойлолт өөрөө */
const SKIP = [
  'common/site/',
  '/site-config.ts',
  '/site.constants.ts',
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Мөр нь тайлбар мөн эсэх */
const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);

const findings = [];
const add = (kind, file, line, text) =>
  findings.push({ kind, file: file.split('\\').join('/'), line, text: text.trim().slice(0, 96) });

for (const file of walk(ROOT)) {
  const rel = path.relative(path.join(ROOT, '..'), file);
  if (SKIP.some((s) => rel.split('\\').join('/').includes(s))) continue;

  const lines = fs.readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, i) => {
    const n = i + 1;
    if (isComment(line)) return;

    /* ── 3. Хатуу домэйн ── */
    if (/besttv\.(us|mn|test)/.test(line) && !line.includes('siteConfig')) {
      add('домэйн', rel, n, line);
    }

    /* ── 4. Хатуу брэнд ── */
    if (/['"`][^'"`]*BestTV/.test(line) && !line.includes('siteConfig') && !line.includes('SITE_LABEL')) {
      add('брэнд', rel, n, line);
    }

    /* ── 5. Хатуу өнгө ── */
    if (/#[eE]50914/.test(line)) add('өнгө', rel, n, line);

    /* ── 6. Нэг утгатай env ── */
    if (/process\.env\.(FRONTEND_URL|MAIL_FROM|PUBLIC_API_URL|SITE_URL|EMAIL_LOGO_URL)\b/.test(line)) {
      add('env', rel, n, line);
    }
    if (/config\.get<string>\('(FRONTEND_URL|MAIL_FROM|PUBLIC_API_URL|EMAIL_LOGO_URL)'\)/.test(line)) {
      add('env', rel, n, line);
    }

    /* ── 7. Webhook зам ── */
    if (/\/webhook\/besttv-/.test(line)) add('webhook', rel, n, line);

    /**
     * ── 2. Settings түлхүүр siteKey-гүй ──
     *
     * ⚠️ ЦАГААН ЖАГСААЛТ — ҮНЭХЭЭР нийтлэг тохиргоо:
     *   BILLING_KEY — USD/MNT ханш (нэг ханш, хоёр сайт)
     *   STORAGE_*   — R2-ийн зай (нэг bucket)
     */
    if (
      /key:\s*[A-Z_]+_KEY\b/.test(line) &&
      !line.includes('siteKey') &&
      !/\b(BILLING_KEY|STORAGE_[A-Z_]*KEY)\b/.test(line)
    ) {
      add('settings', rel, n, line);
    }
  });

  /* ── 1. raw SQL — site шүүлттэй эсэх ── */
  /**
   * ⚠️⚠️ ТАЙЛБАРЫГ ЭХЛЭЭД ХАСНА.
   *
   * Эс бөгөөс «`$queryRaw` нь Prisma-гийн …» гэсэн ТАЙЛБАР текст
   * нь бодит дуудлага мэт танигдаж ХУДАЛ ЭЕРЭГ өгнө — энэ скрипт
   * өөрөө тэр алдааг гаргаж, засварласан газрыг «цоорхой» гэж
   * зааж байв.
   */
  const src = lines.map((l) => (isComment(l) ? '' : l)).join('\n');

  for (const m of src.matchAll(/\$queryRaw(?:<[^>]*>)?`([\s\S]{0,900}?)`/g)) {
    const sql = m[1];
    /* `SELECT 1` мэтийн health check — өгөгдөл уншдаггүй */
    if (/^\s*SELECT\s+1\s*$/i.test(sql.trim())) continue;
    if (!/currentSite\(\)/.test(sql)) {
      const line = src.slice(0, m.index).split('\n').length;
      add('rawSQL', rel, line, sql.split('\n').find((l) => /FROM|SELECT/i.test(l)) ?? sql);
    }
  }
}

/* ── Тайлан ── */
const KIND_INFO = {
  rawSQL: ['⛔ КРИТИК', 'raw SQL нь өргөтгөлөөр дамждаггүй — site ГАРААР нэмнэ'],
  settings: ['⛔ КРИТИК', 'Settings түлхүүр — `siteKey(...)` ашиглана'],
  webhook: ['⚠️ АНХААР', 'n8n зам — body-д `site` явдаг эсэхийг шалга'],
  домэйн: ['⚠️ АНХААР', '`siteConfig().domain` / `.url` ашиглана'],
  брэнд: ['⚠️ АНХААР', '`siteConfig().name` ашиглана'],
  өнгө: ['⚠️ АНХААР', '`siteConfig().brandColor` ашиглана'],
  env: ['ℹ️ МЭДЭЭЛЭЛ', 'нэг утгатай env — сайтаар өөр байх ёстой юу?'],
};

console.log('\n╔═══ САЙТЫН ЦООРХОЙН ШАЛГАЛТ ═══╗\n');

let critical = 0;
for (const kind of Object.keys(KIND_INFO)) {
  const list = findings.filter((f) => f.kind === kind);
  const [level, hint] = KIND_INFO[kind];
  if (!list.length) {
    console.log(`${level.padEnd(12)} ${kind.padEnd(9)} ✅ цэвэр`);
    continue;
  }
  if (level.startsWith('⛔')) critical += list.length;
  console.log(`\n${level} ${kind} (${list.length}) — ${hint}`);
  for (const f of list) console.log(`   ${f.file}:${f.line}\n      ${f.text}`);
}

console.log(
  critical
    ? `\n╚═══ ⛔ ${critical} КРИТИК · нийт ${findings.length} ═══╝\n`
    : `\n╚═══ ✅ критик цоорхой байхгүй · нийт ${findings.length} тэмдэглэл ═══╝\n`,
);
process.exit(critical ? 1 : 0);
