'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Контент хамгаалалт — санамсаргүй/энгийн хуулбарлалтыг бууруулна.
 *
 * ⚠️⚠️ ҮНЭН БАЙДАЛ — ЭНЭ НЬ ЖИНХЭНЭ ХАМГААЛАЛТ БИШ:
 *   - Browser-ийн цэсээр DevTools нээх, `view-source:`, JS унтраах, эсвэл
 *     өөр browser ашиглахад бүгд тойрогдоно
 *   - Кино хулгайлагчид yt-dlp гэх мэт хэрэгслээр HLS playlist-ыг ШУУД
 *     татдаг — browser огт хэрэглэдэггүй тул эдгээр саад огт нөлөөлөхгүй
 *   - JavaScript-ээр DevTools-ыг НАЙДВАРТАЙ хаах боломжгүй
 *
 * ЖИНХЭНЭ хамгаалалт нь backend талд байгаа:
 *   R2 bucket PRIVATE + segment бүр 4ц presigned URL + эрхийн шалгалт
 *   → m3u8 линк задарсан ч эрхгүй хүн юу ч татаж чадахгүй.
 *
 * Нухацтай хамгаалах цорын ганц зам = DRM (Widevine/FairPlay).
 */

/**
 * DevTools товчлуурын блок (F12, Ctrl+Shift+I/J/C) — ИДЭВХТЭЙ.
 *
 * ⚠️⚠️ ЭНЭ НЬ ЖИНХЭНЭ ХАМГААЛАЛТ БИШ — цэсээр (⋮ → Tools → DevTools)
 * нээх, `view-source:` бичих, JS унтраахад бүгд тойрогдоно. Зорилго нь
 * зөвхөн САНАМСАРГҮЙ/сониуч хэрэглэгчийг саатуулах.
 *
 * ⚠️ Жинхэнэ хамгаалалт нь СЕРВЕР талд: R2 private + Cloudflare Worker
 *    гарын үсэгтэй богино хугацааны линк + эрхийн шалгалт.
 *
 * ⚠️ Хөгжүүлэлтийн үед `npm run dev` (localhost) дээр АЖИЛЛАХГҮЙ —
 *    доор `NODE_ENV` шалгана. Production дээр л блоклоно.
 */
const BLOCK_DEVTOOLS = true;

/**
 * localhost эсэх — хөгжүүлэлтийн үед DevTools хаахгүй.
 * ⚠️ NODE_ENV нь client bundle-д ҮРГЭЛЖ 'production' тул найдваргүй;
 *    hostname шалгах нь цорын ганц найдвартай арга.
 */
const isLocalhost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname);

/** Хамгаалалт хэрэглэхгүй сонголтууд — эдгээрийг блоклобол UX эвдэрнэ */
const ALLOW_SELECTOR = 'input, textarea, select, [contenteditable="true"], [data-allow-copy]';

/** Toast хэт олон гарахаас сэргийлнэ (хэрэглэгч уурлана) */
let lastToast = 0;
function warn(message: string) {
  const now = Date.now();
  if (now - lastToast < 2500) return;
  lastToast = now;
  toast.warning(message, { duration: 2200 });
}

export function ContentProtection() {
  useEffect(() => {
    const inAllowed = (t: EventTarget | null) =>
      t instanceof Element && t.closest(ALLOW_SELECTOR) !== null;

    // ── Баруун товч ──
    const onContextMenu = (e: MouseEvent) => {
      if (inAllowed(e.target)) return; // input дотор баруун товч хэрэгтэй (paste)
      e.preventDefault();
      warn('Контент хамгаалагдсан');
    };

    // ── Хуулах / хайчлах ──
    const onCopy = (e: ClipboardEvent) => {
      if (inAllowed(e.target)) return;
      e.preventDefault();
      warn('Хуулах боломжгүй');
    };

    // ── Чирж авах (зураг/видео) ──
    const onDragStart = (e: DragEvent) => {
      if (inAllowed(e.target)) return;
      e.preventDefault();
    };

    // ── Товчлуурын хослолууд ──
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      /**
       * ⚠️ Энэ блок бодит хулгайг зогсоодоггүй (цэсээр нээх, view-source,
       * JS унтраах — бүгд тойрно). Зорилго нь сониуч хэрэглэгчийг
       * саатуулах.
       *
       * ⚠️ localhost дээр БЛОКЛОХГҮЙ — хөгжүүлэлтийн үед console
       * хаагдвал алдаа оношлох боломжгүй болно.
       */
      if (BLOCK_DEVTOOLS && !isLocalhost) {
        // F12 — DevTools
        if (e.key === 'F12') {
          e.preventDefault();
          warn('Хөгжүүлэгчийн хэрэгсэл идэвхгүй');
          return;
        }

        // Ctrl+Shift+I / J / C — DevTools, console, inspect
        if (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(k)) {
          e.preventDefault();
          warn('Хөгжүүлэгчийн хэрэгсэл идэвхгүй');
          return;
        }
      }

      // Ctrl+U — эх код харах
      if (ctrl && k === 'u') {
        e.preventDefault();
        warn('Эх код харах боломжгүй');
        return;
      }

      // Ctrl+S — хуудас хадгалах
      if (ctrl && k === 's') {
        e.preventDefault();
        warn('Хадгалах боломжгүй');
        return;
      }

      // Ctrl+P — хэвлэх (PDF болгож хадгалах зам)
      if (ctrl && k === 'p') {
        e.preventDefault();
        warn('Хэвлэх боломжгүй');
        return;
      }

      // ⚠️ Ctrl+C/A — зөвхөн input-ээс ГАДУУР блоклоно
      if (ctrl && ['c', 'a', 'x'].includes(k) && !inAllowed(e.target)) {
        e.preventDefault();
        if (k !== 'a') warn('Хуулах боломжгүй');
      }
    };

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return null;
}
