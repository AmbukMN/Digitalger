'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, FileText } from 'lucide-react';
import { cn } from '@besttv/shared';
import { ErrorState } from '@besttv/shared/ui';
import { useBlogPosts } from '@/lib/queries';

export default function BlogListPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useBlogPosts(page);

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-28 md:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/8 px-3 py-1 text-xs font-bold text-foreground/70">
          <FileText size={12} /> БЛОГ
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">Мэдээ, нийтлэл</h1>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* ⚠️ Алдааг empty state болгон нуухгүй — retry санал болгоно */}
        {isError && (
          <div className="col-span-full">
            <ErrorState
              title="Ачаалж чадсангүй"
              message="Нийтлэлүүдийг татаж чадсангүй."
              onRetry={() => refetch()}
            />
          </div>
        )}

        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer aspect-video rounded-xl" />
          ))}

        {data?.items.map((p) => (
          <Link
            key={p.id}
            href={`/blog/${p.slug}`}
            className="group overflow-hidden rounded-xl bg-foreground/5 transition-colors hover:bg-foreground/8"
          >
            <div className="relative aspect-video overflow-hidden bg-[#1a1a1a]">
              {p.coverUrl ? (
                <Image src={p.coverUrl} alt="" fill sizes="360px" className="object-cover transition-transform group-hover:scale-105" />
              ) : (
                <div className="flex h-full items-center justify-center text-foreground/15">
                  <FileText size={32} />
                </div>
              )}
            </div>
            <div className="p-4">
              <h2 className="line-clamp-2 font-semibold text-foreground/90">{p.title}</h2>
              {p.excerpt && <p className="mt-1.5 line-clamp-2 text-sm text-foreground/50">{p.excerpt}</p>}
              <div className="mt-3 flex items-center gap-3 text-xs text-foreground/35">
                {p.publishedAt && <span>{new Date(p.publishedAt).toLocaleDateString('mn-MN')}</span>}
                <span className="flex items-center gap-1"><Eye size={12} /> {p.views}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {!isLoading && data?.items.length === 0 && (
        <p className="mt-16 text-center text-foreground/40">Одоогоор нийтлэл байхгvй байна</p>
      )}

      {data && data.totalPages > 1 && (
        <div className="mx-auto mt-10 flex max-w-5xl justify-center gap-1.5">
          {Array.from({ length: data.totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={cn(
                'h-9 w-9 rounded-lg text-sm font-medium transition-colors',
                page === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-foreground/8 text-foreground/60 hover:bg-foreground/12',
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
