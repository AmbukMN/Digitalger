'use client';

import { useEffect, useRef, useState } from 'react';
import type { Partner } from '@/types/api';

/**
 * Хамтрагчдын лого автоматаар цуваж гүйх (marquee) swiper — footer-ийн дээд талд.
 * Logo-уудыг 2 дахин давтаж тасралтгүй гүйлгэнэ (loop). Хэрэглэгч hover хийхэд зогсоно.
 * Логогүй хамтрагчид нэрээр харагдана.
 */
export function PartnersSwiper({ partners }: { partners: Partner[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  // Тасралтгүй автомат гүйлгэлт (requestAnimationFrame). Reduced-motion бол зогсооно.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last = 0;
    const SPEED = 0.04; // px/ms (~40px/сек, зөөлөн)
    const step = (t: number) => {
      if (last === 0) last = t;
      const dt = t - last;
      last = t;
      if (!paused) {
        el.scrollLeft += SPEED * dt;
        // Хагас (давталтын эхэнд) хүрвэл эхлэл рүү буцаана (тасралтгүй мэдрэгдэнэ)
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half) el.scrollLeft -= half;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  if (!partners.length) return null;

  // Loop-д зориулж 2 дахин давтана
  const loop = [...partners, ...partners];

  return (
    <section className="border-b border-border/60 py-5" aria-label="Хамтрагч байгууллагууд">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Бидэнтэй хамтрагч байгууллагууд
        </p>
        <div
          ref={trackRef}
          className="hide-scrollbar flex items-center gap-8 overflow-x-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          {loop.map((p, i) => {
            const inner = (
              <div className="flex h-12 shrink-0 items-center justify-center" title={p.name}>
                {p.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.logo}
                    alt={p.name}
                    className="h-10 w-auto max-w-[140px] object-contain opacity-70 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                ) : (
                  <span className="whitespace-nowrap text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
                    {p.name}
                  </span>
                )}
              </div>
            );
            return p.website ? (
              <a key={`${p.id}-${i}`} href={p.website} target="_blank" rel="noopener noreferrer" className="shrink-0">
                {inner}
              </a>
            ) : (
              <div key={`${p.id}-${i}`} className="shrink-0">{inner}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
