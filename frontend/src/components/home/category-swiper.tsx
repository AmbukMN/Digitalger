'use client';

import Link from 'next/link';
import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DynamicLucideIcon } from '@/components/ui/lucide-icon';
import { cn } from '@digitalger/shared';
import type { Category } from '@/types/api';

const COLORS = [
  'from-blue-500/20 to-blue-600/10 text-blue-600 dark:text-blue-400',
  'from-amber-500/20 to-amber-600/10 text-amber-600 dark:text-amber-400',
  'from-emerald-500/20 to-emerald-600/10 text-emerald-600 dark:text-emerald-400',
  'from-violet-500/20 to-violet-600/10 text-violet-600 dark:text-violet-400',
  'from-rose-500/20 to-rose-600/10 text-rose-600 dark:text-rose-400',
  'from-cyan-500/20 to-cyan-600/10 text-cyan-600 dark:text-cyan-400',
  'from-orange-500/20 to-orange-600/10 text-orange-600 dark:text-orange-400',
  'from-indigo-500/20 to-indigo-600/10 text-indigo-600 dark:text-indigo-400',
];

const ITEM_W = 132;
const GAP    = 12;

export function CategorySwiper({ categories }: { categories: Category[] }) {
  const trackRef             = useRef<HTMLDivElement>(null);
  const [canL, setCanL]      = useState(false);
  const [canR, setCanR]      = useState(false);
  const [ready, setReady]    = useState(false);

  /* mount flag — prevents hydration mismatch on icons */
  useEffect(() => { setReady(true); }, []);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const t = setTimeout(sync, 100);
    el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => { clearTimeout(t); el.removeEventListener('scroll', sync); ro.disconnect(); };
  }, [sync, categories]);

  const pan = (dir: -1 | 1) => {
    trackRef.current?.scrollBy({ left: dir * (ITEM_W * 3 + GAP * 2), behavior: 'smooth' });
  };

  return (
    <div className="relative">
      {/* ← */}
      <button
        type="button" aria-label="Өмнөх" onClick={() => pan(-1)}
        className={cn(
          'absolute -left-5 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-md transition-all duration-200 hover:bg-primary hover:text-primary-foreground',
          canL ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none',
        )}
      ><ChevronLeft className="h-4 w-4" /></button>

      {/* track — paddingTop leaves space so hover:-translate-y-1 isn't clipped */}
      <div
        ref={trackRef}
        className="hide-scrollbar"
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          gap: `${GAP}px`,
          overflowX: 'auto',
          paddingTop: '8px',
          paddingBottom: '10px',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x',
        }}
      >
        {categories.map((cat, i) => (
          <Link
            key={cat.id}
            href={`/categories/${cat.slug}`}
            style={{
              width: `${ITEM_W}px`,
              minWidth: `${ITEM_W}px`,
              maxWidth: `${ITEM_W}px`,
              flexShrink: 0,
              flexGrow: 0,
              scrollSnapAlign: 'start',
            }}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4 text-center transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:-translate-y-1"
          >
            <div className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br transition-transform duration-200 group-hover:scale-110',
              COLORS[i % COLORS.length],
            )}>
              {ready ? (
                <DynamicLucideIcon
                  name={cat.icon ?? null}
                  className="h-6 w-6"
                  fallback={<span className="text-sm font-bold">{cat.name.slice(0, 2).toUpperCase()}</span>}
                />
              ) : (
                <span className="text-sm font-bold">{cat.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>

            <div className="w-full min-w-0">
              <p className="truncate text-xs font-semibold leading-snug transition-colors group-hover:text-primary">
                {cat.name}
              </p>
              {cat._count?.products !== undefined && (
                <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {cat._count.products} бүтээгдэхүүн
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* → */}
      <button
        type="button" aria-label="Дараах" onClick={() => pan(1)}
        className={cn(
          'absolute -right-5 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-md transition-all duration-200 hover:bg-primary hover:text-primary-foreground',
          canR ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none',
        )}
      ><ChevronRight className="h-4 w-4" /></button>

    </div>
  );
}
