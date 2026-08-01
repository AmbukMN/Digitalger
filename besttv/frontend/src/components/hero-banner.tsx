'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Info, Lock, Play, Star } from 'lucide-react';
import { usePlayGuard } from '@/lib/use-play-guard';
import { useAuth } from '@/lib/auth-store';
import { accessState } from '@/lib/access';
import { cn } from '@besttv/shared';
import type { HomeData } from '@/lib/queries';

type Banner = HomeData['banners'][number];

const SLIDE_MS = 6000;

/**
 * Нүүрийн hero — Netflix загвар:
 *  - Ken Burns зөөлөн zoom (backdrop амьд мэдрэмжтэй)
 *  - Слайд бүрийн хугацааг харуулах progress indicator
 *  - Гарчиг/тайлбар zone stagger animation
 */
export function HeroBanner({ banners }: { banners: Banner[] }) {
  // ⚠️ "Үзэх" нь эрх шалгасны дараа л /watch руу орно
  const play = usePlayGuard();
  const { user } = useAuth();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(
    () => setActive((i) => (i + 1) % banners.length),
    [banners.length],
  );

  useEffect(() => {
    if (banners.length < 2 || paused) return;
    const t = setTimeout(next, SLIDE_MS);
    return () => clearTimeout(t);
  }, [active, paused, banners.length, next]);

  if (banners.length === 0) return null;
  const banner = banners[active];
  /** Хэрэглэгчийн багц энэ баннерын контентыг нээсэн эсэх */
  const bannerAccess = accessState(user, {
    isPremium: banner.isPremium,
    genres: banner.genres,
  });

  return (
    <section
      className="relative h-[62vw] max-h-180 min-h-105 w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Онцлох контент"
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={banner.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {banner.backdropUrl && (
            <div className="animate-ken-burns absolute inset-0" key={`kb-${banner.id}`}>
              <Image
                src={banner.backdropUrl}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </div>
          )}
          <div className="hero-gradient absolute inset-0" />
          <div className="hero-gradient-side absolute inset-0" />
        </motion.div>
      </AnimatePresence>

      {/* Контентын хэсэг — stagger animation.
          ⚠️ Индикатор доор нь ТУСАД НЬ байрлана (bottom-10/14) тул контентыг
          түүнээс ДЭЭШ (bottom-28/40) өргөнө — эс бөгөөс "Үзэх" товчтой
          зураасууд давхцана. */}
      <div className="absolute bottom-28 left-4 max-w-xl md:bottom-40 md:left-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={banner.id}
            initial="hidden"
            animate="show"
            exit="hidden"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
            }}
          >
            <motion.div
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              className="mb-3 flex flex-wrap items-center gap-2.5 text-xs font-medium"
            >
              {/* ⚠️ Эрхээс хамаарна — багцад багтсан бол үнийн шошго ХЭРЭГГҮЙ */}
              {bannerAccess === 'owned' ? (
                <span className="flex items-center gap-1 rounded bg-success px-2 py-0.5 font-bold uppercase tracking-wide text-success-foreground">
                  <Check size={10} strokeWidth={3} /> Үзэх боломжтой
                </span>
              ) : bannerAccess === 'locked' ? (
                <span className="flex items-center gap-1 rounded bg-premium px-2 py-0.5 font-bold uppercase tracking-wide text-premium-foreground">
                  <Lock size={10} /> Төлбөртэй
                </span>
              ) : (
                <span className="rounded bg-success px-2 py-0.5 font-bold uppercase tracking-wide text-success-foreground">
                  Үнэгүй
                </span>
              )}
              {banner.rating ? (
                <span className="flex items-center gap-1 text-white/80">
                  <Star size={12} className="fill-premium text-premium" /> {banner.rating.toFixed(1)}
                </span>
              ) : null}
              {banner.year && <span className="text-white/60">{banner.year}</span>}
              {banner.genres?.slice(0, 3).map((g) => (
                <span key={g.slug} className="uppercase tracking-wider text-white/50">
                  {g.name}
                </span>
              ))}
            </motion.div>

            <motion.h1
              variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
              className="text-4xl font-black leading-[1.05] tracking-tight text-white drop-shadow-2xl md:text-6xl"
            >
              {banner.title}
            </motion.h1>

            <motion.p
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              className="mt-4 line-clamp-3 max-w-lg text-sm leading-relaxed text-white/75 md:text-base"
            >
              {banner.description}
            </motion.p>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              className="mt-6 flex gap-3"
            >
              {/* ⚠️ Эрх шалгасны дараа л /watch руу орно */}
              <button
                onClick={() =>
                  play({
                    slug: banner.slug,
                    isPremium: banner.isPremium,
                    comingSoon: banner.comingSoon,
                    type: banner.type,
                  })
                }
                className="flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-bold text-black transition-all hover:scale-[1.03] hover:bg-white/90 active:scale-[0.98]"
              >
                <Play size={19} fill="black" /> Үзэх
              </button>
              <Link
                href={`/movie/${banner.slug}`}
                className="glass-light flex items-center gap-2 rounded-lg px-6 py-3 font-semibold text-white transition-all hover:scale-[1.03] hover:bg-white/16 active:scale-[0.98]"
              >
                <Info size={18} /> Дэлгэрэнгүй
              </Link>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Timed progress indicators — Netflix/Disney загвар */}
      {banners.length > 1 && (
        <div
          // ⚠️ Нүүр нь hero дээр `-mt-12` сөрөг зайгаар давхарладаг тул
          // индикаторыг доод ирмэгээс ДЭЭШ (bottom-10/14) байрлуулна — доор
          // нь жанрын гарчиг, дээр нь "Үзэх" товч, аль алинтай нь давхцахгүй.
          className="absolute bottom-10 left-4 z-20 flex gap-2 md:bottom-14 md:left-12"
          role="tablist"
          aria-label="Слайд сонгох"
        >
          {banners.map((b, i) => (
            <button
              key={b.id}
              role="tab"
              aria-selected={i === active}
              aria-label={`${b.title} слайд`}
              onClick={() => setActive(i)}
              className={cn(
                'relative h-1 overflow-hidden rounded-full transition-all duration-300',
                i === active ? 'w-12 bg-white/25' : 'w-5 bg-white/20 hover:bg-white/35',
              )}
            >
              {i === active && !paused && (
                <span
                  key={`p-${banner.id}`}
                  className="animate-hero-progress absolute inset-y-0 left-0 rounded-full bg-primary"
                />
              )}
              {i === active && paused && (
                <span className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
