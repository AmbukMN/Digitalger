'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { Avatar } from '@digitalger/shared/ui';

interface Testimonial {
  id: string;
  name: string;
  avatar?: string | null;
  role?: string | null;
  content: string;
  rating: number;
}

interface Props {
  testimonials: Testimonial[];
}

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm h-full">
      <div className="flex items-start justify-between gap-2">
        <Quote className="h-6 w-6 text-primary/25 shrink-0" />
        <div className="flex gap-0.5 shrink-0">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} className={`h-3.5 w-3.5 ${s <= t.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`} />
          ))}
        </div>
      </div>
      <p className="flex-1 text-sm leading-relaxed text-foreground">&ldquo;{t.content}&rdquo;</p>
      <div className="flex items-center gap-2.5 pt-3 border-t border-border">
        <Avatar src={t.avatar} name={t.name} size={36} />
        <div>
          <p className="text-sm font-semibold leading-tight">{t.name}</p>
          {t.role && <p className="text-xs text-muted-foreground">{t.role}</p>}
        </div>
      </div>
    </div>
  );
}

const PER_DESKTOP = 2;

export function ProductTestimonialsSection({ testimonials }: Props) {
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

  useEffect(() => {
    if (maxDesktop === 0) return;
    const id = setInterval(() => {
      setDesktopIdx((i) => (i < maxDesktop ? i + 1 : 0));
    }, 4000);
    return () => clearInterval(id);
  }, [maxDesktop]);

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
    <>
      {/* Mobile: 1 карт нэг удаа.
          Контейнерт ТОГТСОН min-height — карусель солигдоход сэтгэгдэл бүрийн
          өндөр ялгаатайгаас хуудас дээш доош үсрэх (layout shift) асуудлыг засна.
          Карт min-height дотроо төвлөрнө, урт контент scroll болохгүй харагдана. */}
      <div className="lg:hidden relative px-8">
        <div className="overflow-hidden rounded-2xl min-h-72">
          <motion.div
            key={mobileIdx}
            className="h-full"
            initial={{ x: mobileDir > 0 ? '100%' : '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <TestimonialCard t={testimonials[mobileIdx]} />
          </motion.div>
        </div>
        {testimonials.length > 1 && (
          <>
            <button type="button" onClick={prevMobile}
              className="absolute left-0 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={nextMobile}
              className="absolute right-0 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="mt-4 flex justify-center gap-1.5">
              {testimonials.map((_, i) => (
                <button key={i} type="button" onClick={() => { setMobileDir(i > mobileIdx ? 1 : -1); setMobileIdx(i); }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === mobileIdx ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Desktop: 2 карт харагдана, 1-ээр гүйнэ */}
      <div className="hidden lg:block relative px-8">
        <div className="overflow-hidden">
          <motion.div
            className="flex"
            animate={{ x: `-${desktopIdx * (100 / PER_DESKTOP)}%` }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          >
            {testimonials.map((t) => (
              <div key={t.id} style={{ minWidth: `${100 / PER_DESKTOP}%` }} className="px-2">
                <TestimonialCard t={t} />
              </div>
            ))}
          </motion.div>
        </div>

        {maxDesktop > 0 && (
          <>
            <button type="button" onClick={prevDesktop} disabled={!canPrev}
              className="absolute left-0 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={nextDesktop} disabled={!canNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="mt-5 flex justify-center gap-2">
              {Array.from({ length: maxDesktop + 1 }, (_, i) => (
                <button key={i} type="button" onClick={() => setDesktopIdx(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${i === desktopIdx ? 'w-6 bg-primary' : 'w-2 bg-border'}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
