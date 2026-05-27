import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { siteSettingsApi } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { sanitizeHtml } from '@/lib/safe-html';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  let ogImageUrl: string | null = null;
  try {
    const s = await siteSettingsApi.getPublic();
    ogImageUrl = s.ogImageUrl ?? null;
  } catch { /* fallback */ }
  const title = 'Бидний тухай | DigitalGer';
  const description = 'DigitalGer — Монголын анхны дижитал бүтээгдэхүүний зах зээл. Бизнес загвар, сургалт, бэлэн файл, төсөл — нэг дороос татаж авна.';
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/about` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/about`,
      ...(ogImageUrl ? { images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  };
}

async function getAboutPage() {
  try {
    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/api/pages/about`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as { title: string; content: string } | null;
  } catch {
    return null;
  }
}

export default async function AboutPage() {
  const page = await getAboutPage();
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={page.title} />
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 lg:p-10 shadow-sm">
        <div
          className="prose prose-base max-w-none font-sans text-muted-foreground
            prose-headings:font-sans prose-headings:text-foreground prose-headings:font-bold
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-li:marker:text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }}
        />
      </div>
    </div>
  );
}
