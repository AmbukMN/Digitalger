'use client';

import { useEffect, useState } from 'react';
import { IN_APP_DOWNLOAD_EVENT } from '@/lib/download-helper';
import { OpenInBrowserModal } from '@/components/open-in-browser-modal';

// ─── Global modal host ─────────────────────────────────────────────────────
// In-app browser (FB/IG) дотор татах боломжгүй болоход triggerFileDownload нь
// IN_APP_DOWNLOAD_EVENT ялгаруулна. Энэ host бүх хуудсанд (layout-д) сууж,
// тэр event-ийг сонсож "Safari-д нээ" заавар modal-ийг харуулна. Ингэснээр
// татах товч бүрт modal нэмэх шаардлагагүй — нэг газар хангагдана.
export function InAppBrowserModalHost() {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ url?: string }>).detail;
      setUrl(detail?.url ?? window.location.href);
    };
    window.addEventListener(IN_APP_DOWNLOAD_EVENT, handler);
    return () => window.removeEventListener(IN_APP_DOWNLOAD_EVENT, handler);
  }, []);

  return (
    <OpenInBrowserModal
      open={!!url}
      url={url ?? ''}
      onClose={() => setUrl(null)}
    />
  );
}
