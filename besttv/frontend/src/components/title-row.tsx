'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TitleCard as TitleCardType } from '@besttv/shared';
import { cn } from '@besttv/shared';
import { useWheelScroll } from '@/lib/use-wheel-scroll';
import { TitleCard, Top10Card } from './title-card';

interface TitleRowProps {
  title: string;
  items: TitleCardType[];
  /** "Бүгдийг үзэх" холбоос (ж: /movies?genre=dram) */
  href?: string;
  /** Top-10 том дугаартай загвар */
  variant?: 'default' | 'top10';
  /** Continue-watching — item.id → үзсэн хувь */
  progressById?: Record<string, number>;
}

/** Жанрын карусель мөр — hide-scrollbar + чиглэл товч + edge fade (Netflix загвар) */
export function TitleRow({ title, items, href, variant = 'default', progressById }: TitleRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: true });

  const updateScrollState = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanScroll({
      left: el.scrollLeft > 8,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 8,
    });
  };

  const scroll = (dir: 1 | -1) => {
    trackRef.current?.scrollBy({ left: dir * 720, behavior: 'smooth' });
  };

  // Хулганы дугуйгаар хэвтээ гүйлгэнэ (desktop)
  useWheelScroll(trackRef, updateScrollState);

  if (items.length === 0) return null;

  return (
    <section className="px-4 md:px-8" aria-label={title}>
      {/*
        ⚠️ ЖАНРЫН ТОЛГОЙ — гарчиг ЗҮҮН, доогуур нь БҮХ ӨРГӨНӨӨР улаан
        зураас, түүний БАРУУН ҮЗҮҮРТ "БҮГД" товч НААЛДСАН.

        ЯАГААД зураас вэ: өмнө нь зөвхөн товч байсан тул жанрууд хооронд
        хараагаар ЯЛГАРАХГҮЙ, эгнээ бүр нэг урсгал мэт харагддаг байв.
        Зураас нь хэсгийн ХИЛ болж, нүд эгнээ тус бүрийг тусад нь уншина.

        ⚠️ Зураас нь `flex-1` — товч байхгүй үед ч баруун захад хүрнэ.
      */}
      <div className="mb-3 flex items-end gap-3">
        <h2 className="shrink-0 text-lg font-bold tracking-tight text-foreground md:text-xl">
          {title}
        </h2>

        {/* ⚠️ `min-w-0` — урт жанрын нэр байхад зураас шахагдаж алга
            болохоос сэргийлнэ (flex-ийн анхдагч min-width: auto) */}
        <div className="mb-1.5 h-0.5 min-w-0 flex-1 bg-primary" />

        {href && (
          <Link
            href={href}
            /* ⚠️ `-mb-0` + `rounded-t-md` — товч зурааснаас "ургаж"
               гарсан мэт нийлнэ (зураас товчны ёроолтой нэг шугамд) */
            className="group flex shrink-0 items-center gap-1 rounded-t-md bg-primary px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-foreground transition-all hover:brightness-110 active:scale-95"
          >
            Бүгд
            <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      <div className="group/row relative -mx-1 px-1">
        <button
          onClick={() => scroll(-1)}
          aria-label="Зүүн тийш"
          className={cn(
            'absolute -left-2 top-0 bottom-0 z-20 hidden w-12 items-center justify-center bg-linear-to-r from-background via-background/80 to-transparent text-foreground transition-opacity md:flex',
            canScroll.left ? 'opacity-0 group-hover/row:opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <ChevronLeft size={30} />
        </button>

        <div
          ref={trackRef}
          onScroll={updateScrollState}
          className={cn(
            // ⚠️ snap нь ЗӨВХӨН мобайлд (хуруугаар гүйлгэхэд карт цэгцтэй
            // зогсоно). Desktop дээр snap-mandatory нь хулганы дугуй/чирэлтийг
            // гацаадаг тул md-ээс дээш унтраана.
            'hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 pt-1 md:snap-none',
            canScroll.right && 'row-fade-right',
          )}
        >
          {variant === 'top10'
            ? items.slice(0, 10).map((t, i) => <Top10Card key={t.id} title={t} rank={i + 1} />)
            : items.map((t) => (
                <TitleCard key={t.id} title={t} progressPercent={progressById?.[t.id]} />
              ))}
        </div>

        <button
          onClick={() => scroll(1)}
          aria-label="Баруун тийш"
          className={cn(
            'absolute -right-2 top-0 bottom-0 z-20 hidden w-12 items-center justify-center bg-linear-to-l from-background via-background/80 to-transparent text-foreground transition-opacity md:flex',
            canScroll.right ? 'opacity-0 group-hover/row:opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <ChevronRight size={30} />
        </button>
      </div>
    </section>
  );
}
