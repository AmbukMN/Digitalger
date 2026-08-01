import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface PageData {
  slug: string;
  title: string;
  content: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

async function getPage(slug: string): Promise<PageData | null> {
  try {
    const api = process.env.API_URL ?? 'http://localhost:4100';
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
  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || undefined,
  };
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-28 md:px-8">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-black tracking-tight text-white md:text-4xl">{page.title}</h1>
        <div
          className="static-page mt-8 text-white/75"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      </article>
    </main>
  );
}
