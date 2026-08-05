import type { Metadata } from 'next';
import { SERVER_API_URL } from '@/lib/server-api';
import { BlogDetailClient } from './blog-detail-client';
import { SITE_URL } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const api = SERVER_API_URL;
    const res = await fetch(`${api}/api/blog/${slug}`, { next: { revalidate: 30 } });
    if (!res.ok) return {};
    const post = await res.json();

    /**
     * ⚠️ Өмнө нь openGraph-д ЗӨВХӨН images байсан — og:title / og:description /
     * og:url огт байгаагүй тул Facebook-д хуваалцахад гарчиг, тайлбар хоосон
     * гарч байв. Canonical ч байгаагүй.
     */
    const title = (post.metaTitle || post.title || '').replace(/\s*\|\s*BestTV\s*$/i, '');
    const description = post.metaDescription || post.excerpt || `${title} — BestTV блог.`;
    const url = `${SITE_URL}/blog/${slug}`;
    const image = post.coverUrl || null;

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        type: 'article',
        locale: 'mn_MN',
        siteName: 'BestTV',
        ...(post.publishedAt ? { publishedTime: post.publishedAt } : {}),
        ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: title }] } : {}),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return {};
  }
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BlogDetailClient slug={slug} />;
}
