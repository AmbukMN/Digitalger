'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Heart, Info, Play, Star, Lock, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import type { TitleCard as TitleCardType } from '@besttv/shared';
import { cn } from '@besttv/shared';
import { MnFlag } from './mn-flag';
import { useAuth } from '@/lib/auth-store';
import { useMyListStore } from '@/lib/my-list-store';
import { usePlayGuard } from '@/lib/use-play-guard';
import { accessState } from '@/lib/access';

export interface TitleCardProps {
  title: TitleCardType;
  /** Continue-watching мөрөнд — үзсэн хувь (0-100) */
  progressPercent?: number;
  /**
   * Grid дотор ашиглах эсэх.
   * ⚠️ Хэвтээ мөрөнд (TitleRow) карт нь ТОГТМОЛ өргөнтэй байх ёстой
   * (`w-37.5 shrink-0`), grid дотор бол багананд БҮТЭН дүүрэх ёстой —
   * эс бөгөөс mobile-д 2 багана багтахгүй, зай завсар үлдэнэ.
   */
  inGrid?: boolean;
}

/**
 * Netflix маягийн 2:3 poster card:
 *  - hover-д зөөлөн томорч quick action (Үзэх / Жагсаалт / Мэдээлэл) гарна
 *  - continue-watching үед доод талд улаан progress bar
 */
