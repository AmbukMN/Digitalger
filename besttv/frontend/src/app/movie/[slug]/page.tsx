import type { Metadata } from 'next';
import { TitleDetailClient } from './title-detail-client';

const API_URL = process.env.API_URL ?? 'http://localhost:4100';

async function fetchTitle(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/titles/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = await fetchTitle(slug);
  if (!title) return { title: 'Контент олдсонгүй | BestTV' };

  const metaTitle = title.metaTitle || `${title.title} | BestTV`;
  const metaDescription = title.metaDescription || title.description?.slice(0, 160);

  return {
    title: metaTitle,
    description: metaDescription,
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      images: title.backdropUrl ? [{ url: title.backdropUrl, width: 1600, height: 900 }] : undefined,
      type: 'video.movie',
    },
    twitter: {
      card: 'summary_large_image',
      title: metaTitle,
      description: metaDescription,
      images: title.backdropUrl ? [title.backdropUrl] : undefined,
    },
  };
}

export default async function TitleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <TitleDetailClient slug={slug} />;
}
