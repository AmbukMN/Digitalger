'use client';

import { useEffect } from 'react';

/**
 * Service worker бүртгэгч.
 * - Зөвхөн production-д бүртгэнэ (dev-д SW кэш HMR-ийг эвдэнэ).
 * - Алдаа гарвал чимээгүй (try/catch) — SW нэмэлт сайжруулалт болохоос
 *   гол функцэд саад болохгүй.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch {
        // Чимээгүй — SW бүртгэгдэхгүй байсан ч сайт хэвийн ажиллана
      }
    };

    // Анхны ачаалал дуустал хүлээгээд бүртгэх (гол контентэд саад болохгүй)
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
