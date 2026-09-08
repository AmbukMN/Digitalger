/**
 * ⚠️ BESTFILM REBRAND — ХОЁРДУГААР ДАВАЛГАА.
 *
 * Эхний скрипт нь код доторх утгуудыг зассан. Энэ нь SEO-ийн
 * тайлбар текст, layout-ийн мета, localStorage түлхүүрийг засна.
 *
 * ⚠️ SEO тайлбар нь Google-д индексжинэ — «BestTV» үлдвэл
 * BestFilm-ийн хуудас өөр брэндээр хайлтад гарна.
 */
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const ROOT = path.join(import.meta.dirname, '..', 'src');

const SUBS = [
  /* ── SEO fallback ── */
  [`'https://besttv.us'`, `'https://bestfilm.net'`],
  [`const FALLBACK_SITE_NAME = 'BestTV';`, `const FALLBACK_SITE_NAME = 'BestFilm';`],

  /* ── Хуудсын мета тайлбар (Google-д индексжинэ) ── */
  [
    `'Монголын кино урлагийн мэдээ, шинэ нээлт, ярилцлага, зөвлөмж — BestTV блог.'`,
    `'Монголын кино урлагийн мэдээ, шинэ нээлт, ярилцлага, зөвлөмж — BestFilm блог.'`,
  ],
  [
    `'BestTV-ийн багц, төлбөр, тоглуулалт, бүртгэлтэй холбоотой түгээмэл асуултын хариулт.'`,
    `'BestFilm-ийн багц, төлбөр, тоглуулалт, бүртгэлтэй холбоотой түгээмэл асуултын хариулт.'`,
  ],
  [
    `'Таны үзэх дуртай бүх төрлийн кино — BestTV дээр эрэлттэй, шинэ бүгд.'`,
    `'Таны үзэх дуртай бүх төрлийн кино — BestFilm дээр эрэлттэй, шинэ бүгд.'`,
  ],
  [
    `'BestTV-ийн сарын, улирлын, жилийн багцууд — QPay-ээр хялбар төлбөр.'`,
    `'BestFilm-ийн сарын, улирлын, жилийн багцууд — QPay-ээр хялбар төлбөр.'`,
  ],
  [`'BestTV дээрх кино, цуврал хайх.'`, `'BestFilm дээрх кино, цуврал хайх.'`],

  /* ── Дэлгэц дээрх текст ── */
  [
    `BestTV — Монгол кино, цуврал онлайнаар үзэх`,
    `BestFilm — Монгол кино, цуврал онлайнаар үзэх`,
  ],
  [`aria-label="BestTV AI туслах"`, `aria-label="BestFilm AI туслах"`],
  [`BestTV AI — кино сонгоход тусална`, `BestFilm AI — кино сонгоход тусална`],

  /* ── localStorage — домэйн тусдаа ч нэрийг цэвэрлэнэ ── */
  [`'besttv:cue-size'`, `'bestfilm:cue-size'`],
  [`'besttv:cue-bg'`, `'bestfilm:cue-bg'`],

  /* ── Тайлбар (код биш ч ойлгомжтой байлгана) ── */
  [`// BestTV API клиент`, `// BestFilm API клиент`],
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

let touched = 0, total = 0;
const hits = new Set();

for (const file of walk(ROOT)) {
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  let n = 0;
  for (const [find, repl] of SUBS) {
    if (!s.includes(find)) continue;
    const c = s.split(find).length - 1;
    s = s.split(find).join(repl);
    n += c;
    hits.add(find);
  }
  if (s !== before) {
    if (!DRY) fs.writeFileSync(file, s, 'utf8');
    console.log(`  ✅ ${path.relative(path.join(ROOT, '..'), file).split('\\').join('/')} — ${n}`);
    touched++; total += n;
  }
}
console.log(`\n${touched} файл · ${total} орлуулалт${DRY ? '  (--dry)' : ''}`);

const unused = SUBS.filter(([f]) => !hits.has(f));
if (unused.length) {
  console.log('\n⚠️ ОЛДООГҮЙ:');
  unused.forEach(([f]) => console.log(`   · ${f.slice(0, 70)}`));
}