export function TitleCard({ title, progressPercent, inGrid }: TitleCardProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const inList = useMyListStore((s) => s.has(title.id));
  const toggleMyList = useMyListStore((s) => s.toggle);

  const addToList = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // ⚠️ Зочин ч дуртай кино нэмнэ (localStorage). Нэвтрэхэд серверт нийлнэ.
    const wasIn = inList;
    try {
      await toggleMyList(title.id);
      qc.invalidateQueries({ queryKey: ['my-list'] });
      toast.success(wasIn ? 'Дуртайгаас хасагдлаа' : 'Дуртай кинонд нэмэгдлээ');
    } catch {
      toast.error('Алдаа гарлаа');
    }
  };

  /**
   * ⚠️ Play товч ЭРХ ШАЛГАНА — өмнө нь шууд /watch руу шиддэг байсан тул
   * нэвтрээгүй хэрэглэгч хоосон плеер дээр гацдаг байсан.
   */
  const play = usePlayGuard();
  /**
   * ⚠️ Видео бэлэн эсэх. `streamStatus` нь ХУУЧИН кэшлэгдсэн хариунд
   * байхгүй байж болно (`undefined`) — тэр үед БЭЛЭН гэж үзнэ (хуучин
   * бүх кино бэлэн байсан тул буруу анхааруулга гаргахгүй).
   */
  const notReady = title.streamStatus != null && title.streamStatus !== 'READY';
  /** Хэрэглэгчийн багц энэ контентыг нээсэн эсэх (badge/товч хоёуланд) */
  const access = accessState(user, {
    id: title.id,
    isPremium: title.isPremium,
    genres: title.genres,
  });
  const goWatch = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    /* ⚠️ Бэлэн бус видеог тоглуулах гэж оролдохгүй — шалтгааныг хэлнэ */
    if (notReady) {
      toast.info('Энэ кино бэлтгэгдэж байна. Түр хүлээгээд дахин оролдоно уу.');
      return;
    }
    /**
     * ⚠️ ЭРХИЙГ ДАМЖУУЛНА — эс бөгөөс `usePlayGuard` дотор
     * `undefined !== true` үнэн болж, ЭРХТЭЙ хэрэглэгчийг ч
     * дэлгэрэнгүй рүү явуулдаг (play товч ажиллахгүй мэт).
     */
    play(
      {
        slug: title.slug,
        isPremium: title.isPremium,
        comingSoon: title.comingSoon,
        type: title.type,
      },
      access === 'owned' || access === 'free' || access === 'rented',
    );
  };

  // Эхний жанрын нэр (2 хүртэл — хэт урт болохгүй)
  const genreLabel = (title.genres ?? [])
    .slice(0, 2)
    .map((g) => g.name)
    .join(' · ');

  return (
    <Link
      href={`/movie/${title.slug}`}
      aria-label={`${title.title}${title.year ? `, ${title.year}` : ''}`}
      className={cn(
        'title-card group relative block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        inGrid ? 'w-full' : 'w-37.5 shrink-0 sm:w-45',
      )}
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-lg bg-muted">
        {title.posterUrl ? (
          <Image src={title.posterUrl} alt={title.title} fill sizes="180px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/25">
            <Play size={32} />
          </div>
        )}

        {/*
          ⚠️ Badge нь ХЭРЭГЛЭГЧИЙН ЭРХЭЭС хамаарна:
            - Эрх авсан (багц/VIP) → "Үзэх боломжтой" ✓ (үнийн шошго ХЭРЭГГҮЙ)
            - Төлбөртэй + эрхгүй  → 🔒 Төлбөртэй
            - Үнэгүй контент      → Үнэгүй
          ⚠️ ЭРХИЙН ЭХ ҮҮСВЭРИЙГ ЯЛГАНА: "Багц эрх" (сарын багц) ба
          "Түрээслэсэн" (нэг кино, хугацаатай) нь ӨӨР зүйл — хэрэглэгч
          яагаад үзэж чадаж байгаагаа мэдэх ёстой.
          Өмнө нь багц авсан ч "Төлбөртэй" гэж харагдаад хэрэглэгч эргэлздэг
          байсан.
        */}
        {title.comingSoon ? (
          <span className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            Удахгүй
          </span>
        ) : notReady ? (
          /**
           * ⚠️ ВИДЕО БЭЛЭН БИШ — хөрвүүлэлт (HLS) дуусаагүй.
           * Өмнө нь ялгагдахгүй харагдаж, хэрэглэгч дараад л "Видео
           * бэлтгэгдэж байна" гэсэн бичигтэй тулгардаг байсан нь
           * "сайт ажиллахгүй байна" гэж ойлгогддог.
           */
          <span
            title="Видео хөрвүүлэгдэж байна — удахгүй бэлэн болно"
            className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm"
          >
            <Clock size={9} /> Бэлтгэж байна
          </span>
        ) : access === 'rented' ? (
          /* ⚠️ ТҮРЭЭСЛЭСЭН — багцаас ялгаатай тул ӨӨР өнгө/үг.
             Хэрэглэгч "хугацаатай эрх" гэдгээ шууд ойлгоно. */
          <span
            title="Түрээслэсэн — хугацаа дуустал үзнэ"
            className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm"
          >
            <Ticket size={9} /> Түрээслэсэн
          </span>
        ) : access === 'owned' ? (
          <span
            title="Таны идэвхтэй багцад багтсан"
            /* ⚠️ "Үзэх боломжтой" ХЭТ УРТ байсан. "Багц эрх" нь
               ТҮРЭЭСЭЭС ялгарч, эрх хаанаас гарсныг шууд хэлнэ. */
            /* ⚠️ `max-w-[62%]` — баруун дээд булангийн ХЭЛНИЙ шошготой
               давхцахаас сэргийлнэ (энэ badge бусдаас урт) */
            className="absolute left-1.5 top-1.5 flex max-w-[62%] items-center gap-0.5 truncate rounded bg-success/85 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm"
          >
            <Check size={9} strokeWidth={3} className="shrink-0" /> Багц эрх
          </span>
        ) : access === 'locked' ? (
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

        {/* Жанр — картын ЗҮҮН доод (аль ангилалд багтахыг харуулна) */}
        {genreLabel && (
          /**
           * ⚠️ ӨРГӨН нь мобайл/десктопт ӨӨР.
           *
           * Мобайлд баруун доод буланд «Дуртай» (♥) товч (36px) сууна —
           * жанр бүтэн өргөнөө авбал түүний ДОР орж уншигдахгүй болно.
           * Тиймээс утсан дээр ~3rem зай үлдээнэ. Десктопт тэр товч
           * байхгүй (hover overlay дотор) тул бүтэн өргөн авна.
           */
          <span className="genre-badge absolute bottom-1.5 left-1.5 max-w-[calc(100%-3.5rem)] truncate rounded bg-black/80 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
            {genreLabel}
          </span>
        )}

        {/*
          ⚠️ ХЭЛНИЙ ШОШГО — картын БАРУУН ДЭЭД булан.
          Доод талд байхад жанрын шошготой нэг эгнээнд таарч, урт нэртэй
          жанр дээр давхцах эрсдэлтэй байв. Дээд талд эрхийн badge (зүүн)
          -тэй зэрэгцэнэ — хоёул богино тул давхцахгүй.
        */}
        {title.language && (
          <span
            className={cn(
              'absolute right-1.5 top-1.5 flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur-sm',
              /* ⚠️ "Хадмал" нь `bg-white/85` (тунгалаг) байсан тул постерын
                 өнгө шингэж БҮДЭГ харагддаг байв. Монголынхтой адил
                 бүрэн бараан дэвсгэр + цагаан текст болгов. */
              'bg-black/80 text-white',
            )}
          >
            {/*
              ⚠️ ЭМОДЖИ БИШ SVG — `🇲🇳` нь Windows дээр далбаа болж
              рендерлэгддэггүй, "MN" гэсэн 2 үсэг болж харагддаг.
            */}
            {title.language === 'MN' ? (
              <>
                <MnFlag className="h-2.5 w-3.75 rounded-[1px]" />
                Хэл
              </>
            ) : (
              'Хадмал'
            )}
          </span>
        )}

        {/*
          ⚠️⚠️ МОБАЙЛД БАЙНГА ХАРАГДАХ "ДУРТАЙ" ТОВЧ.

          Доорх overlay нь `group-hover` тул хүрэлтэт төхөөрөмжид ОГТ
          гарахгүй — картад хуруу хүрмэгц `Link` ажиллаж дэлгэрэнгүй рүү
          шилжинэ. Үр дүнд утаснаас ♥ дарах БОЛОМЖГҮЙ байв: хэрэглэгч
          заавал дэлгэрэнгүй хуудас руу орох шаардлагатай болдог.

          ⚠️ `md:hidden` — десктопт overlay-гийн товч ажиллах тул
          давхардуулахгүй. `h-9 w-9` (36px) нь хүрэлцэх доод хязгаар.
          ⚠️ `z-10` — `Link`-ээс ДЭЭР байрлаж, дарахад навигац болохгүй.
        */}
        {!title.comingSoon && (
          <button
            onClick={addToList}
            aria-label={inList ? 'Дуртайгаас хасах' : 'Дуртай кинонд нэмэх'}
            className={cn(
              /**
               * ⚠️⚠️ БАРУУН ДООД БУЛАН — баруун ДЭЭД нь ЗАВГҮЙ.
               *
               * Өмнө нь `right-1.5 top-1.5` байсан нь ХЭЛНИЙ ШОШГОТОЙ
               * («🇲🇳 Хэл» / «Хадмал») ЯГ ДАВХЦАЖ, мобайлд хоёул
               * уншигдахгүй болдог байв. Десктопт ♥ нь hover overlay
               * дотор тул илрээгүй — зөвхөн утсан дээр гарах алдаа.
               *
               * Картын 4 булангийн эзэмшил:
               *   зүүн дээд  — эрхийн badge («Багц эрх» / «Төлбөртэй»)
               *   баруун дээд — хэлний шошго
               *   зүүн доод  — жанрын шошго
               *   баруун доод — ЭНЭ товч (цорын ганц сул булан)
               */
              /* ⚠️ `md:hidden` БИШ `fav-touch-only` — дэлгэцийн өргөн
                 биш HOVER боломжтой эсэхээр нуугдана (globals.css).
                 Эс бөгөөс жижиг цонхтой десктопт overlay-гийн ♥-тэй
                 ЗЭРЭГ гарч давхардана. */
              'fav-touch-only absolute bottom-1.5 right-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm transition-colors',
              inList ? 'bg-primary text-white' : 'bg-black/45 text-white',
            )}
          >
            <Heart size={15} className={inList ? 'fill-current' : ''} />
          </button>
        )}

        {/* Hover overlay — quick actions */}
        <div className="absolute inset-0 flex flex-col justify-end bg-linear-to-t from-black/85 via-black/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <div className="card-actions flex items-center gap-1.5 p-2.5">
            {!title.comingSoon && (
              <button
                onClick={goWatch}
                aria-label="Үзэх"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-110"
              >
                <Play size={14} fill="black" />
              </button>
            )}
            <button
              onClick={addToList}
              aria-label={inList ? 'Дуртайгаас хасах' : 'Дуртай кинонд нэмэх'}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110',
                inList ? 'bg-primary text-white' : 'bg-black/55 text-white backdrop-blur-sm',
              )}
            >
              <Heart size={14} className={inList ? 'fill-current' : ''} />
            </button>
            <span
              aria-hidden
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
            >
              <Info size={14} />
            </span>
          </div>
        </div>

        {/* Continue watching progress */}
        {progressPercent != null && progressPercent > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-1">
        <p className="truncate text-sm font-medium text-foreground">{title.title}</p>
        {title.rating ? (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
            <Star size={11} className="fill-premium text-premium" />
            {title.rating.toFixed(1)}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

/** Top 10 мөрөнд — том дугаартай хос загвар */
export function Top10Card({ title, rank }: { title: TitleCardType; rank: number }) {
  return (
    <Link
      href={`/movie/${title.slug}`}
      aria-label={`Топ ${rank}: ${title.title}`}
      className="title-card group relative flex w-52 shrink-0 items-end focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-60"
    >
      <span aria-hidden className={cn('top10-number relative z-0 -mr-7 shrink-0')}>
        {rank}
      </span>
      <div className="relative z-10 aspect-2/3 w-32 overflow-hidden rounded-lg bg-muted sm:w-36">
        {title.posterUrl ? (
          <Image src={title.posterUrl} alt="" fill sizes="150px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/25">
            <Play size={28} />
          </div>
        )}
        {title.isPremium && (
          <span
            title="Багц авсан хүн үзнэ"
            className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-premium backdrop-blur-sm"
          >
            <Lock size={9} /> Төлбөртэй
          </span>
        )}
      </div>
    </Link>
  );
}
