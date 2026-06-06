'use client';

import { useEffect, useState } from 'react';
import { BROWSER_SWITCH_EVENT } from '@/lib/download-helper';
import { BrowserSwitchModal } from '@/components/browser-switch-modal';

// ─── Global browser-switch host ────────────────────────────────────────────
// FB/IG доторх браузарт татах/үйлдэл хийх боломжгүй болоход triggerFileDownload
// (эсвэл бусад) BROWSER_SWITCH_EVENT ялгаруулна. Энэ host бүх хуудсанд (layout)
// сууж тэр event-ийг сонсож системийн браузар руу шилжих modal харуулна.
// Ингэснээр library/татах товч бүрт modal нэмэх шаардлагагүй — нэг газар хангана.
export function BrowserSwitchHost() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ targetPath?: string }>).detail;
      setTarget(detail?.targetPath ?? '/library');
    };
    window.addEventListener(BROWSER_SWITCH_EVENT, handler);
    return () => window.removeEventListener(BROWSER_SWITCH_EVENT, handler);
  }, []);

  return (
    <BrowserSwitchModal
      open={!!target}
      targetPath={target ?? '/library'}
      onClose={() => setTarget(null)}
    />
  );
}
