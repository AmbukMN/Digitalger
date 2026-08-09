import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SERVER_API_URL } from '@/lib/server-api';
import { BlogDetailClient } from './blog-detail-client';
import { SITE_URL } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const api = SERVER_API_URL;
    const res = await fetch(`${api}/api/blog/${slug}`, { next: { revalidate: 30 } });
    if (!res.ok) return {};
    const post = await res.json();

    /**
     * ⚠️ Өмнө нь openGraph-д ЗӨВХӨН images байсан — og:title / og:description /
     * og:url огт байгаагүй тул Facebook-д хуваалцахад гарчиг, тайлбар хоосон
     * гарч байв. Canonical ч байгаагүй.
     */
    const title = (post.metaTitle || post.title || '').replace(/\s*\|\s*BestTV\s*$/i, '');
    const description = post.metaDescription || post.excerpt || `${title} — BestTV блог.`;
    const url = `${SITE_URL}/blog/${slug}`;
    const image = post.coverUrl || null;

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
        siteName: 'BestTV',
        ...(post.publishedAt ? { publishedTime: post.publishedAt } : {}),
        ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: title }] } : {}),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return {};
  }
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  /**
   * ⚠️⚠️ БАЙХГҮЙ НИЙТЛЭЛ — ЗААВАЛ 404 (киноны хуудастай ИЖИЛ).
   *
   * Өмнө нь хуудас шууд client компонент рендерлэдэг тул устсан/
   * буруу slug ч HTTP **200** буцаадаг байв: Google эвдэрсэн
   * холбоосыг индексжүүлж (soft 404), хэрэглэгч зөвхөн "олдсонгүй"
   * гэсэн текст л хардаг.
   *
   * ⚠️ `revalidate: 30` — `generateMetadata`-тай ИЖИЛ утга тул
   * Next нь НЭГ л fetch хийнэ (давхар дуудалт үүсэхгүй).
   */
  /* ⚠️⚠️ `notFound()` нь EXCEPTION шиддэг — `try` дотор дуудвал
     доорх `catch` барьж аваад 404 ХЭЗЭЭ Ч гарахгүй. Тиймээс fetch-ийг
     л try дотор, шийдвэрийг ГАДНА нь. */
  let missing = false;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/blog/${slug}`, { next: { revalidate: 30 } });
    /* ⚠️ ЗӨВХӨН 404 — 500/502 нь backend түр унасан гэсэн үг тул
       БАЙГАА нийтлэлийг Google-ийн индексээс хасах ёсгүй */
    missing = res.status === 404;
  } catch {
    /* ⚠️ Сүлжээний алдааг 404 болгохгүй — түр саатал бол client талд
       дахин оролдоно (жинхэнэ "олдсонгүй"-ээс ЯЛГААТАЙ) */
  }
  if (missing) notFound();

  return <BlogDetailClient slug={slug} />;
}
