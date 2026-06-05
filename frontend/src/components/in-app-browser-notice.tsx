'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import { isInAppBrowser, inAppBrowserName, isIOS } from '@/lib/download-helper';

// ─── In-app browser сэрэмжлүүлэг баннер ────────────────────────────────────
// Facebook/Instagram/Messenger зэрэг апп доторх браузер файл татахыг
// хязгаарладаг тул хэрэглэгчид "гадаад браузераар нээ" гэж зөвлөнө.
// Зөвхөн in-app browser илэрсэн үед л харагдана (бусад тохиолдолд null).
export function InAppBrowserNotice() {
  const [show, setShow] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    // Client дээр л шалгана (UA hydration mismatch-аас сэргийлж effect-д).
    if (isInAppBrowser()) {
      setShow(true);
      setName(inAppBrowserName());
      setIos(isIOS());
    }
  }, []);

  if (!show) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 dark:border-amber-700/50 dark:bg-amber-950/30">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400">
        <Info className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-amber-800 dark:text-amber-300">
          {name ?? 'Энэ'} доторх браузераар орсон байна
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-700/90 dark:text-amber-400/80">
          Файл татахад асуудал гарвал, баруун дээд буланд байрлах{' '}
          <span className="inline-flex items-center gap-0.5 font-semibold">
            <ExternalLink className="h-3 w-3" />···
          </span>{' '}
          цэсийг дарж{' '}
          <span className="font-semibold">
            {ios ? '«Safari-д нээх»' : '«Системийн браузераар нээх»'}
          </span>{' '}
          сонгоод дахин татаж үзнэ үү.
        </p>
      </div>
    </div>
  );
}
