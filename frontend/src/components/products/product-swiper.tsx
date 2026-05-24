'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@digitalger/shared';
import { ProductCard } from '@/components/products/product-card';
import type { ProductSummary } from '@/types/api';

const GAP = 16;
const AUTO_INTERVAL = 4000;

export function ProductSwiper({
  products,
  mobileRows = 1,
}: {
  products: ProductSummary[];
  mobileRows?: 1 | 2;
}) {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const trackRef  = useRef<HTMLDivElement>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(false);
  const [cardW, setCardW] = useState(0);
  const [rows,  setRows]  = useState(1);

  const calcLayout = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const cols = w >= 1024 ? 4 : 2;
    const r = (cols === 2 && mobileRows === 2) ? 2 : 1;
    setRows(r);
    setCardW(Math.floor((w - GAP * (cols - 1)) / cols));
  }, [mobileRows]);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  const pan = useCallback((dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (dir === 1 && el.scrollLeft >= maxScroll - 4) {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (dir === -1 && el.scrollLeft <= 4) {
      el.scrollTo({ left: maxScroll, behavior: 'smooth' });
    } else {
      el.scrollBy({ left: dir * (el.clientWidth + GAP), behavior: 'smooth' });
    }
  }, []);

  const startAuto = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) pan(1);
    }, AUTO_INTERVAL);
  }, [pan]);

  const pauseAuto  = () => { pausedRef.current = true; };
  const resumeAuto = () => { pausedRef.current = false; };

  useEffect(() => {
    calcLayout();
    const ro = new ResizeObserver(() => { calcLayout(); sync(); });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [calcLayout, sync]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const t = setTimeout(sync, 100);
    el.addEventListener('scroll', sync, { passive: true });
    return () => { clearTimeout(t); el.removeEventListener('scroll', sync); };
  }, [sync, products, cardW]);

  useEffect(() => {
    if (cardW === 0) return;
    const isMobile = window.innerWidth < 1024;
    if (isMobile) return;
    startAuto();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [cardW, startAuto]);

  // Grid: auto-flow column, rows тооноор template тодорхойлно
  // Row бүрийн card ижил өндөртэй (grid stretch default)
  const gridTemplateRows = rows === 2 ? '1fr 1fr' : '1fr';

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={pauseAuto}
      onMouseLeave={resumeAuto}
      onTouchStart={pauseAuto}
      onTouchEnd={resumeAuto}
    >
      <button
        type="button" aria-label="Өмнөх"
        onClick={() => { pauseAuto(); pan(-1); setTimeout(resumeAuto, 3000); }}
        className={cn(
          'absolute -left-5 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-md transition-all duration-200 hover:bg-primary hover:text-primary-foreground',
          canL ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none',
        )}
      ><ChevronLeft className="h-4 w-4" /></button>

      <div
        ref={trackRef}
        className="hide-scrollbar"
        style={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridTemplateRows,
          gridAutoColumns: cardW > 0 ? cardW : undefined,
          gap: GAP,
          overflowX: 'auto',
          paddingTop: 8,
          paddingBottom: 10,
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {cardW > 0 && products.map((p) => (
          <div key={p.id} style={{ scrollSnapAlign: 'start', minWidth: 0 }}>
            <ProductCard product={p} />
          </div>
        ))}
      </div>

      <button
        type="button" aria-label="Дараах"
        onClick={() => { pauseAuto(); pan(1); setTimeout(resumeAuto, 3000); }}
        className={cn(
          'absolute -right-5 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-md transition-all duration-200 hover:bg-primary hover:text-primary-foreground',
          canR ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none',
        )}
      ><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}
