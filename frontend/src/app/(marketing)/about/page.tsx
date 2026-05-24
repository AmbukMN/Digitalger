import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { PageHeader } from '@/components/ui/page-header';
import { sanitizeHtml } from '@/lib/safe-html';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Бидний тухай | DigitalGer',
  description: 'DigitalGer — Монголын анхны дижитал бүтээгдэхүүний зах зээл. Бизнес загвар, сургалт, бэлэн файл, төсөл — нэг дороос татаж авна.',
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: 'Бидний тухай | DigitalGer',
    description: 'DigitalGer — Монголын анхны дижитал бүтээгдэхүүний зах зээл. Бизнес загвар, сургалт, бэлэн файл, төсөл — нэг дороос татаж авна.',
    url: `${SITE_URL}/about`,
  },
};

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
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader title={page.title} />
      <div
        className="prose prose-base max-w-none dark:prose-invert prose-headings:font-bold prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }}
      />
    </div>
  );
}
