/**
 * ⚠️⚠️ ХУУЧИН БРАУЗЕР CSS FALLBACK — build ДАРАА ажиллана.
 *
 * БОДИТ АСУУДАЛ: Tailwind 4 нь opacity utility (bg-white/90, text-foreground/60,
 * hover states) бүрийг `color-mix(in oklab, ...)` / `oklch()` болгож гаргадаг.
 * Хуучин iOS Safari (< 16.2) эдгээрийг ДЭМЖДЭГГҮЙ тул property бүхэлдээ
 * алдагдаж, карт/товч ЦАГААН харагдана.
 *
 * ЯАГААД BUILD ДАРАА (Next.js postcss биш): Next.js webpack loader нь ESM-only
 * plugin (@csstools/*)-ыг require() хийж чаддаггүй (ERR_REQUIRE_ESM). Тиймээс
 * Next build-ийн ГАРАЛТ CSS-ийг ЭНД тусдаа боловсруулна — build tooling-д
 * хамааралгүй, найдвартай.
 *
 * ⚠️ preserve: true — fallback + оригинал ХОЁУЛАНГ үлдээнэ:
 *   • Хуучин browser → rgb() fallback (эхэнд)
 *   • Шинэ browser  → color-mix/oklch (cascade-аар дарна, давуу тал хэвээр)
 *
 * ⚠️ ЗӨВХӨН build-time. Runtime JS ОГТ нэмэгддэггүй → сайт удаашрахгүй.
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import postcss from 'postcss';
import oklabFunction from '@csstools/postcss-oklab-function';
import colorMixFunction from '@csstools/postcss-color-mix-function';

const CSS_DIR = '.next/static/css';

const processor = postcss([
  // oklch/oklab → rgb fallback (эхэлж — color-mix дотор ч байж болно)
  oklabFunction({ preserve: true, subFeatures: { displayP3: false } }),
  // color-mix() → rgb fallback
  colorMixFunction({ preserve: true }),
]);

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
    const before = await readFile(path, 'utf8');
    // Хурдан шалгалт — fallback хэрэгтэй эсэх
    if (!before.includes('color-mix') && !before.includes('oklab') && !before.includes('oklch')) {
      continue;
    }
    const result = await processor.process(before, { from: path, to: path });
    if (result.css !== before) {
      await writeFile(path, result.css, 'utf8');
      changed++;
      const kb = (Buffer.byteLength(result.css) / 1024).toFixed(0);
      console.log(`[css-fallbacks] ${file} — fallback нэмэв (${kb}KB)`);
    }
  }
  console.log(`[css-fallbacks] ${changed} файлд fallback нэмэгдлээ.`);
}

run().catch((e) => {
  console.error('[css-fallbacks] алдаа:', e);
  process.exit(1);
});
