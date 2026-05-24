'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDays, User, Tag, ArrowRight, Loader2 } from 'lucide-react';
import { Badge, Skeleton } from '@digitalger/shared/ui';
import { blogApi } from '@/lib/api';
import type { BlogPost } from '@/types/api';
import { PageHeader } from '@/components/ui/page-header';
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

function BlogCard({ post }: { post: BlogPost }) {
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

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
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
            <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function BlogPage() {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['blog', 'list'],
      queryFn: ({ pageParam = 1 }) =>
        blogApi.list({ page: pageParam as number, pageSize: PAGE_SIZE }),
      getNextPageParam: (last) => {
        const loaded = (last.page - 1) * last.pageSize + last.items.length;
        return loaded < last.total ? last.page + 1 : undefined;
      },
      initialPageParam: 1,
      staleTime: 60_000,
    });

  const allPosts = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(onIntersect, { rootMargin: '300px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onIntersect]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4 mb-8">
        <PageHeader
          title="Нийтлэл"
          description="Дижитал бизнес, загвар хэрэглээ, мэргэжлийн зөвлөгөө"
          className="mb-0"
        />
        {!isLoading && total > 0 && (
          <span className="shrink-0 text-sm text-muted-foreground">Нийт {total} нийтлэл</span>
        )}
      </div>

      {/* Screen reader live region for loading state */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isFetchingNextPage ? 'Нийтлэл ачаалж байна...' : ''}
      </div>

      {/* Initial skeleton */}
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <BlogCardSkeleton key={i} />
          ))}
        </div>
      ) : allPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Tag className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-lg">Нийтлэл байхгүй байна</p>
          <p className="text-sm text-muted-foreground mt-1">Удахгүй шинэ нийтлэлүүд нэмэгдэнэ</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {allPosts.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}

            {/* Inline skeletons while fetching next page */}
            {isFetchingNextPage &&
              Array.from({ length: 3 }).map((_, i) => <BlogCardSkeleton key={`sk-${i}`} />)}
          </div>

          {/* Sentinel — intersection observer target */}
          <div ref={sentinelRef} className="h-1" />

          {/* Bottom spinner */}
          {isFetchingNextPage && (
            <div className="flex justify-center pt-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!hasNextPage && allPosts.length > 0 && (
            <div className="flex items-center justify-between pt-10 border-t border-border mt-4">
              <span className="text-sm text-muted-foreground">Бүх нийтлэл харагдаж байна</span>
              <span className="text-sm font-medium text-foreground">Нийт {total} нийтлэл</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
