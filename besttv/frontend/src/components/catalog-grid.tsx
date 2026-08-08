'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, SearchX } from 'lucide-react';
import { ErrorState } from '@besttv/shared/ui';
import { useCatalogInfinite, useGenres, useHome } from '@/lib/queries';
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

  // Нүүр хуудасны "Бүгдийг үзэх" (?genre=slug) холбоосыг тайлбарлана
  useEffect(() => {
    const g = searchParams.get('genre');
    if (g) setGenre(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: genres } = useGenres();
  /**
   * ⚠️ `type` ОГТ дамжуулахгүй — нэг ангит + олон ангит БҮГД харагдана.
   * ⚠️ Хуудаслалт (1 2 3) БИШ — доош гүйлгэхэд автоматаар нэмэгдэнэ.
   */
  const {
    data,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    refetch,
  } = useCatalogInfinite({ genre, sort: 'new' });

  /** Бүх хуудсын кинонуудыг нэг жагсаалт болгоно */
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  /**
   * ⚠️⚠️ ХЭРЭГЛЭГЧ ХАРААГҮЙ ҮЕД АЧААЛАХГҮЙ.
   *
   * Жагсаалтын ТӨГСГӨЛД байрлах "хамгаалагч" элемент дэлгэцэд орж ирмэгц
   * л дараагийн хуудас татагдана. `rootMargin: 400px` — хэрэглэгч ёроолд
   * ХҮРЭХЭЭС ӨМНӨ бага зэрэг эрт эхлүүлснээр гүйлгэлт тасалдахгүй,
   * гэхдээ хараагүй хэдэн хуудсыг урьдчилж татахгүй.
   */
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, genre]);

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
      <h1 className="text-2xl font-black tracking-tight text-foreground md:text-3xl">{heading}</h1>
      <p className="mt-1.5 text-muted-foreground">{subheading}</p>

      {/*
        ⚠️ ТӨРЛИЙН (Кино/Олон ангит) ШҮҮЛТҮҮР ХАСАГДСАН — дээрх тайлбарыг үз.
        Ангилал зөвхөн ЖАНРААР.
      */}
      {/*
        ⚠️⚠️ БҮХ ДЭЛГЭЦЭД WRAP — хэвтээ гүйлт БАЙХГҮЙ.

        Өмнө нь мобайлд `overflow-x-auto` байсан нь БУРУУ болсон: жанрын
        нэр урт (“Хятад болон Ай кино”) тул 4 chip нэг мөрөнд багтахгүй,
        сүүлийн жанр(ууд) дэлгэцийн БАРУУН ГАДНА бүрэн далд үлддэг байв.
        Гүйлгэх боломжтой гэдгийг заасан юу ч байхгүй (scrollbar нуусан,
        fade ч алга) тул хэрэглэгч тэр жанр БАЙХГҮЙ гэж ойлгоно —
        каталогийн гол шүүлтүүр нь ҮЛ ҮЗЭГДЭХ болж байлаа.

        ⚠️ Хоёр дахь мөр рүү бууж контентыг доош түлхэх нь далд орохоос
        ХАМААГҮЙ ДЭЭР: 2-3 мөр chip нь ердөө ~40px нэмнэ, харин далд
        жанрыг хэрэглэгч ХЭЗЭЭ Ч олохгүй.

        ⚠️ `snap-*`, `hide-scrollbar` ХАСАВ — гүйлт байхгүй болсон тул
        утгагүй (snap нь wrap-тай хамт ажиллахгүй).
      */}
      <div
        className="mt-6 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Жанраар шүүх"
      >
        <FilterChip active={!genre} onClick={() => setGenre(undefined)}>
          Бүгд
        </FilterChip>
        {genres?.map((g) => (
          <FilterChip key={g.id} active={genre === g.slug} onClick={() => setGenre(g.slug)}>
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
            /* ⚠️ ЗӨВХӨН эхний ачаалалтад бүдгэрүүлнэ — дараагийн хуудас
               нэмэгдэх бүрд бүх grid бүдгэрвэл нүд ядарна */
            isFetching && !isFetchingNextPage && !items.length && 'opacity-50',
          )}
        >
          {items.map((t) => (
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

          {/* Эхний ачаалалт — skeleton (spinner БИШ) */}
          {!data &&
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer aspect-2/3 rounded-lg" />
            ))}

          {/* Дараагийн хуудас ачаалж байхад — grid-ийн үргэлжлэл мэт skeleton */}
          {isFetchingNextPage &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={`next-${i}`} className="skeleton-shimmer aspect-2/3 rounded-lg" />
            ))}
        </div>
      )}

      {/* ⚠️ Эгнээ горимд (Бүгд) хоосон мессеж харуулахгүй */}
      {!showRows && data && items.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-muted-foreground">
          <SearchX size={40} />
          <p className="mt-3">Энэ шүүлтүүрт тохирох контент олдсонгүй</p>
        </div>
      )}

      {/*
        ⚠️⚠️ ХУУДАСЛАЛТЫН ТОВЧ (1 2 3) ХАСАГДСАН — доош гүйлгэхэд автоматаар
        нэмэгдэнэ. Энэ элемент дэлгэцэд орж ирэхэд л дараагийн хуудас татагдана
        (`IntersectionObserver` дээрх useEffect-д). Хэрэглэгч хараагүй бол
        ямар ч хүсэлт явахгүй.
      */}
      {!showRows && (
        <div ref={sentinelRef} className="mt-8 flex justify-center" aria-hidden={!hasNextPage}>
          {isFetchingNextPage ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Ачаалж байна…
            </span>
          ) : !hasNextPage && items.length > 0 ? (
            /* Төгсгөлд хүрсэн — хэрэглэгч "бүгдийг харлаа" гэдгээ мэднэ */
            <span className="text-sm text-muted-foreground">
              Нийт {total} кино — бүгдийг харлаа
            </span>
          ) : null}
        </div>
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
        /* ⚠️ `whitespace-nowrap` — жанрын нэр ДОТРОО таслагдахгүй (chip
           бүхэлдээ дараагийн мөр рүү бууна).
           ⚠️ `shrink-0 snap-start` ХАСАВ — эцэг элемент wrap болсон тул
           гүйлт байхгүй (snap утгагүй), шахагдах ч аюул алга. */
        'whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-all',
        /* ⚠️ Идэвхтэй chip нь `bg-white text-black` байсан тул ГЭРЭЛ горимд
           цагаан дээр цагаан болж алга болдог. Одоо `foreground` (theme-ийн
           эсрэг өнгө) → хоёр горимд ч тод харагдана. */
        active
          ? 'bg-foreground text-background shadow-md'
          : 'bg-foreground/8 text-foreground/70 hover:bg-foreground/15',
      )}
    >
      {children}
    </button>
  );
}

// ⚠️ GridCard УСТГАГДСАН — TitleCard-ыг ашиглана (эрхийн логик давхардахгүй)
