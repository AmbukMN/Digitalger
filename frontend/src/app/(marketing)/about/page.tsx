export const revalidate = 300;

import type { Metadata } from 'next';
import { API_URL, SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Бидний тухай',
  description: 'DigitalGer — Монголын хамгийн том дижитал бүтээгдэхүүний зах зээл.',
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: 'Бидний тухай | DigitalGer',
    description: 'DigitalGer — Монголын хамгийн том дижитал бүтээгдэхүүний зах зээл.',
    url: `${SITE_URL}/about`,
  },
};

const DEFAULT_CONTENT = `
<h2>DigitalGer-ийн тухай</h2>
<p>DigitalGer нь Монголын хамгийн том дижитал бүтээгдэхүүний зах зээл бөгөөд 2023 онд үүсгэн байгуулагдсан. Бид дижитал файл, загвар, хичээл болон бусад бүтээгдэхүүнийг нэг дороос татаж авах боломжийг олгодог.</p>
<h2>Манай зорилго</h2>
<p>Монгол хэрэглэгчдэд чанартай дижитал контентийг хялбар, аюулгүй байдлаар хүргэх замаар дижитал эдийн засгийг хөгжүүлэхэд хувь нэмэр оруулах.</p>
<h2>Холбоо барих</h2>
<p>И-мэйл: info@digitalger.mn</p>
`;

async function getAboutPage() {
  try {
    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/api/pages/about`, {
      next: { revalidate: 300 },
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
  const title = page?.title ?? 'Бидний тухай';
  const content = page?.content ?? DEFAULT_CONTENT;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{title}</h1>
        <div className="mt-2 h-1 w-16 rounded-full bg-primary" />
      </div>
      <div
        className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-bold prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}
