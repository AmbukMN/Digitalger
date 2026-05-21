'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Tag } from 'lucide-react';
import { Badge } from '@digitalger/shared/ui';
import { useEffect, useRef, useState } from 'react';
import type { BlogPost } from '@/types/api';

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
            <Image
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

function BlogCarousel({ posts }: { posts: BlogPost[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  function checkScroll() {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    return () => el.removeEventListener('scroll', checkScroll);
  }, [posts]);

  function scroll(dir: 'prev' | 'next') {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'next' ? el.clientWidth : -el.clientWidth, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      {/* Prev button */}
      <button
        type="button"
        onClick={() => scroll('prev')}
        disabled={!canPrev}
        className="absolute left-0 top-1/2 z-10 -translate-y-1/2 -translate-x-1 sm:-translate-x-3 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Өмнөх"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* Scroll track */}
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-3 px-8 sm:px-2 scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {posts.map((post) => (
          <div
            key={post.id}
            data-card
            className="snap-start shrink-0 w-[calc(100vw-5rem)] sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)]"
          >
            <BlogCard post={post} />
          </div>
        ))}
      </div>

      {/* Next button */}
      <button
        type="button"
        onClick={() => scroll('next')}
        disabled={!canNext}
        className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-1 sm:translate-x-3 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Дараах"
      >
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function BlogSection({ posts }: { posts: BlogPost[] }) {
  if (!posts.length) return null;

  return (
    <section className="py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold sm:text-2xl">Мэргэжилтний Зөвлөгөө, нийтлэл</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Дижитал бизнесийг ахиулах практик зөвлөмж, гарын авлага, нийтлэл</p>
          </div>
          <Link
            href="/blog"
            className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium shrink-0"
          >
            Бүгдийг харах
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <BlogCarousel posts={posts} />
      </div>
    </section>
  );
}
