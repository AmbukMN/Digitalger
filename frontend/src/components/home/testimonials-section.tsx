'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import Image from 'next/image';
import type { Testimonial } from '@/types/api';

interface Props {
  testimonials: Testimonial[];
}

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm h-full">
      <Quote className="h-8 w-8 text-primary/20 shrink-0" />
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} className={`h-4 w-4 ${s <= t.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`} />
        ))}
      </div>
      <p className="flex-1 text-sm leading-relaxed text-foreground sm:text-base">&ldquo;{t.content}&rdquo;</p>
      <div className="flex items-center gap-3 pt-3 border-t border-border">
        {t.avatar ? (
          <Image src={t.avatar} alt={t.name} width={40} height={40} className="h-10 w-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {t.name.charAt(0)}
          </div>
        )}
        <div>
          <p className="font-semibold text-sm">{t.name}</p>
          {t.role && <p className="text-xs text-muted-foreground">{t.role}</p>}
        </div>
      </div>
    </div>
  );
}

const PER_DESKTOP = 3;

export function TestimonialsSection({ testimonials }: Props) {
  const [mobileIdx, setMobileIdx] = useState(0);
  const [mobileDir, setMobileDir] = useState(1);
  const [desktopIdx, setDesktopIdx] = useState(0);

  const maxDesktop = Math.max(0, testimonials.length - PER_DESKTOP);
  const canPrev = desktopIdx > 0;
  const canNext = desktopIdx < maxDesktop;

  const prevDesktop = () => setDesktopIdx((i) => Math.max(0, i - 1));
  const nextDesktop = () => setDesktopIdx((i) => Math.min(maxDesktop, i + 1));

  const prevMobile = () => {
    setMobileDir(-1);
    setMobileIdx((i) => (i - 1 + testimonials.length) % testimonials.length);
  };
  const nextMobile = () => {
    setMobileDir(1);
    setMobileIdx((i) => (i + 1) % testimonials.length);
  };

  // Auto-advance desktop
  useEffect(() => {
    if (maxDesktop === 0) return;
    const id = setInterval(() => {
      setDesktopIdx((i) => (i < maxDesktop ? i + 1 : 0));
    }, 4000);
    return () => clearInterval(id);
  }, [maxDesktop]);

  // Auto-advance mobile
  useEffect(() => {
    if (testimonials.length <= 1) return;
    const id = setInterval(() => {
      setMobileDir(1);
      setMobileIdx((i) => (i + 1) % testimonials.length);
    }, 4000);
    return () => clearInterval(id);
  }, [testimonials.length]);

  if (!testimonials.length) return null;

  return (
    <section className="py-16 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold sm:text-3xl">Худалдан авагчид юу гэж хэлэв?</h2>
          <p className="mt-2 text-sm text-muted-foreground">Мянга мянган хэрэглэгчид DigitalGer-ээр дамжуулан цаг хугацаа болон зардлаа хэмнэж байна. Бодит туршлага, бодит үр дүн.</p>
        </div>

        {/* Mobile: 1 карт нэг удаа */}
        <div className="lg:hidden relative px-8">
          <div className="overflow-hidden rounded-2xl">
            <motion.div
              key={mobileIdx}
              initial={{ x: mobileDir > 0 ? '100%' : '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: mobileDir > 0 ? '-100%' : '100%', opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            >
              <TestimonialCard t={testimonials[mobileIdx]} />
            </motion.div>
          </div>
          {testimonials.length > 1 && (
            <>
              <button type="button" onClick={prevMobile}
                className="absolute left-0 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={nextMobile}
                className="absolute right-0 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="mt-5 flex justify-center gap-2">
                {testimonials.map((_, i) => (
                  <button key={i} type="button" onClick={() => { setMobileDir(i > mobileIdx ? 1 : -1); setMobileIdx(i); }}
                    className={`h-2 rounded-full transition-all duration-300 ${i === mobileIdx ? 'w-6 bg-primary' : 'w-2 bg-border'}`} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Desktop: 3 карт харагдана, 1-ээр гүйнэ */}
        <div className="hidden lg:block relative px-10">
          <div className="overflow-hidden">
            <motion.div
              className="flex"
              animate={{ x: `-${desktopIdx * (100 / PER_DESKTOP)}%` }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
              {testimonials.map((t) => (
                <div key={t.id} style={{ minWidth: `${100 / PER_DESKTOP}%` }} className="px-3">
                  <TestimonialCard t={t} />
                </div>
              ))}
            </motion.div>
          </div>

          {maxDesktop > 0 && (
            <>
              <button type="button" onClick={prevDesktop} disabled={!canPrev}
                className="absolute left-0 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={nextDesktop} disabled={!canNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="mt-6 flex justify-center gap-2">
                {Array.from({ length: maxDesktop + 1 }, (_, i) => (
                  <button key={i} type="button" onClick={() => setDesktopIdx(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${i === desktopIdx ? 'w-6 bg-primary' : 'w-2 bg-border'}`} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
