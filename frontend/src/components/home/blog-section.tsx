'use client';

import Link from 'next/link';
import { ArrowRight, Tag } from 'lucide-react';
import { SmartImage } from '@/components/ui/smart-image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@digitalger/shared/ui';
import { cn } from '@digitalger/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BlogPost } from '@/types/api';

const GAP = 16;
const AUTO_INTERVAL = 4000;

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function BlogCard({ post }: { post: BlogPost }) {
  const date = formatDate(post.publishedAt ?? post.createdAt);
  return (
    <Link href={`/blog/${post.slug}`} className="group block h-full">
      <article className="h-full rounded-2xl border border-border bg-card overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        <div className="relative aspect-video bg-muted overflow-hidden">
          {post.coverImageUrl ? (
            <SmartImage
              src={post.coverImageUrl}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-linear-to-br from-primary/10 to-accent/10">
              <Tag className="h-8 w-8 text-primary/30" />
            </div>
          )}
        </div>
        <div className="p-4">
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {post.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {post.excerpt}
            </p>
          )}
          {date && (
            <p className="mt-3 text-xs text-muted-foreground">{date}</p>
          )}
        </div>
      </article>
    </Link>
  );
}

function BlogSwiper({ posts }: { posts: BlogPost[] }) {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(false);
  const [cardW, setCardW] = useState(0);

  const calcLayout = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const cols = w >= 1024 ? 3 : 1;
    setCardW(Math.floor((w - GAP * (cols - 1)) / cols));
  }, []);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  const pan = useCallback((dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (dir === 1 && el.scrollLeft >= maxScroll - 4) {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (dir === -1 && el.scrollLeft <= 4) {
      el.scrollTo({ left: maxScroll, behavior: 'smooth' });
    } else {
      el.scrollBy({ left: dir * (el.clientWidth + GAP), behavior: 'smooth' });
    }
  }, []);

  const startAuto = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) pan(1);
    }, AUTO_INTERVAL);
  }, [pan]);

  const pauseAuto  = () => { pausedRef.current = true; };
  const resumeAuto = () => { pausedRef.current = false; };

  useEffect(() => {
    calcLayout();
    const ro = new ResizeObserver(() => { calcLayout(); sync(); });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [calcLayout, sync]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const t = setTimeout(sync, 100);
    el.addEventListener('scroll', sync, { passive: true });
    return () => { clearTimeout(t); el.removeEventListener('scroll', sync); };
  }, [sync, posts, cardW]);

  useEffect(() => {
    if (cardW === 0) return;
    startAuto();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [cardW, startAuto]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={pauseAuto}
      onMouseLeave={resumeAuto}
      onTouchStart={pauseAuto}
      onTouchEnd={resumeAuto}
    >
      <button
        type="button" aria-label="Өмнөх"
        onClick={() => { pauseAuto(); pan(-1); setTimeout(resumeAuto, 3000); }}
        className={cn(
          'absolute -left-5 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-md transition-all duration-200 hover:bg-primary hover:text-primary-foreground',
          canL ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none',
        )}
      ><ChevronLeft className="h-4 w-4" /></button>

      <div
        ref={trackRef}
        className="hide-scrollbar"
        style={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridTemplateRows: '1fr',
          gridAutoColumns: cardW > 0 ? cardW : undefined,
          gap: GAP,
          overflowX: 'auto',
          paddingTop: 8,
          paddingBottom: 10,
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {cardW > 0 && posts.map((post) => (
          <div key={post.id} style={{ scrollSnapAlign: 'start', minWidth: 0 }}>
            <BlogCard post={post} />
          </div>
        ))}
      </div>

      <button
        type="button" aria-label="Дараах"
        onClick={() => { pauseAuto(); pan(1); setTimeout(resumeAuto, 3000); }}
        className={cn(
          'absolute -right-5 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-md transition-all duration-200 hover:bg-primary hover:text-primary-foreground',
          canR ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none',
        )}
      ><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}

export function BlogSection({ posts }: { posts: BlogPost[] }) {
  if (!posts.length) return null;

  return (
    <section className="py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-primary shrink-0" aria-hidden="true" />
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">Мэргэжилтний Зөвлөгөө, нийтлэл</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Дижитал бизнесийг ахиулах практик зөвлөмж, гарын авлага, нийтлэл</p>
            </div>
          </div>
          <Link
            href="/blog"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-medium shrink-0 transition-colors"
          >
            Бүгдийг харах
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <BlogSwiper posts={posts} />
      </div>
    </section>
  );
}
