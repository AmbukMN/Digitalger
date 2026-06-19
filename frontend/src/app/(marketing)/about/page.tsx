import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/page-metadata';
import { PageHero } from '@/components/ui/page-hero';
import { sanitizeHtml } from '@/lib/safe-html';

export const revalidate = 60;

interface AboutPage {
  title: string;
  content: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  ogImageUrl?: string | null;
}

export async function generateMetadata(): Promise<Metadata> {
  // SEO-г page-аас, дутуу бол SiteSettings-ээс, эцэст нь hardcode fallback
  return buildPageMetadata(
    'about',
    'Бидний тухай | DigitalGer',
    'DigitalGer — Монголын анхны дижитал бүтээгдэхүүний зах зээл. Бизнес загвар, сургалт, бэлэн файл, төсөл — нэг дороос татаж авна.',
  );
}

async function getAboutPage(): Promise<AboutPage | null> {
  try {
    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/api/pages/about`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as AboutPage | null;
  } catch {
    return null;
  }
}

export default async function AboutPage() {
  const page = await getAboutPage();
  if (!page) notFound();

  return (
    <>
      <PageHero title={page.title} breadcrumb="Бид" />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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
    </>
  );
}
