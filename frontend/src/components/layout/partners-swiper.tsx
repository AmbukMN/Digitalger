'use client';

import type { Partner } from '@/types/api';

/**
 * Хамтрагчдын лого автоматаар цуваж гүйх (marquee) — footer-ийн дээд талд.
 * ⚠️ CSS transform animation ашиглана (JS scrollLeft БИШ). Шалтгаан: iOS Safari
 * (iPhone 7 гэх мэт) дээр JS-ээр scrollLeft өөрчлөхөд momentum batching болж 3 сек
 * тутам үсэрч хөдөлдөг. CSS @keyframes translateX нь GPU compositing тул iOS дээр ч
 * төгс жигд гүйнэ. Logo-уудыг 2 дахин давтаж тасралтгүй loop (50% шилжихэд эхэнд эргэнэ).
 * Hover/touch үед зогсоно (CSS animation-play-state).
 */
export function PartnersSwiper({ partners }: { partners: Partner[] }) {
  if (!partners.length) return null;

  // Loop-д зориулж 2 дахин давтана (1-р багц гүйж дуусахад 2 дахь нь үргэлжилнэ)
  const loop = [...partners, ...partners];
  // Хурд: лого тоо ихсэх тусам бага зэрэг удаашруулна (жигд мэдрэмж)
  const durationSec = Math.max(20, partners.length * 3);

  return (
    <section className="overflow-hidden border-b border-border/60 py-5" aria-label="Хамтрагч байгууллагууд">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Бидэнтэй хамтрагч байгууллагууд
        </p>
        {/* mask — хоёр захад зөөлөн бүдгэрэлт (gradient fade) */}
        <div className="partners-marquee-mask overflow-hidden">
          <div
            className="partners-marquee flex w-max items-center gap-10"
            style={{ animationDuration: `${durationSec}s` }}
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
      </div>
    </section>
  );
}
