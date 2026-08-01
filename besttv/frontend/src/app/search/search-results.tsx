'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, SearchX } from 'lucide-react';
import { ErrorState } from '@besttv/shared/ui';
import { useSearch } from '@/lib/queries';
import { trackSearch } from '@/lib/track';
import { TitleCard } from '@/components/title-card';

export function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const qParam = params.get('q') ?? '';
  const [input, setInput] = useState(qParam);

  // URL query хоцроод бичсэн, 400мс debounce-той — хайлт бүр дуудахгүй
  useEffect(() => {
    const t = setTimeout(() => {
      const url = input.trim() ? `/search?q=${encodeURIComponent(input.trim())}` : '/search';
      router.replace(url);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  useEffect(() => setInput(qParam), [qParam]);

  const { data, isLoading, isError, refetch } = useSearch(qParam);

  // Хайлтын түүх — үр дүн ирсний ДАРАА бүртгэнэ (олдсон тоог мэдэхийн тулд).
  // Нэг хайлтыг нэг л удаа: query+үр дүн бэлэн болоход.
  const trackedQuery = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading || isError || !qParam || !data) return;
    if (trackedQuery.current === qParam) return;
    trackedQuery.current = qParam;
    trackSearch(qParam, data.length);
  }, [qParam, data, isLoading, isError]);

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-28 md:px-8">
      <div className="relative mx-auto max-w-lg">
        <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Кино хайх..."
          aria-label="Хайх"
          className="w-full rounded-full border border-white/15 bg-white/5 py-3.5 pl-12 pr-4 text-base text-white placeholder:text-white/35 outline-none transition-colors focus:border-primary focus:bg-white/8"
        />
      </div>

      {qParam && (
        <h1 className="mx-auto mt-8 max-w-5xl text-lg font-semibold text-white/70">
          &ldquo;{qParam}&rdquo; хайлтын үр дүн
        </h1>
      )}

      <div className="mx-auto mt-5 max-w-5xl">
        {isError ? (
          <ErrorState className="mt-10" message="Хайлт хийхэд алдаа гарлаа." onRetry={() => refetch()} />
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {isLoading &&
              Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="skeleton-shimmer aspect-2/3 w-full rounded-lg" />
              ))}
            {data?.map((t) => <TitleCard key={t.id} title={t} inGrid />)}
          </div>
        )}

        {!isLoading && !isError && qParam && data?.length === 0 && (
          <div className="mt-16 flex flex-col items-center text-white/35">
            <SearchX size={40} />
            <p className="mt-3">&ldquo;{qParam}&rdquo;-д тохирох илэрц олдсонгүй</p>
          </div>
        )}
      </div>
    </main>
  );
}
