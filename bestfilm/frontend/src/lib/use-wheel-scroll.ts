'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Хулганы дугуйгаар ХЭВТЭЭ гүйлгэх (карусель).
 *
 * ⚠️ Хэвийн хулганы дугуй нь зөвхөн босоо (deltaY) утга өгдөг тул хэвтээ
 * карусель огт хөдөлдөггүй. Үүнийг хэвтээ гүйлт рүү хөрвүүлнэ.
 *
 * ⚠️ `addEventListener` + `{ passive: false }` ЗААВАЛ — React-ийн `onWheel`
 * нь passive тул `preventDefault()` ажиллахгүй.
 *
 * Ирмэгт хүрсэн үед preventDefault хийхгүй — хуудас хэвийн доош гүйнэ
 * (эс бөгөөс хэрэглэгч карусель дээр гацна).
 */
export function useWheelScroll(
  ref: RefObject<HTMLElement | null>,
  onScrolled?: () => void,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Трекпадын жинхэнэ хэвтээ дохиог хөндөхгүй
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;

      e.preventDefault();
      el.scrollLeft += e.deltaY;
      onScrolled?.();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}
