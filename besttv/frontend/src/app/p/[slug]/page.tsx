import type { Metadata } from 'next';
import DOMPurify from 'isomorphic-dompurify';
import { SERVER_API_URL } from '@/lib/server-api';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/lib/seo';

interface PageData {
  slug: string;
  title: string;
  content: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

async function getPage(slug: string): Promise<PageData | null> {
  try {
    const api = SERVER_API_URL;
    // 30с — админ засвар хийсний дараа хурдан шинэчлэгдэнэ
    const res = await fetch(`${api}/api/pages/${slug}`, { next: { revalidate: 30 } });
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
  const page = await getPage(slug);
  if (!page) return {};

  /**
   * ⚠️ DB-д metaTitle нь "... | BestTV" гэж хадгалагдсан бол root layout-ийн
   * template дахин нэмж ДАВХАРДАНА. Тиймээс төгсгөлийн сайтын нэрийг хасна.
   */
  const raw = page.metaTitle || page.title;
  const title = raw.replace(/\s*\|\s*BestTV\s*$/i, '');
  const description = page.metaDescription || `${title} — BestTV.`;
  const url = `${SITE_URL}/p/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'article', locale: 'mn_MN' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-28 md:px-8">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-black tracking-tight text-foreground md:text-4xl">{page.title}</h1>
        <div
          className="static-page mt-8 text-foreground/75"
          /* ⚠️ SANITIZE ЗААВАЛ — контент нь админ/staff-аас ирдэг тул
              бүрэн итгэмжлэгдэхгүй. Скрипт/onerror зэргийг DOMPurify
              цэвэрлэнэ (XSS). Зөвшөөрөгдсөн таг/атрибут л үлдэнэ. */
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content) }}
        />
      </article>
    </main>
  );
}
