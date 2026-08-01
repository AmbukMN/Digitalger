'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Eye, FileText } from 'lucide-react';
import { ErrorState } from '@besttv/shared/ui';
import { useBlogPost } from '@/lib/queries';

export function BlogDetailClient({ slug }: { slug: string }) {
  const { data, isLoading, isError, refetch } = useBlogPost(slug);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background px-4 pb-16 pt-28 md:px-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="skeleton-shimmer aspect-video rounded-xl" />
          <div className="skeleton-shimmer h-8 w-2/3 rounded-lg" />
          <div className="skeleton-shimmer h-4 w-full rounded-lg" />
        </div>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 pt-16">
        <ErrorState title="Нийтлэл олдсонгvй" message="Хайж буй нийтлэл байхгvй эсвэл устгагдсан байна." onRetry={() => refetch()} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-28 md:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
          <ArrowLeft size={14} /> Блог руу буцах
        </Link>

        {data.coverUrl && (
          <div className="relative mt-5 aspect-video overflow-hidden rounded-xl bg-[#1a1a1a]">
            <Image src={data.coverUrl} alt="" fill sizes="800px" className="object-cover" priority />
          </div>
        )}

        <h1 className="mt-6 text-2xl font-black tracking-tight text-white md:text-4xl">{data.title}</h1>
        <div className="mt-3 flex items-center gap-3 text-sm text-white/45">
          {data.author && <span>{data.author}</span>}
          {data.publishedAt && <span>{new Date(data.publishedAt).toLocaleDateString('mn-MN')}</span>}
          <span className="flex items-center gap-1"><Eye size={13} /> {data.views}</span>
        </div>

        {data.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.tags.map((t) => (
              <span key={t} className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/60">
                {t}
              </span>
            ))}
          </div>
        )}

        {data.content ? (
          <div
            className="static-page mt-8 text-white/80"
            dangerouslySetInnerHTML={{ __html: data.content }}
          />
        ) : (
          <p className="mt-8 flex items-center gap-2 text-white/40">
            <FileText size={16} /> Агуулга байхгүй
          </p>
        )}
      </div>
    </main>
  );
}
