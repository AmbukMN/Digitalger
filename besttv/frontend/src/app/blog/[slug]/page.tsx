import type { Metadata } from 'next';
import { BlogDetailClient } from './blog-detail-client';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const api = process.env.API_URL ?? 'http://localhost:4100';
    const res = await fetch(`${api}/api/blog/${slug}`, { next: { revalidate: 30 } });
    if (!res.ok) return {};
    const post = await res.json();
    return {
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.excerpt,
      openGraph: { images: post.coverUrl ? [post.coverUrl] : undefined },
    };
  } catch {
    return {};
  }
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BlogDetailClient slug={slug} />;
}
