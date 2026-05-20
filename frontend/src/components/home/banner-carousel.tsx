'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@digitalger/shared/ui';
import type { Banner } from '@/types/api';

const INTERVAL = 5000;

interface Props {
  banners: Banner[];
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
      className="relative overflow-hidden"
      style={{ minHeight: 400 }}
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
            className="relative flex h-full min-h-[400px] w-full items-center"
            style={{ background: banner.bgColor ?? '#022179' }}
          >
            {banner.imageUrl && (
              <Image
                src={banner.imageUrl}
                alt={banner.title}
                fill
                className="object-cover"
                priority
                sizes="100vw"
              />
            )}
            <div
              className="absolute inset-0"
              style={{
                background: banner.imageUrl
                  ? `linear-gradient(90deg, ${banner.bgColor ?? '#022179'}e6 0%, ${banner.bgColor ?? '#022179'}80 50%, transparent 100%)`
                  : undefined,
              }}
            />
            <div className="relative z-10 mx-auto max-w-7xl w-full px-8 sm:px-12 lg:px-16 py-16 lg:py-24">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="max-w-xl"
              >
                <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl drop-shadow">
                  {banner.title}
                </h1>
                {banner.subtitle && (
                  <p className="mt-3 text-base sm:text-lg text-white/80 drop-shadow">
                    {banner.subtitle}
                  </p>
                )}
                {banner.linkUrl && (
                  <Button
                    asChild
                    size="lg"
                    className="mt-6 bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold shadow-lg"
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
          <button
            onClick={prev}
            aria-label="Өмнөх"
            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition hover:bg-black/50"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            aria-label="Дараах"
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition hover:bg-black/50"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
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
