'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { cn } from '@besttv/shared';
import { ErrorState } from '@besttv/shared/ui';
import { useFaqs } from '@/lib/queries';

export default function FaqPage() {
  const { data, isLoading, isError, refetch } = useFaqs();
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set((data ?? []).map((f) => f.category));
    return Array.from(set);
  }, [data]);

  const filtered = (data ?? []).filter((f) => !activeCategory || f.category === activeCategory);

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-28 md:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-xs font-bold text-white/70">
          <HelpCircle size={12} /> ТУСЛАМЖ
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">
          Түгээмэл асуулт
        </h1>
        <p className="mt-3 text-white/55">Танд хэрэгтэй мэдээллийг эндээс олоорой</p>
      </div>

      {categories.length > 1 && (
        <div className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              !activeCategory ? 'bg-primary text-white' : 'bg-white/8 text-white/60 hover:bg-white/12',
            )}
          >
            Бүгд
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                activeCategory === c ? 'bg-primary text-white' : 'bg-white/8 text-white/60 hover:bg-white/12',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="mx-auto mt-8 max-w-2xl space-y-3">
        {isError && (
          <ErrorState
            title="Ачаалж чадсангүй"
            message="Асуултуудыг татаж чадсангүй."
            onRetry={() => refetch()}
          />
        )}

        {isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-14 rounded-xl" />
          ))}

        {filtered.map((f) => {
          const open = openId === f.id;
          return (
            <div key={f.id} className="overflow-hidden rounded-xl bg-white/5">
              <button
                onClick={() => setOpenId(open ? null : f.id)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <span className="font-medium text-white/90">{f.question}</span>
                <ChevronDown
                  size={18}
                  className={cn('shrink-0 text-white/40 transition-transform', open && 'rotate-180')}
                />
              </button>
              {open && (
                <p className="px-5 pb-4 text-sm leading-relaxed text-white/60">{f.answer}</p>
              )}
            </div>
          );
        })}

        {!isLoading && filtered.length === 0 && (
          <p className="py-10 text-center text-white/40">Асуулт олдсонгүй</p>
        )}
      </div>
    </main>
  );
}
