'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackPage } from '@/lib/track';
import { useAuth } from '@/lib/auth-store';

/**
 * Хуудас солигдох бүрд зочиллогыг бүртгэнэ (SPA navigation-ыг ч барина).
 *
 * ⚠️ auth ачаалагдаж дуустал хүлээнэ — эс бөгөөс нэвтэрсэн хэрэглэгчийн
 * анхны хуудас "зочин" болж бүртгэгдэнэ.
 */
export function PageTracker() {
  const pathname = usePathname();
  const authLoading = useAuth((s) => s.loading);
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading || !pathname) return;
    // Ижил хуудсыг давхар бүртгэхгүй (re-render хамгаалалт)
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;
    trackPage(pathname);
  }, [pathname, authLoading]);

  return null;
}
