import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { SERVER_API_URL } from '@/lib/server-api';
import { BlogDetailClient } from './blog-detail-client';
import { SITE_URL, stripSiteName, getSiteSeo } from '@/lib/seo';
import DetailSkeleton from './detail-skeleton';

interface BlogPost {
  title?: string;
  metaTitle?: string;
  metaDescription?: string;
  excerpt?: string;
  coverUrl?: string;
  publishedAt?: string;
}

/**
 * Нийтлэлийг СЕРВЕР талд татна.
 *
 * ⚠️⚠️ "ОЛДСОНГҮЙ" ба "СҮЛЖЭЭ УНАСАН" ХОЁРЫГ ЯЛГАНА.
 * Хоёулаа 404 болговол backend түр унахад БАЙГАА нийтлэл Google-ийн
 * индексээс хасагдана (сэргэхэд буцаж орох нь удаан).
 */
async function fetchPost(slug: string): Promise<{ post: BlogPost | null; missing: boolean }> {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/blog/${slug}`, { next: { revalidate: 30 } });
    if (res.status === 404) return { post: null, missing: true };
    if (!res.ok) return { post: null, missing: false };
    return { post: (await res.json()) as BlogPost, missing: false };
  } catch {
    /* Сүлжээний алдаа — 404 БИШ */
    return { post: null, missing: false };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  /* ⚠️ Зэрэг татна — SEO тохиргоо нь нийтлэлээс хамааралгүй */
  const [{ post, missing }, seo] = await Promise.all([fetchPost(slug), getSiteSeo()]);
  const siteName = seo?.siteName || 'BestTV';

  /**
   * ⚠️⚠️ 404-ЫГ `generateMetadata`-Д БАРИНА — page component
   * ДАНГААРАА ХАНГАЛТГҮЙ.
   *
   * БОДИТ ХЭМЖИЛТ (киноны хуудсанд): page-д `notFound()` нэмсэн ч
   * HTTP статус **200** хэвээр үлдсэн — `not-found.tsx` рендерлэгдсэн
   * МӨРТЛӨӨ. Шалтгаан: Next нь `generateMetadata`-г ЭХЛЭЭД
   * ажиллуулж хариуны толгойг илгээж эхэлдэг тул дараа нь page
   * доторх `notFound()` статусыг өөрчилж чадахгүй.
   *
   * ⚠️ `notFound()` нь EXCEPTION шиддэг тул `try` блок ДОТОР
   * дуудвал `catch` барьж аваад ХЭЗЭЭ Ч ажиллахгүй — тиймээс
   * `fetchPost` нь зөвхөн ТЭМДЭГЛЭЖ буцаадаг.
   */
  if (missing) notFound();
  if (!post) return {};

  /**
   * ⚠️ Өмнө нь openGraph-д ЗӨВХӨН images байсан — og:title / og:description /
   * og:url огт байгаагүй тул Facebook-д хуваалцахад гарчиг, тайлбар хоосон
   * гарч байв. Canonical ч байгаагүй.
   */
  /* ⚠️ `stripSiteName` — өмнөх regex нь зөвхөн `|` барьдаг байсан,
     `—` (em dash) барихгүй тул давхардал үлддэг байв */
  const title = stripSiteName(post.metaTitle, siteName) || stripSiteName(post.title, siteName) || '';
  const description = post.metaDescription || post.excerpt || `${title} — ${siteName} блог.`;
  const url = `${SITE_URL}/blog/${slug}`;
  /* ⚠️ Нийтлэлд cover зураггүй бол САЙТЫН админ og зураг руу унана —
     өмнө нь `null` үлдэж Facebook-д ЗУРАГГҮЙ хоосон линк гардаг байв */
  const image = post.coverUrl || seo?.ogImageUrl || `${SITE_URL}/opengraph-image`;

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
      ...(post.publishedAt ? { publishedTime: post.publishedAt } : {}),
      ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: title }] } : {}),
    },
    twitter: {
      /* ⚠️ Админы сонголтыг хүндэтгэнэ */
      card: (seo?.twitterCard as 'summary_large_image' | 'summary') || 'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  /**
   * ⚠️⚠️ 404-ыг ХОЁР ГАЗАРТ шалгана — метадата БОЛОН энд.
   *
   * БОДИТ ХЭМЖИЛТ: зөвхөн `generateMetadata`-д `notFound()` дуудахад
   * блог 200 хэвээр үлдсэн, харин кино (хоёуланд нь байсан) 404
   * болсон. Хоёр газар байх нь ЗАЙЛШГҮЙ — Next аль шатанд статусыг
   * бэхлэхийг баталгаагүй тул хоёуланд нь барина.
   *
   * ⚠️ `fetchPost` нь `revalidate: 30`-тай тул НЭГ л fetch явна
   * (метадата ба page ижил кэш хуваалцана).
   */
  const { missing } = await fetchPost(slug);
  if (missing) notFound();

  /* ⚠️ `Suspense` — өмнөх `loading.tsx`-ыг орлоно (404 статус
     ажиллахын тулд, дээрх skeleton файлын тайлбарыг үз) */
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <BlogDetailClient slug={slug} />
    </Suspense>
  );
}
