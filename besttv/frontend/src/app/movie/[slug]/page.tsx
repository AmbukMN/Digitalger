import type { Metadata } from 'next';
import { SERVER_API_URL } from '@/lib/server-api';
import { TitleDetailClient } from './title-detail-client';
import { SITE_URL, jsonLd } from '@/lib/seo';


async function fetchTitle(slug: string) {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/titles/${slug}`, { next: { revalidate: 60 } });
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
  const title = await fetchTitle(slug);
  if (!title) return { title: 'Контент олдсонгүй' };

  /**
   * ⚠️ "| BestTV"-г ЭНД НЭМЭХГҮЙ — root layout-ийн title.template нь
   * автоматаар нэмдэг. Өмнө нь энд гараар нэмсэн тул "Шидтэний сургууль |
   * BestTV | BestTV" гэж ДАВХАРДАЖ байсан.
   */
  const metaTitle = title.metaTitle || title.title;
  const metaDescription =
    title.metaDescription ||
    title.description?.slice(0, 160) ||
    `${title.title} — BestTV дээр онлайнаар үзээрэй.`;

  // OG зураг: backdrop → poster → сайтын анхдагч (хоосон гарахаас сэргийлнэ)
  const ogImage = title.backdropUrl || title.posterUrl || `${SITE_URL}/opengraph-image`;
  const url = `${SITE_URL}/movie/${slug}`;

  return {
    title: metaTitle,
    description: metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      url,
      siteName: 'BestTV',
      locale: 'mn_MN',
      images: ogImage ? [{ url: ogImage, width: 1600, height: 900, alt: title.title }] : undefined,
      // Цуврал бол video.tv_show — FB/Google зөв ангилна
      type: title.type === 'SERIES' ? 'video.tv_show' : 'video.movie',
      ...(title.year ? { releaseDate: `${title.year}-01-01` } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: metaTitle,
      description: metaDescription,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function TitleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const title = await fetchTitle(slug);

  /**
   * Movie / TVSeries structured data — Google хайлтад од (үнэлгээ), жил,
   * найруулагч, жүжигчид зэргийг rich result болгож харуулна.
   * Мөн Breadcrumb — хайлтын үр дүнд зам харагдана.
   */
  const ld = title
    ? [
        {
          '@context': 'https://schema.org',
          '@type': title.type === 'SERIES' ? 'TVSeries' : 'Movie',
          name: title.title,
          url: `${SITE_URL}/movie/${slug}`,
          ...(title.description ? { description: title.description } : {}),
          ...(title.posterUrl || title.backdropUrl
            ? { image: title.posterUrl || title.backdropUrl }
            : {}),
          ...(title.year ? { datePublished: String(title.year) } : {}),
          ...(title.duration ? { duration: `PT${title.duration}M` } : {}),
          inLanguage: 'mn',
          ...(title.genres?.length
            ? { genre: title.genres.map((g: { genre?: { name?: string }; name?: string }) => g.genre?.name ?? g.name).filter(Boolean) }
            : {}),
          ...(title.director ? { director: { '@type': 'Person', name: title.director } } : {}),
          ...(title.cast?.length
            ? {
                actor: title.cast
                  .slice(0, 10)
                  .map((c: { name?: string; person?: { name?: string } }) => ({
                    '@type': 'Person',
                    name: c.name ?? c.person?.name,
                  }))
                  .filter((a: { name?: string }) => a.name),
              }
            : {}),
          // ⚠️ Үнэлгээ 0 бол ОРУУЛАХГҮЙ — Google хоосон rating-ыг алдаа гэж үзнэ
          ...(title.rating && title.rating > 0
            ? {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: title.rating,
                  bestRating: 10,
                  ratingCount: Math.max(title.ratingCount ?? 1, 1),
                },
              }
            : {}),
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Нүүр', item: SITE_URL },
            {
              /**
               * ⚠️ Каталог НЭГДСЭН — "Кино" бол ерөнхий нэршил (нэг ангит +
               * олон ангит). Өмнө нь SERIES бол `/series` руу зааж байсан
               * нь одоо redirect үүсгэх тул SEO-д муу.
               */
              '@type': 'ListItem',
              position: 2,
              name: 'Кино',
              item: `${SITE_URL}/movies`,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: title.title,
              item: `${SITE_URL}/movie/${slug}`,
            },
          ],
        },
      ]
    : null;

  return (
    <>
      {ld && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      )}
      <TitleDetailClient slug={slug} />
    </>
  );
}
