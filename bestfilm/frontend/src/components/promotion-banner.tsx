'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Gift } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@besttv/shared';
import type { PromotionBanner as PromoBanner } from '@/lib/queries';

/**
 * УРАМШУУЛЛЫН БАННЕР — кино эгнээнүүдийн дунд.
 *
 * ⚠️ `HomeBannerStrip`-ээс ТУСДАА: тэр нь админы гараар оруулсан
 * ерөнхий баннер, энэ нь урамшуулалтай ХОЛБООТОЙ бөгөөд үлдсэн
 * хугацааг тоолдог.
 */

/**
 * Үлдсэн хугацааг тоолно.
 *
 * ⚠️⚠️ ЯАРАЛТАЙ БАЙДАЛ нь борлуулалтад шууд нөлөөтэй. «3 өдөр
 * үлдлээ» гэсэн тоо нь «удахгүй дуусна» гэсэн ерөнхий үгнээс
 * хамаагүй хүчтэй.
 *
 * ⚠️ Секунд харуулахгүй — 3 хоногийн countdown-д секунд нь дэмий
 * хөдөлгөөн, анхаарал сарниулна. Зөвхөн 1 цагаас бага үед л минут.
 */
function useCountdown(endsAt: string): string | null {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      const ms = new Date(endsAt).getTime() - Date.now();
      if (ms <= 0) {
        setText(null);
        return;
      }
      const d = Math.floor(ms / 86_400_000);
      const h = Math.floor((ms % 86_400_000) / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);

      if (d > 0) setText(`${d} өдөр ${h} цаг`);
      else if (h > 0) setText(`${h} цаг ${m} мин`);
      else setText(`${m} минут`);
    };

    tick();
    /* ⚠️ 30 секунд — минутын нарийвчлалд хангалттай, батарей хэмнэнэ */
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [endsAt]);

  return text;
}

export function PromotionBannerStrip({ promo }: { promo: PromoBanner }) {
  const left = useCountdown(promo.endsAt);

  /* ⚠️ Хугацаа дууссан бол ОГТ харуулахгүй — хуучирсан урамшуулал
     харуулах нь итгэл алдана */
  if (!left) return null;

  return (
    <section className="px-4 md:px-8" aria-label={promo.name}>
      {/*
        ⚠️ Хэмжээ нь `HomeBannerStrip`-ТЭЙ ЯГ ИЖИЛ — хоёулаа эгнээний
        дунд зэрэгцэж гарах тул өөр өндөртэй бол хуудас тэгш бус
        харагдана.
      */}
      <Link
        href="/pricing"
        className="group relative block aspect-21/9 max-h-70 w-full overflow-hidden rounded-xl border border-premium/30 bg-linear-to-r from-premium/20 via-premium/8 to-transparent transition-all hover:border-premium/60 sm:aspect-4/1 md:aspect-6/1"
      >
        {promo.imageUrl && (
          <>
            {/*
              ⚠️ Мобайлд өөр зураг — өргөн зураг утсан дээр маш нарийн
              болж, дотор нь бичсэн текст уншигдахгүй болно.
            */}
            <Image
              src={promo.imageUrl}
              alt={promo.name}
              fill
              sizes="(min-width: 768px) 1200px, 100vw"
              className={
                promo.mobileImageUrl
                  ? 'hidden object-cover object-center sm:block sm:object-top'
                  : 'object-cover object-center sm:object-top'
              }
            />
            {promo.mobileImageUrl && (
              <Image
                src={promo.mobileImageUrl}
                alt={promo.name}
                fill
                sizes="100vw"
                className="object-cover sm:hidden"
              />
            )}
            {/* ⚠️ Градиент — зураг ямар ч өнгөтэй байсан текст уншигдана */}
            <div className="absolute inset-0 bg-linear-to-r from-black/85 via-black/45 to-transparent" />
          </>
        )}

        <div className="absolute inset-y-0 left-0 flex max-w-[72%] flex-col justify-center gap-1 p-4 sm:max-w-[55%] sm:gap-1.5 sm:p-6 md:p-7">
          <span className="flex w-fit items-center gap-1.5 rounded-md bg-premium-solid px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-premium-foreground sm:text-[11px]">
            <Gift size={11} />
            Урамшуулал
          </span>

          <h3 className="text-sm font-black leading-tight text-white drop-shadow-lg sm:text-xl md:text-2xl">
            {promo.name}
          </h3>

          {promo.shortText && (
            <p className="line-clamp-2 text-[11px] leading-snug text-white/85 drop-shadow sm:text-sm">
              {promo.shortText}
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-md px-2 py-1 text-[10px] font-bold tabular-nums sm:text-xs',
                'bg-white/15 text-white backdrop-blur-sm',
              )}
            >
              Дуусахад {left}
            </span>
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-white sm:text-sm">
              Багц үзэх
              <ChevronRight
                size={14}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </div>
        </div>
      </Link>
    </section>
  );
}
