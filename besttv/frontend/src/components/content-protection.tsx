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

/** DevTools товчлуурын блок (F12, Ctrl+Shift+I/J/C) */
const BLOCK_DEVTOOLS = true;

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
       * JS унтраах — бүгд тойрно). Оношилгоо хийхэд саад болвол дээрх
       * `BLOCK_DEVTOOLS`-ыг түр `false` болгоно.
       */
      if (BLOCK_DEVTOOLS) {
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
