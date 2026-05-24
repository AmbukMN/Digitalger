import type { Metadata } from 'next';
import { siteSettingsApi } from '@/lib/api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://digitalger.mn';
const BLOG_TITLE = 'Нийтлэл — DigitalGer';
const BLOG_DESC = 'Дижитал бизнес, загвар хэрэглээ, мэргэжлийн зөвлөгөө болон шинэ мэдлэг авах нийтлэлүүд.';

export async function generateMetadata(): Promise<Metadata> {
  let ogImageUrl: string | null = null;
  try {
    const s = await siteSettingsApi.getPublic();
    ogImageUrl = s.ogImageUrl ?? null;
  } catch { /* fallback */ }
  return {
    title: 'Нийтлэл',
    description: BLOG_DESC,
    alternates: { canonical: `${SITE_URL}/blog` },
    openGraph: {
      type: 'website',
      title: BLOG_TITLE,
      description: BLOG_DESC,
      url: `${SITE_URL}/blog`,
      ...(ogImageUrl ? { images: [{ url: ogImageUrl, width: 1200, height: 630, alt: BLOG_TITLE }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: BLOG_TITLE,
      description: BLOG_DESC,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  };
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
