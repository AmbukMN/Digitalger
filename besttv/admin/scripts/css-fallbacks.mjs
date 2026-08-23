/**
 * ⚠️⚠️ ХУУЧИН БРАУЗЕР CSS FALLBACK — build ДАРАА ажиллана.
 *
 * БОДИТ АСУУДАЛ: Tailwind 4 нь opacity utility (bg-foreground/8, text-white/85,
 * bg-black/75 гэх) бүрийг `color-mix(in oklab, var(--foreground) 8%, transparent)`
 * болгож гаргадаг. Хуучин iOS Safari (< 16.2) `color-mix()`-ийг ДЭМЖДЭГГҮЙ тул
 * тэр property бүхэлдээ алдагдаж, карт/товч/текст ЦАГААН эсвэл үл үзэгдэнэ.
 *
 * ЯАГААД BUILD ДАРАА: Next.js webpack loader нь ESM-only @csstools plugin-ыг
 * require() хийж чаддаггүй (ERR_REQUIRE_ESM). Мөн @csstools нь `var()`-тай
 * color-mix-ийг fallback хийж ЧАДДАГГҮЙ (compile-time-д variable мэдэхгүй).
 *
 * ⚠️⚠️ ЭНЭ СКРИПТИЙН ГОЛ АЖИЛ: build CSS доторх
 *   `color-mix(in oklab, var(--X) N%, transparent)`
 * бүрийг олж, ДООР нь `@supports not` блокт
 *   `rgb(var(--X-rgb) / 0.NN)`
 * fallback АВТОМАТААР генерацлана. RGB суваг (--X-rgb) нь shared globals-д
 * light/dark тус тусад тодорхойлогдсон тул theme-ээр солигдоно.
 *
 * ⚠️ БҮХ opacity class-ийг АВТОМАТААР хамарна — гараар нэг ч бичихгүй.
 *    Шинэ browser `@supports not`-ийг алгасна → color-mix хэвээр (давуу тал).
 * ⚠️ Runtime JS ОГТ нэмэгддэггүй → сайт удаашрахгүй.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CSS_DIR = '.next/static/css';

/** var(--X)-ийг --X-rgb суваг руу буулгах — shared globals-д тодорхойлсонтой таарна */
const VAR_TO_RGB = {
  '--foreground': '--fg-rgb',
  '--background': '--bg-rgb',
  '--card': '--card-rgb',
  '--primary': '--primary-rgb',
  '--secondary': '--secondary-rgb',
  '--muted': '--muted-rgb',
  '--accent': '--accent-rgb',
  '--destructive': '--destructive-rgb',
  '--success': '--success-rgb',
  '--warning': '--warning-rgb',
  '--premium': '--premium-rgb',
  '--border': '--border-rgb',
  '--color-black': '--black-rgb',
  '--color-white': '--white-rgb',
};

/**
 * CSS доторх бүх дүрмийг гүйж, доторх нэг ба түүнээс дээш
 * `color-mix(in oklab, var(--X) N%, transparent)` бүхий property-г олоод,
 * тэр property-г `rgb(var(--X-rgb) / a)` болгосон fallback дүрэм үүсгэнэ.
 *
 * ⚠️ Минифицид CSS — селектор{prop:val;prop:val} хэлбэрээр задална.
 */
function buildFallbacks(css) {
  const fallbackRules = [];
  // селектор + { ... } блок бүрийг барина (медиа/supports гүнзгийрүүлэлтгүй энгийн дүрэм)
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(css)) !== null) {
    const selector = m[1].trim();
    const body = m[2];
    if (!selector || selector.startsWith('@')) continue;
    if (!body.includes('color-mix(in oklab,var(')) continue;

    const outProps = [];
    // property:value; тус бүрийг үзнэ
    for (const decl of body.split(';')) {
      const idx = decl.indexOf(':');
      if (idx === -1) continue;
      const prop = decl.slice(0, idx).trim();
      const value = decl.slice(idx + 1).trim();
      // color-mix(in oklab, var(--X) N%, transparent) — эсвэл % бутархайтай
      const cm = value.match(
        /^color-mix\(in oklab,var\((--[a-z-]+)\)\s*([\d.]+)%?,\s*transparent\)$/,
      );
      if (!cm) continue;
      const rgbVar = VAR_TO_RGB[cm[1]];
      if (!rgbVar) continue;
      const alpha = (parseFloat(cm[2]) / 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0');
      outProps.push(`${prop}:rgb(var(${rgbVar}) / ${alpha})`);
    }
    if (outProps.length) {
      fallbackRules.push(`${selector}{${outProps.join(';')}}`);
    }
  }
  return fallbackRules;
}

async function run() {
  let files = [];
  try {
    files = (await readdir(CSS_DIR)).filter((f) => f.endsWith('.css'));
  } catch {
    console.warn(`[css-fallbacks] ${CSS_DIR} олдсонгүй — алгаслаа`);
    return;
  }

  let changed = 0;
  for (const file of files) {
    const path = join(CSS_DIR, file);
    const css = await readFile(path, 'utf8');
    if (!css.includes('color-mix(in oklab,var(')) continue;

    const rules = buildFallbacks(css);
    if (!rules.length) continue;

    /* ⚠️ @supports not блок — ЗӨВХӨН color-mix дэмждэггүй хуучин browser
       энд орно. Шинэ browser алгасна (color-mix хэвээр). !important-гүй ч
       эх дүрэмтэй ижил селектор + дараа байрлах тул cascade-аар давна. */
    const block = `\n@supports not (color:color-mix(in oklab,red,red)){${rules.join('')}}\n`;
    await writeFile(path, css + block, 'utf8');
    changed++;
    const kb = (Buffer.byteLength(css + block) / 1024).toFixed(0);
    console.log(`[css-fallbacks] ${file} — ${rules.length} дүрэмд fallback нэмэв (${kb}KB)`);
  }
  console.log(`[css-fallbacks] ${changed} файлд fallback нэмэгдлээ.`);
}

run().catch((e) => {
  console.error('[css-fallbacks] алдаа:', e);
  process.exit(1);
});
