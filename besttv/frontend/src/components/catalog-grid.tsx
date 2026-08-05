'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SearchX } from 'lucide-react';
import type { TitleCard as TitleCardType } from '@besttv/shared';
import { ErrorState } from '@besttv/shared/ui';
import { useCatalog, useGenres, useHome } from '@/lib/queries';
import { cn } from '@besttv/shared';
import { TitleRow } from './title-row';
import { TitleCard } from './title-card';

/**
 * Кино каталог grid — ЗӨВХӨН ЖАНРААР ангилна.
 *
 * ⚠️⚠️ "КИНО" бол ЕРӨНХИЙ НЭРШИЛ — доторх нь нэг ангит БОЛОН олон ангит
 * ХОЁУЛАА. Хэрэглэгчийн талд эдгээрийг ЯЛГАЖ ХАРУУЛАХГҮЙ.
 *
 * Өмнө нь "Бүгд / Кино / Олон ангит" гэсэн товч байсан нь ойлголтын
 * зөрчил үүсгэдэг байв: цэсэнд "Кино" дарахад дотор нь дахин "Кино"
 * гэсэн шүүлтүүр гарч, хэрэглэгч "олон ангит бол кино биш юм байна"
 * гэж ойлгодог. MOVIE/SERIES ялгаа нь ЗӨВХӨН АДМИН талд контент
 * оруулахад (нэг ангит бол видео, олон ангит бол улирал/анги) хэрэгтэй
 * дотоод хэрэгсэл.
 *
 * Ангилал = ЖАНР. Жанр дарахад тухайн жанрын БҮХ кино (нэг ангит ч,
 * олон ангит ч) харагдана.
 */
export function CatalogGrid({
  heading,
  subheading,
}: {
  heading: string;
  subheading: string;
}) {
  const searchParams = useSearchParams();
  const [genre, setGenre] = useState<string | undefined>(searchParams.get('genre') ?? undefined);
  // ⚠️ Эрэмбэ ҮРГЭЛЖ "шинэ" — сонголтын товч хасагдсан (илүүц байв)
  const [page, setPage] = useState(1);

  // Нүүр хуудасны "Бүгдийг үзэх" (?genre=slug) холбоосыг тайлбарлана
  useEffect(() => {
    const g = searchParams.get('genre');
    if (g) setGenre(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: genres } = useGenres();
  // ⚠️ `type` ОГТ дамжуулахгүй — нэг ангит + олон ангит БҮГД харагдана
  const { data, isFetching, isError, refetch } = useCatalog({ genre, sort: 'new', page });

  /**
   * ⚠️⚠️ "БҮГД" СОНГОСОН ҮЕД ЖАНРААР ЭГНЭЭ (нүүр хуудас шиг).
   *
   * Өмнө нь бүх кино ялгаагүй нэг grid-д ХОЛИЛДОЖ гардаг байв — Монгол
   * кино, насанд хүрэгчдийн бүгд зэрэгцээд, хэрэглэгч ямар ангилал
   * болохыг ялгаж чадахгүй. Одоо "Бүгд" үед жанр бүр ТУСДАА эгнээ
   * болж, тодорхой жанр сонгосон үед л grid харагдана.
   */
  const { data: home } = useHome();
  const showRows = !genre;

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-24 md:px-8">
      <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">{heading}</h1>
      <p className="mt-1.5 text-white/55">{subheading}</p>

      {/*
        ⚠️ ТӨРЛИЙН (Кино/Олон ангит) ШҮҮЛТҮҮР ХАСАГДСАН — дээрх тайлбарыг үз.
        Ангилал зөвхөн ЖАНРААР.
      */}
      <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Жанраар шүүх">
        <FilterChip active={!genre} onClick={() => { setGenre(undefined); setPage(1); }}>
          Бүгд
        </FilterChip>
        {genres?.map((g) => (
          <FilterChip key={g.id} active={genre === g.slug} onClick={() => { setGenre(g.slug); setPage(1); }}>
            {g.name}
          </FilterChip>
        ))}
        {/*
          ⚠️ ЭРЭМБИЙН товч (Шинэ/Эрэлттэй/Үнэлгээ) ХАСАГДСАН — хэрэглэгчид
          илүүц сонголт. Каталог үргэлж ШИНЭ-ээр эрэмбэлэгдэнэ.
        */}
      </div>

      {isError ? (
        <ErrorState
          className="mt-10"
          message="Контент ачаалахад алдаа гарлаа."
          onRetry={() => refetch()}
        />
      ) : showRows ? (
        /* ⚠️ "Бүгд" — ЖАНР БҮР ТУСДАА ЭГНЭЭ (нүүр хуудас шиг), холилдохгүй */
        /* ⚠️ `space-y-9` — НҮҮР хуудастай ЯГ ИЖИЛ зай (жигд харагдац) */
        <div className="-mx-4 mt-7 space-y-9 md:-mx-8">
          {home?.genreRows?.length
            ? home.genreRows.map((row) => (
                <TitleRow
                  key={row.id}
                  title={row.name}
                  items={row.titles}
                  href={`/movies?genre=${row.slug}`}
                />
              ))
            : Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 md:px-8">
                  <div className="skeleton-shimmer mb-3 h-6 w-40 rounded" />
                  <div className="flex gap-3">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <div key={j} className="skeleton-shimmer aspect-2/3 w-36 shrink-0 rounded-lg" />
                    ))}
                  </div>
                </div>
              ))}
        </div>
      ) : (
        <div
          className={cn(
            'mt-7 grid grid-cols-2 gap-x-3 gap-y-6 transition-opacity sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
            isFetching && 'opacity-50',
          )}
        >
          {(data?.items ?? []).map((t) => (
            /**
             * ⚠️⚠️ `TitleCard` АШИГЛАНА (өмнө нь энд өөрийн `GridCard` байв).
             *
             * Тэр давхардсан компонент нь ЗӨВХӨН `title.isPremium`-ыг
             * шалгаж, хэрэглэгчийн ЭРХИЙГ ОГТ ТООЦДОГГҮЙ байсан тул
             * БАГЦТАЙ хэрэглэгчид ч "🔒 Төлбөртэй" гэж харагддаг байв
             * (нүүр хуудсан дээр "Үзэх боломжтой" гэж зөв гардаг атал).
             * `TitleCard` нь `accessState()`-аар эрхийг тооцдог — нэг л
             * эх сурвалж, ирээдүйд ижил алдаа давтагдахгүй.
             */
            /**
             * ⚠️ `inGrid` ЗААВАЛ — эс бөгөөс карт нь эгнээний ТОГТМОЛ
             * өргөнтэй (`w-37.5`) үлдэж, grid баганыг бүтэн дүүргэхгүй.
             * Тэр үед картууд өөр өөр зайтай, тэгш бус харагдана.
             */
            <TitleCard key={t.id} title={t} inGrid />
          ))}
          {!data &&
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer aspect-2/3 rounded-lg" />
            ))}
        </div>
      )}

      {/* ⚠️ Эгнээ горимд (Бүгд) хоосон мессеж/хуудаслалт харуулахгүй */}
      {!showRows && data && data.items.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-white/35">
          <SearchX size={40} />
          <p className="mt-3">Энэ шүүлтүүрт тохирох контент олдсонгүй</p>
        </div>
      )}

      {!showRows && data && data.totalPages > 1 && (
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

// ⚠️ GridCard УСТГАГДСАН — TitleCard-ыг ашиглана (эрхийн логик давхардахгүй)
