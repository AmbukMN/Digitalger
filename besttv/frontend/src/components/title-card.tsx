'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Heart, Info, Play, Star, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { TitleCard as TitleCardType } from '@besttv/shared';
import { cn } from '@besttv/shared';
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
  /** Хэрэглэгчийн багц энэ контентыг нээсэн эсэх (badge/товч хоёуланд) */
  const access = accessState(user, { isPremium: title.isPremium, genres: title.genres });
  const goWatch = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    play({
      slug: title.slug,
      isPremium: title.isPremium,
      comingSoon: title.comingSoon,
      type: title.type,
    });
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
      <div className="relative aspect-2/3 overflow-hidden rounded-lg bg-[#1a1a1a]">
        {title.posterUrl ? (
          <Image src={title.posterUrl} alt="" fill sizes="180px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/20">
            <Play size={32} />
          </div>
        )}

        {/*
          ⚠️ Badge нь ХЭРЭГЛЭГЧИЙН ЭРХЭЭС хамаарна:
            - Эрх авсан (багц/VIP) → "Үзэх боломжтой" ✓ (үнийн шошго ХЭРЭГГҮЙ)
            - Төлбөртэй + эрхгүй  → 🔒 Төлбөртэй
            - Үнэгүй контент      → Үнэгүй
          Өмнө нь багц авсан ч "Төлбөртэй" гэж харагдаад хэрэглэгч эргэлздэг
          байсан.
        */}
        {title.comingSoon ? (
          <span className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            Удахгүй
          </span>
        ) : access === 'owned' ? (
          <span
            title="Таны багцад багтсан"
            className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded bg-success/85 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm"
          >
            <Check size={9} strokeWidth={3} /> Үзэх боломжтой
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

        {/* Жанр — картын ДООД талд (аль ангилалд багтахыг харуулна) */}
        {genreLabel && (
          <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded bg-black/80 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
            {genreLabel}
          </span>
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
                inList ? 'bg-primary text-white' : 'glass-light text-white',
              )}
            >
              <Heart size={14} className={inList ? 'fill-current' : ''} />
            </button>
            <span
              aria-hidden
              className="glass-light ml-auto flex h-8 w-8 items-center justify-center rounded-full text-white"
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
        <p className="truncate text-sm font-medium text-white/90">{title.title}</p>
        {title.rating ? (
          <span className="flex items-center gap-0.5 text-xs text-white/50 shrink-0">
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
      <div className="relative z-10 aspect-2/3 w-32 overflow-hidden rounded-lg bg-[#1a1a1a] sm:w-36">
        {title.posterUrl ? (
          <Image src={title.posterUrl} alt="" fill sizes="150px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/20">
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
