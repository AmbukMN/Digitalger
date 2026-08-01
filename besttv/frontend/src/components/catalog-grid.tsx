'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Play, SearchX, Star , Lock } from 'lucide-react';
import type { TitleCard } from '@besttv/shared';
import { ErrorState } from '@besttv/shared/ui';
import { useCatalog, useGenres } from '@/lib/queries';
import { cn } from '@besttv/shared';

/** Кино каталог grid — жанр filter (client-side, keepPreviousData тул skeleton гацахгүй) */
export function CatalogGrid({ type, heading, subheading }: { type: 'MOVIE' | 'SERIES'; heading: string; subheading: string }) {
  const searchParams = useSearchParams();
  const [genre, setGenre] = useState<string | undefined>(searchParams.get('genre') ?? undefined);
  const [sort, setSort] = useState<'new' | 'popular' | 'rating'>('new');
  const [page, setPage] = useState(1);

  // Нүүр хуудасны "Бүгдийг үзэх" (?genre=slug) холбоосыг тайлбарлана
  useEffect(() => {
    const g = searchParams.get('genre');
    if (g) setGenre(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: genres } = useGenres();
  const { data, isFetching, isError, refetch } = useCatalog({ type, genre, sort, page });

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-24 md:px-8">
      <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">{heading}</h1>
      <p className="mt-1.5 text-white/55">{subheading}</p>

      <div className="mt-7 flex flex-wrap items-center gap-2" role="group" aria-label="Жанраар шүүх">
        <FilterChip active={!genre} onClick={() => { setGenre(undefined); setPage(1); }}>
          Бүгд
        </FilterChip>
        {genres?.map((g) => (
          <FilterChip key={g.id} active={genre === g.slug} onClick={() => { setGenre(g.slug); setPage(1); }}>
            {g.name}
          </FilterChip>
        ))}

        <div className="ml-auto flex gap-1 rounded-full bg-white/6 p-1" role="group" aria-label="Эрэмбэлэх">
          {(['new', 'popular', 'rating'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              aria-pressed={sort === s}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                sort === s ? 'bg-primary text-white shadow-md' : 'text-white/55 hover:text-white',
              )}
            >
              {s === 'new' ? 'Шинэ' : s === 'popular' ? 'Эрэлттэй' : 'Үнэлгээ'}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <ErrorState
          className="mt-10"
          message="Контент ачаалахад алдаа гарлаа."
          onRetry={() => refetch()}
        />
      ) : (
        <div
          className={cn(
            'mt-7 grid grid-cols-2 gap-x-3 gap-y-6 transition-opacity sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
            isFetching && 'opacity-50',
          )}
        >
          {(data?.items ?? []).map((t) => (
            <GridCard key={t.id} title={t} />
          ))}
          {!data &&
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer aspect-2/3 rounded-lg" />
            ))}
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-white/35">
          <SearchX size={40} />
          <p className="mt-3">Энэ шүүлтүүрт тохирох контент олдсонгүй</p>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <nav className="mt-10 flex justify-center gap-2" aria-label="Хуудаслалт">
          {Array.from({ length: data.totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              aria-current={page === i + 1 ? 'page' : undefined}
              className={cn(
                'h-9 w-9 rounded-lg text-sm font-semibold transition-colors',
                page === i + 1 ? 'bg-primary text-white' : 'bg-white/6 text-white/55 hover:bg-white/12',
              )}
            >
              {i + 1}
            </button>
          ))}
        </nav>
      )}
    </main>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-3.5 py-1.5 text-sm font-medium transition-all',
        active ? 'bg-white text-black shadow-md' : 'bg-white/6 text-white/65 hover:bg-white/12',
      )}
    >
      {children}
    </button>
  );
}

function GridCard({ title }: { title: TitleCard }) {
  return (
    <Link
      href={`/movie/${title.slug}`}
      className="title-card group relative block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={`${title.title}${title.year ? `, ${title.year}` : ''}`}
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-lg bg-[#1a1a1a]">
        {title.posterUrl ? (
          <Image src={title.posterUrl} alt="" fill sizes="220px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/20">
            <Play size={32} />
          </div>
        )}
        {/* Төлбөртэй эсэх — түгжээ / үнэгүй */}
        {title.isPremium ? (
          <span
            title="Багц авсан хүн үзнэ"
            className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-premium backdrop-blur-sm"
          >
            <Lock size={9} /> Төлбөртэй
          </span>
        ) : (
          <span className="absolute left-1.5 top-1.5 rounded bg-success/85 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            Үнэгүй
          </span>
        )}

        {/* Жанр */}
        {(title.genres ?? []).length > 0 && (
          <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white/85 backdrop-blur-sm">
            {(title.genres ?? []).slice(0, 2).map((g) => g.name).join(' · ')}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-1">
        <p className="truncate text-sm font-medium text-white/90">{title.title}</p>
        {title.rating ? (
          <span className="flex shrink-0 items-center gap-0.5 text-xs text-white/50">
            <Star size={11} className="fill-premium text-premium" />
            {title.rating.toFixed(1)}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
