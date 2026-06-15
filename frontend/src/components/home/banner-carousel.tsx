'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SmartImage } from '@/components/ui/smart-image';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@digitalger/shared/ui';
import type { Banner } from '@/types/api';

const INTERVAL = 5000;

interface Props {
  banners: Banner[];
}

function BannerMedia({ banner }: { banner: Banner }) {
  if (banner.videoUrl) {
    return (
      <video
        key={banner.videoUrl}
        src={banner.videoUrl}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }

  const desktopSrc = banner.desktopImageUrl || banner.imageUrl;
  const mobileSrc  = banner.mobileImageUrl  || banner.imageUrl;

  if (!desktopSrc && !mobileSrc) return null;

  // CSS-ээр responsive зураг — JS/state ашиглахгүй тул SSR + hydration алдаагүй
  return (
    <>
      {/* Mobile ≤767px */}
      {mobileSrc && (
        <SmartImage
          src={mobileSrc}
          alt={banner.title}
          fill
          className="object-cover sm:hidden"
          priority
          sizes="100vw"
          fallbackClassName="sm:hidden"
        />
      )}
      {/* Desktop ≥768px */}
      {desktopSrc && (
        <SmartImage
          src={desktopSrc}
          alt={banner.title}
          fill
          className="object-cover hidden sm:block"
          priority
          sizes="100vw"
          fallbackClassName="hidden sm:flex"
        />
      )}
    </>
  );
}

export function BannerCarousel({ banners }: Props) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [direction, setDirection] = useState(1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = (idx: number, dir: number) => {
    setDirection(dir);
    setCurrent((idx + banners.length) % banners.length);
  };

  const prev = () => go(current - 1, -1);
  const next = () => go(current + 1, 1);

  useEffect(() => {
    if (paused || banners.length <= 1) return;
    timer.current = setInterval(() => {
      setDirection(1);
      setCurrent((c) => (c + 1) % banners.length);
    }, INTERVAL);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [paused, banners.length]);

  if (!banners.length) return null;

  const banner = banners[current];

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  return (
    <section
      className="relative overflow-hidden min-h-70 sm:min-h-100"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence custom={direction} initial={false}>
        <motion.div
          key={banner.id}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'tween', ease: [0.32, 0, 0.67, 0], duration: 0.45 }}
          className="absolute inset-0"
        >
          <div
            className="relative flex h-full min-h-70 sm:min-h-100 w-full items-center"
            style={{ background: banner.bgColor ?? '#022179' }}
          >
            <BannerMedia banner={banner} />

            <div
              className="absolute inset-0"
              style={{
                background: (banner.videoUrl || banner.desktopImageUrl || banner.mobileImageUrl || banner.imageUrl)
                  ? `linear-gradient(90deg, ${banner.bgColor ?? '#022179'}e6 0%, ${banner.bgColor ?? '#022179'}80 50%, transparent 100%)`
                  : undefined,
              }}
            />

            <div className="relative z-10 mx-auto max-w-7xl w-full px-4 sm:px-12 lg:px-16 py-8 sm:py-16 lg:py-24 flex items-center min-h-70 sm:min-h-100">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="max-w-xl"
              >
                <h1 className="text-xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl drop-shadow">
                  {banner.title}
                </h1>
                {banner.subtitle && (
                  <p className="mt-3 text-sm md:text-base lg:text-lg text-white/80 drop-shadow">
                    {banner.subtitle}
                  </p>
                )}
                {banner.linkUrl && (
                  <Button
                    asChild
                    size="lg"
                    className="mt-6 font-bold shadow-lg bg-[#ffbe00] text-[#022179] hover:bg-[#ffd84d] dark:bg-[#ffbe00] dark:text-[#022179] dark:hover:bg-[#ffd84d]"
                  >
                    <Link href={banner.linkUrl}>
                      {banner.linkLabel ?? 'Дэлгэрэнгүй'}
                    </Link>
                  </Button>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {banners.length > 1 && (
        <>
          {/* Desktop: зүүн/баруун дунд — mobile-д нуух */}
          <button
            onClick={prev}
            aria-label="Өмнөх"
            className="hidden sm:flex absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition hover:bg-black/50"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            aria-label="Дараах"
            className="hidden sm:flex absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition hover:bg-black/50"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Mobile: сум + dot indicator хамт доод хэсэгт */}
          <div className="sm:hidden absolute bottom-3 left-0 right-0 z-20 flex items-center justify-center gap-3">
            <button
              onClick={prev}
              aria-label="Өмнөх"
              className="rounded-full bg-black/30 p-1.5 text-white backdrop-blur-sm transition active:bg-black/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {banners.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Слайд ${i + 1}`}
                  onClick={() => go(i, i > current ? 1 : -1)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={next}
              aria-label="Дараах"
              className="rounded-full bg-black/30 p-1.5 text-white backdrop-blur-sm transition active:bg-black/50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Desktop dot indicator */}
          <div className="hidden sm:flex absolute bottom-4 left-1/2 z-20 -translate-x-1/2 gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                aria-label={`Слайд ${i + 1}`}
                onClick={() => go(i, i > current ? 1 : -1)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === current ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
