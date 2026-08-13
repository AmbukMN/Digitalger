'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
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
    /* ⚠️ `id` — түрээслэсэн киног "Төлбөртэй" гэж харуулахгүйн тулд */
    id: banner.id,
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
              {/* ⚠️ `object-top` — анхдагч `object-cover` нь ГОЛООС
                  тайрдаг тул жүжигчдийн ТОЛГОЙ таслагддаг байв */}
              <Image
                src={banner.backdropUrl}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover object-top"
              />
            </div>
          )}
          <div className="hero-gradient absolute inset-0" />
          <div className="hero-gradient-side absolute inset-0" />
        </motion.div>
      </AnimatePresence>

      {/* Контентын хэсэг — stagger animation.
          ⚠️ Индикатор доор нь ТУСАД НЬ байрлана (bottom-10/14) тул контентыг
          түүнээс ДЭЭШ (bottom-24/40) өргөнө — эс бөгөөс "Үзэх" товчтой
          зураасууд давхцана.

          ⚠️⚠️ `top-20` + `justify-end` — MOBILE-Д ГАРЧИГ NAVBAR-ТАЙ
          ДАВХЦАХААС СЭРГИЙЛНЭ. Өмнө нь зөвхөн `bottom-*` байсан тул
          hero намхан үед (min-h-105 ≈ 420px) урт гарчиг ДЭЭШЭЭ ургаж
          navbar-ын доогуур ОРЖ ДАВХЦДАГ байв (бодит гомдол).
          Одоо дээд хязгаартай болсон тул хэзээ ч давхцахгүй. */}
      <div className="absolute inset-x-4 bottom-24 top-20 flex max-w-xl flex-col justify-end md:inset-x-auto md:bottom-40 md:left-12 md:top-24">
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
                <span className="flex items-center gap-1 rounded bg-premium-solid px-2 py-0.5 font-bold uppercase tracking-wide text-premium-foreground">
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
              /* ⚠️ Mobile-д 2 мөрөөр таслана — урт гарчиг дэлгэц дүүргэж,
                 тайлбар/товч доош түлхэгдэхээс сэргийлнэ */
              className="line-clamp-2 text-2xl font-black leading-[1.1] tracking-tight text-white drop-shadow-2xl sm:text-3xl md:text-5xl lg:text-6xl"
            >
              {banner.title}
            </motion.h1>

            <motion.p
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              /* ⚠️ Mobile-д 2 мөр + жижиг — дэлгэц дүүргэхгүй */
              className="mt-2.5 line-clamp-2 max-w-lg text-xs leading-relaxed text-white/75 sm:mt-4 sm:line-clamp-3 sm:text-sm md:text-base"
            >
              {banner.description}
            </motion.p>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              className="mt-4 flex flex-wrap gap-2 sm:mt-6 sm:gap-3"
            >
              {/*
                ⚠️⚠️ ЭРХТЭЙ БОЛ ШУУД ТОГЛУУЛНА.
                Өмнө нь `hasAccess` дамжуулдаггүй байсан тул `usePlayGuard`
                дотор `undefined !== true` үнэн болж, ЭРХТЭЙ хэрэглэгчийг
                ч дэлгэрэнгүй рүү явуулдаг байв — "Үзэх" ба "Дэлгэрэнгүй"
                хоёр ижил үүрэгтэй болсон (бодит гомдол).
                Одоо `bannerAccess`-ыг дамжуулна: эрхтэй бол /watch руу
                ШУУД, эрхгүй/нэвтрээгүй бол дэлгэрэнгүй (тэнд багц/түрээс).
              */}
              {(() => {
                /**
                 * ⚠️⚠️ `rented` ЗААВАЛ — өмнө орхигдсон тул мөнгө төлж
                 * ТҮРЭЭСЭЛСЭН хэрэглэгч баннер дээр «🔒 Төлбөртэй»
                 * шошго + «Багц авах» товч хардаг байв.
                 * ⚠️ `title-card.tsx` дээр зөв багтсан — энэ хоёр
                 * зөрчилдөж байсныг нэгтгэв.
                 */
                const canPlay =
                  bannerAccess === 'owned' ||
                  bannerAccess === 'free' ||
                  bannerAccess === 'rented';
                /**
                 * ⚠️⚠️ ТОВЧНЫ БИЧЭЭС ЯГ ЮУ ХИЙХИЙГ АМЛАНА.
                 *
                 * «Багц авах» гэж бичээд `usePlayGuard`-аар дамжуулбал
                 * тэр нь эрхгүй хэрэглэгчийг ДЭЛГЭРЭНГҮЙ рүү явуулдаг
                 * тул хажуугийн «Дэлгэрэнгүй» товчтой ЯГ АДИЛХАН болно
                 * — 2 өөр нэртэй товч нэг л газар очих нь эвдэрсэн мэт
                 * харагдана (бодит гомдол).
                 *
                 * Зөв: бичээс «Багц авах» бол /pricing руу ШУУД. Тэнд
                 * үнэ, багцын харьцуулалт, урамшуулал бүгд байна.
                 * Кино ӨӨРӨӨ сонирхсон бол хажууд нь «Дэлгэрэнгүй».
                 *
                 * ⚠️ `title-card`-д товч нь зөвхөн Play дүрстэй, «Багц
                 * авах» гэж амладаггүй тул тэнд дэлгэрэнгүй рүү явах
                 * нь ЗӨВ хэвээр — энэ засварыг тийш хуулахгүй.
                 */
                /**
                 * ⚠️ «Багц авах» гэж ХЭЗЭЭ бичих вэ: зөвхөн ТӨЛБӨРИЙН
                 * шалтгаанаар үзэж чадахгүй үед. «Удахгүй гарна» эсвэл
                 * «видео бэлтгэгдэж байна» бол мөнгө нэхэх нь буруу —
                 * тэр хоёрыг `usePlayGuard` тайлбартай зохицуулна.
                 */
                const paywalled = !canPlay && !banner.comingSoon && !!banner.isPremium;

                const goPricing = () => router.push('/pricing');
                return (
                  <button
                    onClick={() =>
                      paywalled
                        ? goPricing()
                        : play(
                            {
                              slug: banner.slug,
                              isPremium: banner.isPremium,
                              comingSoon: banner.comingSoon,
                              type: banner.type,
                            },
                            canPlay,
                          )
                    }
                    className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-bold text-black transition-all hover:scale-[1.03] hover:bg-white/90 active:scale-[0.98] sm:gap-2 sm:px-6 sm:py-3 sm:text-base"
                  >
                    {/*
                      ⚠️ ТОВЧНЫ НЭР ЭРХЭЭС ХАМААРНА. Эрхгүй хэрэглэгчид
                      "Үзэх" гэж харуулах нь ХУДАЛ амлалт — дарахад үзэхийн
                      оронд төлбөрийн хуудас гардаг тул хэрэглэгч эндүүрнэ.
                    */}
                    {canPlay ? (
                      <>
                        <Play size={19} fill="black" /> Үзэх
                      </>
                    ) : paywalled ? (
                      <>
                        <Lock size={17} /> Багц авах
                      </>
                    ) : (
                      /* Удахгүй гарах / видео бэлтгэгдэж буй — мөнгө
                         нэхэхгүй, зүгээр мэдээлэл рүү нь урина */
                      <>
                        <Info size={18} /> Дэлгэрэнгүй
                      </>
                    )}
                  </button>
                );
              })()}
              <Link
                href={`/movie/${banner.slug}`}
                className="flex items-center gap-1.5 rounded-lg bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:scale-[1.03] hover:bg-black/65 active:scale-[0.98] sm:gap-2 sm:px-6 sm:py-3 sm:text-base"
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
            /**
             * ⚠️⚠️ ХҮРЭХ ТАЛБАЙН WRAPPER — `py-3 -my-3`.
             *
             * Зураас нь 4px өндөр (`h-1`) тул хуруугаар онох бараг
             * БОЛОМЖГҮЙ байв: хэрэглэгч 3-4 удаа оролдоод бууж өгч,
             * 6 секунд хүлээж автомат солигдохыг хүлээдэг.
             *
             * `py-3 -my-3` нь ЗАЙ ЭЗЛЭХГҮЙГЭЭР (сөрөг margin нөхнө)
             * дарах өндрийг 4px → 28px болгоно. Товч дээр шууд тавьж
             * болохгүй — `h-1`-тэй зөрчилдөж зураас өөрөө өргөснө.
             */
            <span key={b.id} className="-my-3 flex items-center py-3">
            <button
              role="tab"
              aria-selected={i === active}
              aria-label={`${b.title} слайд`}
              onClick={() => setActive(i)}
              className={cn(
                /**
                 * ⚠️⚠️ ХҮРЭХ ТАЛБАЙ — `before:` псевдо-элементээр өргөснө.
                 *
                 * Зураас нь 4px өндөр (`h-1`) тул хуруугаар онох бараг
                 * БОЛОМЖГҮЙ байв — хэрэглэгч 3-4 удаа оролдоод бууж
                 * өгч, 6 секунд хүлээж автомат солигдохыг хүлээдэг.
                 *
                 * ⚠️ `before:-inset-y-3` нь ХАРАГДАХ хэмжээг
                 * ӨӨРЧЛӨХГҮЙГЭЭР хүрэх өндрийг 4px → 28px болгоно
                 * (загвар хэвээр, ашиглалт л сайжирна).
                 */
                /* ⚠️ `overflow-hidden` ХЭВЭЭР — дэвшилтийн зураас хүрээнээс
                   халихгүй. Хүрэх талбайг доорх `<span>`-аар өргөснө
                   (`before:` нь overflow-д таслагдана). */
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
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
