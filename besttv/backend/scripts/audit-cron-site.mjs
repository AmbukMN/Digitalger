#!/usr/bin/env node
/**
 * CRON-ЫН САЙТЫН ЗӨВ БАЙДЛЫГ ШАЛГАНА.
 *
 * ⚠️⚠️ ЯАГААД ТУСДАА СКРИПТ ВЭ:
 *
 * Cron нь хүсэлтээс ГАДУУР ажилладаг тул `hasSiteContext()=false` →
 * Prisma өргөтгөл шүүлт ХИЙХГҮЙ → БҮХ САЙТЫН мөрийг олно. Энэ нь
 * ихэвчлэн ЗӨВ (хугацаа дуусгах watchdog хоёр сайтыг хамрах ёстой).
 *
 * ГЭВЧ мөр олсныхоо ДАРАА сайт-тусгай зүйл хийвэл БУРУУ болно:
 *   · имэйл илгээх   → `siteConfig()` нь `besttv` буцаана
 *                      → BestFilm-ийн хэрэглэгчид «BestTV» имэйл очно
 *   · QPay дуудах    → `qpayCredentials()` буруу merchant
 *   · холбоос үүсгэх → `besttv.us` руу заана
 *   · Telegram/n8n   → буруу сайтын суваг
 *
 * ЗӨВ ХЭВ ШИНЖ: мөрийг олоод, түүний `site`-аар `runWithSiteAsync`
 * дотор үлдсэн ажлыг гүйцэтгэнэ (`resolveByRecord` үүнийг хийдэг).
 *
 * Хэрэглэх: node scripts/audit-cron-site.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../src');

/**
 * Сайт-тусгай гаж нөлөө — эдгээрийг дуудвал сайт ЗӨВ байх ёстой.
 *
 * ⚠️⚠️ REGEX нь ОЛОН МӨРИЙГ хамрах ёстой. Бодит алдаа: анхны хувилбар
 * `/this\.email\.send/` байсан тул доорх хэлбэрийг АЛДСАН —
 *
 *     const ok = await this.email
 *       .sendPaymentAbandoned({ … })
 *
 * Prettier нь урт гинжийг ингэж таслах тул энэ хэлбэр НИЙТЛЭГ.
 * Тиймээс `[\s\S]*?` буюу мөр дамжсан таарал ашиглана.
 */
const SIDE_EFFECTS = [
  [/siteConfig\(\)/, 'siteConfig() — сайтын нэр/домэйн/имэйл хаяг'],
  [/qpayCredentials\(|qpayTokenCacheKey\(/, 'QPay merchant'],
  [/this\.email[\s\S]{0,80}?\.send\w*\(|\.sendMail\(/, 'имэйл илгээх'],
  [/this\.n8n[\s\S]{0,80}?\.\w+\(/, 'n8n/Telegram мэдэгдэл'],
  [/this\.push[\s\S]{0,80}?\.\w+\(/, 'push мэдэгдэл'],
  /* ⚠️ Домэйн шууд бичсэн бол ч сайт буруу байж болно */
  [/https?:\/\/besttv\.us|https?:\/\/bestfilm\.net/, 'домэйн hardcode'],
];

/** Сайтыг ЗӨВ болгодог хамгаалалтууд */
const GUARDS =
  /runWithSiteAsync|forEachSite|mapEachSite|resolveByRecord|withAllSites/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.ts$/.test(e.name) && !/\.spec\./.test(e.name)) out.push(p);
  }
  return out;
}

/** Олон мөрт тайлбарыг таних (энэ төслийн тайлбар маш дэлгэрэнгүй) */
function commentMask(src) {
  const lines = src.split('\n');
  const mask = new Array(lines.length).fill(false);
  let inBlock = false;
  lines.forEach((line, i) => {
    const t = line.trim();
    if (inBlock) { mask[i] = true; if (t.includes('*/')) inBlock = false; return; }
    if (t.startsWith('//')) { mask[i] = true; return; }
    if (t.startsWith('/*')) { mask[i] = true; if (!t.includes('*/')) inBlock = true; }
  });
  return mask;
}

/** `@Cron` мэдэгдлээс эхлээд функцийн БИЕИЙГ хаалтаар тоолж таслана */
function cronBody(lines, start) {
  let depth = 0;
  let started = false;
  const out = [];
  for (let i = start; i < Math.min(lines.length, start + 200); i++) {
    const line = lines[i];
    out.push(line);
    for (const ch of line) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') depth--;
    }
    if (started && depth <= 0) break;
  }
  return out.join('\n');
}

const findings = [];

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes('@Cron')) continue;
  const lines = src.split('\n');
  const mask = commentMask(src);

  lines.forEach((line, i) => {
    if (mask[i] || !/@Cron\(/.test(line)) return;

    const body = cronBody(lines, i);
    /* Cron-ийн нэр — дараагийн мөрийн метод */
    const name = /(?:async\s+)?(\w+)\s*\(/.exec(lines[i + 1] || '')?.[1] ?? '?';

    const hits = SIDE_EFFECTS.filter(([re]) => re.test(body)).map(([, d]) => d);
    if (!hits.length) return;                 // сайт-тусгай зүйл хийхгүй → зөв
    if (GUARDS.test(body)) return;            // хамгаалагдсан → зөв

    findings.push({
      file: path.relative(path.resolve(HERE, '../../..'), file).replace(/\\/g, '/'),
      line: i + 1,
      name,
      hits,
    });
  });
}

console.log('\n╔═══ CRON × САЙТ АУДИТ ═══╗\n');
if (!findings.length) {
  console.log('  ✅ Бүх cron нь сайт-тусгай үйлдлээ зөв хамгаалсан\n');
} else {
  console.log(`  ⚠️  ${findings.length} cron нь БУРУУ САЙТААР ажиллаж болзошгүй:\n`);
  for (const f of findings) {
    console.log(`  ⛔ ${f.name}()`);
    console.log(`     ${f.file}:${f.line}`);
    console.log(`     сайт-тусгай: ${f.hits.join(' · ')}`);
    console.log(`     → мөрийн site-аар \`runWithSiteAsync\` дотор гүйцэтгэ\n`);
  }
}
console.log('╚═══════════════════════════╝\n');
process.exitCode = findings.length ? 1 : 0;
