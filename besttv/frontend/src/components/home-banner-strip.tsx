'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Play } from 'lucide-react';
import type { HomeBanner } from '@/lib/queries';

/**
 * Нүүрний ДУНД байрлах сурталчилгааны баннер.
 *
 * ⚠️ Дээд талын hero carousel-ЭЭС ТУСДАА. Тэр нь кинонд холбогдсон,
 * энэ нь жанрын эгнээнүүдийн дунд орох бие даасан зурвас (админ
 * панелиас удирдана — багц, урамшуулал, ямар ч холбоос).
 *
 * ⚠️ Зурагт ТЕКСТ шингэсэн байж болзошгүй тул градиент нь ЗӨВХӨН
 * гарчиг/товч байгаа үед л тавигдана — эс бөгөөс цэвэр зургийг
 * дэмий бүдгэрүүлнэ.
 */
export function HomeBannerStrip({ banner }: { banner: HomeBanner }) {
  if (!banner.imageUrl) return null;

  const hasText = Boolean(banner.title || banner.subtitle || banner.ctaText);
  const href = banner.ctaHref?.trim();
  /* ⚠️ Гадаад холбоосыг шинэ табд — сайтаас гаргахгүй */
  const isExternal = href?.startsWith('http');

  const inner = (
    <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl bg-foreground/5 sm:aspect-[3/1] md:aspect-[4/1]">
      {/*
        ⚠️ Мобайлд өөр зураг — `hidden sm:block` / `sm:hidden` хосоор.
        CSS-ээр солих нь `useMediaQuery`-ээс ДЭЭР: SSR дээр ч зөв гарч,
        hydration зөрчил үүсгэхгүй.
      */}
      <Image
        src={banner.imageUrl}
        alt={banner.title || 'Сурталчилгаа'}
        fill
        sizes="(min-width: 768px) 1200px, 100vw"
        className={banner.mobileImageUrl ? 'hidden object-cover sm:block' : 'object-cover'}
      />
      {banner.mobileImageUrl && (
        <Image
          src={banner.mobileImageUrl}
          alt={banner.title || 'Сурталчилгаа'}
          fill
          sizes="100vw"
          className="object-cover sm:hidden"
        />
      )}

      {hasText && (
        <>
          {/* ⚠️ Зүүнээс градиент — текст ямар ч зураг дээр уншигдана */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />
          <div className="absolute inset-y-0 left-0 flex max-w-[72%] flex-col justify-center gap-1.5 p-4 sm:max-w-[55%] sm:gap-2.5 sm:p-7 md:p-9">
            {banner.title && (
              <h3 className="text-lg font-black leading-tight text-white drop-shadow sm:text-2xl md:text-3xl">
                {banner.title}
              </h3>
            )}
            {banner.subtitle && (
              <p className="line-clamp-2 text-xs text-white/80 sm:text-sm">{banner.subtitle}</p>
            )}
            {banner.ctaText && (
              /* ⚠️ `<span>` — эцэг нь аль хэдийн <a>, дотор нь <a> хийвэл
                 HTML буруу болж hydration алдана */
              <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-bold text-black transition-transform group-hover:scale-[1.03] sm:text-sm">
                <Play size={14} fill="currentColor" />
                {banner.ctaText}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (!href) {
    return (
      <section className="px-4 md:px-8" aria-label={banner.title || 'Сурталчилгаа'}>
        {inner}
      </section>
    );
  }

  return (
    <section className="px-4 md:px-8" aria-label={banner.title || 'Сурталчилгаа'}>
      <Link
        href={href}
        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="group block transition-opacity hover:opacity-95"
      >
        {inner}
      </Link>
    </section>
  );
}
