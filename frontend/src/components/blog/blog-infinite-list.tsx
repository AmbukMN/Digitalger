'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDays, User, Tag, Loader2 } from 'lucide-react';
import { BLUR_DATA_URL } from '@/lib/image-blur';
import { Badge, Skeleton } from '@digitalger/shared/ui';
import { blogApi } from '@/lib/api';
import type { BlogPost } from '@/types/api';
import { formatDate } from '@/lib/format';

const PAGE_SIZE = 9;

function BlogCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <Skeleton className="aspect-video w-full" />
      <div className="p-5 space-y-3">
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3.5 w-2/3 mt-2" />
      </div>
    </div>
  );
}

export function BlogCard({ post }: { post: BlogPost }) {
  const date = formatDate(post.publishedAt ?? post.createdAt);

  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <article className="h-full rounded-2xl border border-border bg-card overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        <div className="relative aspect-video bg-muted overflow-hidden">
          {post.coverImageUrl ? (
            <Image
              src={post.coverImageUrl}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-linear-to-br from-primary/10 to-accent/10">
              <Tag className="h-10 w-10 text-primary/30" />
            </div>
          )}
        </div>

        <div className="p-5">
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {post.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <h2 className="font-bold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h2>

          {post.excerpt && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
              {post.excerpt}
            </p>
          )}

          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {post.authorName}
            </span>
            {date && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {date}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

interface BlogInfiniteListProps {
  initialPosts: BlogPost[];
  total: number;
  tag?: string;
}

export function BlogInfiniteList({ initialPosts, total, tag }: BlogInfiniteListProps) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const hasMore = posts.length < total;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const next = page + 1;
      const data = await blogApi.list({ page: next, pageSize: PAGE_SIZE, tag });
      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newPosts = data.items.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newPosts];
      });
      setPage(next);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, tag]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {loading ? 'Нийтлэл ачаалж байна...' : ''}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <BlogCard key={post.id} post={post} />
        ))}
        {loading && Array.from({ length: 3 }).map((_, i) => <BlogCardSkeleton key={`sk-${i}`} />)}
      </div>

      <div ref={sentinelRef} className="h-1" />

      {loading && (
        <div className="flex justify-center pt-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="flex items-center justify-between pt-10 border-t border-border mt-4">
          <span className="text-sm text-muted-foreground">Бүх нийтлэл харагдаж байна</span>
          <span className="text-sm font-medium text-foreground">Нийт {total} нийтлэл</span>
        </div>
      )}
    </>
  );
}
