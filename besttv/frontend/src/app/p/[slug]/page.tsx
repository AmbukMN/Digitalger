import type { Metadata } from 'next';
import DOMPurify from 'isomorphic-dompurify';
import { SERVER_API_URL } from '@/lib/server-api';
import { notFound } from 'next/navigation';
import { SITE_URL, stripSiteName, getSiteSeo } from '@/lib/seo';

interface PageData {
  slug: string;
  title: string;
  content: string;
  metaTitle: string | null;
  metaDescription: string | null;
  /** Админ оруулсан OG зураг — backend `ogImageKey`-ээс шийдсэн бүтэн URL */
  ogImageUrl?: string | null;
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
  /* ⚠️ Зэрэг татна — SEO тохиргоо нь хуудсаас хамааралгүй */
  const [page, seo] = await Promise.all([getPage(slug), getSiteSeo()]);
  if (!page) return {};
  const siteName = seo?.siteName || 'BestTV';

  /**
   * ⚠️ DB-д metaTitle нь "... | BestTV" гэж хадгалагдсан бол root layout-ийн
   * template дахин нэмж ДАВХАРДАНА. Тиймээс төгсгөлийн сайтын нэрийг хасна.
   *
   * ⚠️ Өмнө нь энд ӨӨРИЙН regex (`/\s*\|\s*BestTV\s*$/`) байсан нь зөвхөн
   * `|` барьдаг — «X — BestTV» хэлбэрийг АЛДАЖ давхардуулдаг байв. Одоо
   * НЭГ ЭХ СУРВАЛЖ `stripSiteName` (админы сайтын нэрийг ч мэднэ).
   */
  const title = stripSiteName(page.metaTitle, siteName) || page.title;
  const description = page.metaDescription || `${title} — ${siteName}.`;
  const url = `${SITE_URL}/p/${slug}`;
  /* ⚠️ Хуудасны өөрийн OG зураг (`ogImageKey`) — backend буцаадаг байсан ч
     ОГТ АШИГЛАГДААГҮЙ. Байхгүй бол сайтын админ зураг руу унана. */
  const image = page.ogImageUrl || seo?.ogImageUrl || `${SITE_URL}/opengraph-image`;

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
      siteName,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: (seo?.twitterCard as 'summary_large_image' | 'summary') || 'summary_large_image',
      title,
      description,
      images: [image],
    },
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
