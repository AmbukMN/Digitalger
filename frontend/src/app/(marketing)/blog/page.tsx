export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Tag } from 'lucide-react';
import { blogApi, siteSettingsApi } from '@/lib/api';
import { applySeoOverride } from '@/lib/page-metadata';
import type { BlogPost } from '@/types/api';
import { PageHeader } from '@/components/ui/page-header';
import { BlogInfiniteList } from '@/components/blog/blog-infinite-list';
import { SITE_URL } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  let ogImageUrl: string | null = null;
  try {
    const s = await siteSettingsApi.getPublic();
    ogImageUrl = s.ogImageUrl ?? null;
  } catch { /* fallback */ }
  const defaultMeta: Metadata = {
    title: 'Нийтлэл',
    description: 'Дижитал бизнес, загвар хэрэглээ, мэргэжлийн зөвлөгөө',
    alternates: { canonical: `${SITE_URL}/blog` },
    openGraph: {
      title: 'Нийтлэл — DigitalGer',
      description: 'Дижитал бизнес, загвар хэрэглээ, мэргэжлийн зөвлөгөө',
      url: `${SITE_URL}/blog`,
      ...(ogImageUrl ? { images: [{ url: ogImageUrl, width: 1200, height: 630, alt: 'DigitalGer Blog' }] } : {}),
    },
  };
  // Admin override байвал дарж бичнэ, байхгүй бол default хэвээр
  return applySeoOverride('/blog', defaultMeta);
}

const PAGE_SIZE = 9;

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const params = await searchParams;
  const tag = params.tag;

  const data = await blogApi
    .list({ page: 1, pageSize: PAGE_SIZE, tag })
    .catch(() => ({ items: [] as BlogPost[], total: 0, page: 1, pageSize: PAGE_SIZE }));

  const { items: initialPosts, total } = data;

  const blogListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'DigitalGer Нийтлэл',
    description: 'Дижитал бизнес, загвар хэрэглээ, мэргэжлийн зөвлөгөө',
    url: `${SITE_URL}/blog`,
    blogPost: initialPosts.map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      url: `${SITE_URL}/blog/${post.slug}`,
      datePublished: post.publishedAt ?? post.createdAt,
      ...(post.coverImageUrl ? { image: post.coverImageUrl } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogListJsonLd) }}
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-8">
          <PageHeader
            title="Нийтлэл"
            description="Дижитал бизнес, загвар хэрэглээ, мэргэжлийн зөвлөгөө"
            className="mb-0"
          />
          {total > 0 && (
            <span className="shrink-0 text-sm text-muted-foreground">Нийт {total} нийтлэл</span>
          )}
        </div>

        {initialPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="rounded-full bg-muted p-6 mb-4">
              <Tag className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-lg">Нийтлэл байхгүй байна</p>
            <p className="text-sm text-muted-foreground mt-1">Удахгүй шинэ нийтлэлүүд нэмэгдэнэ</p>
          </div>
        ) : (
          <BlogInfiniteList initialPosts={initialPosts} total={total} tag={tag} />
        )}
      </div>
    </>
  );
}
