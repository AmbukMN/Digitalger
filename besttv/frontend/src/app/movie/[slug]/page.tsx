import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { SERVER_API_URL } from '@/lib/server-api';
import { TitleDetailClient } from './title-detail-client';
import type { TitleDetail } from '@/lib/queries';
import { SITE_URL, jsonLd, stripSiteName, getSiteSeo } from '@/lib/seo';
import DetailSkeleton from './detail-skeleton';


/**
 * ⚠️⚠️ "ОЛДСОНГҮЙ" ба "СҮЛЖЭЭ УНАСАН" ХОЁРЫГ ЯЛГАНА.
 *
 * Хоёулаа `null` буцаавал backend түр унахад БАЙГАА кино 404 болж,
 * Google түүнийг индексээс ХАСНА (сэргэхэд буцаж орох нь удаан).
 *   `notFound: true`  → жинхэнэ 404 (кино устсан/буруу slug)
 *   `notFound: false` → түр алдаа, хуудсыг рендерлээд client дахин оролдоно
 */
async function fetchTitle(slug: string): Promise<{ data: unknown; notFound: boolean }> {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/titles/${slug}`, { next: { revalidate: 60 } });
    if (res.status === 404) return { data: null, notFound: true };
    if (!res.ok) return { data: null, notFound: false };
    return { data: await res.json(), notFound: false };
  } catch {
    /* Сүлжээний алдаа — 404 БИШ */
    return { data: null, notFound: false };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  /* ⚠️ Зэрэг татна — SEO тохиргоо нь киноноос хамааралгүй */
  const [{ data, notFound: missing }, seo] = await Promise.all([fetchTitle(slug), getSiteSeo()]);
  const title = data as Record<string, any> | null;
  const siteName = seo?.siteName || 'BestTV';

  /**
   * ⚠️⚠️ `generateMetadata` ДОТОР Ч `notFound()` — page component
   * ДАНГААРАА хангалтгүй байв.
   *
   * БОДИТ ХЭМЖИЛТ: page-д `notFound()` нэмсэн ч HTTP статус **200**
   * хэвээр үлдсэн (`not-found.tsx` рендерлэгдсэн МӨРТЛӨӨ). Шалтгаан:
   * Next нь `generateMetadata`-г ЭХЛЭЭД ажиллуулж хариуны толгойг
   * илгээж эхэлдэг — дараа нь page доторх `notFound()` статусыг
   * өөрчилж чадахгүй (streaming эхэлсэн).
   *
   * Метадата шатанд дуудвал толгой илгээхээс ӨМНӨ шийдэгдэнэ.
   */
  if (missing) notFound();
  if (!title) return { title: 'Контент олдсонгүй' };

  /**
   * ⚠️ "| BestTV"-г ЭНД НЭМЭХГҮЙ — root layout-ийн title.template нь
   * автоматаар нэмдэг. Өмнө нь энд гараар нэмсэн тул "Шидтэний сургууль |
   * BestTV | BestTV" гэж ДАВХАРДАЖ байсан.
   */
  /* ⚠️ `stripSiteName` — `metaTitle`-д «— BestTV» бий, root
     layout-ийн template нь «| BestTV» нэмнэ → ДАВХАРДАНА
     (131/131 кинод бодитоор харагдсан) */
  const metaTitle = stripSiteName(title.metaTitle, siteName) || title.title;
  const metaDescription =
    title.metaDescription ||
    title.description?.slice(0, 160) ||
    `${title.title} — ${siteName} дээр онлайнаар үзээрэй.`;

  /* OG зураг эрэмбэ: киноны backdrop → постер → САЙТЫН админ og зураг →
     кодын динамик зураг.
     ⚠️ Өмнө нь админы `ogImageUrl`-ыг АЛГАСААД шууд кодын зураг руу
        унадаг байв — админ тохируулсан зураг хэрэглэгддэггүй байсан. */
  const ogImage =
    title.backdropUrl || title.posterUrl || seo?.ogImageUrl || `${SITE_URL}/opengraph-image`;
  const url = `${SITE_URL}/movie/${slug}`;

  /**
   * ⚠️⚠️ 18+ КИНО — ЗААВАЛ `noindex`.
   *
   * `/adult` жагсаалтын хуудас нь `robots: { index: false }`-тэй
   * боловч КИНОНЫ ДЭЛГЭРЭНГҮЙ хуудас (`/movie/<slug>`) нь ТУСДАА
   * зам — Google түүнийг чөлөөтэй индексжүүлдэг байв.
   *
   * ⚠️ Sitemap-аас хассан нь ГАНЦААРАА хангалтгүй: гадны холбоос,
   * дотоод линк, эсвэл хуучин индексээр crawler олж болно. Хуудас
   * өөрөө хэлэх ёстой.
   */
  const isAdult = Array.isArray(title.genres)
    && title.genres.some((g: { isAdult?: boolean }) => g?.isAdult);

  return {
    title: metaTitle,
    description: metaDescription,
    alternates: { canonical: url },
    ...(isAdult ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      url,
      siteName,
      locale: 'mn_MN',
      images: ogImage ? [{ url: ogImage, width: 1600, height: 900, alt: title.title }] : undefined,
      // Цуврал бол video.tv_show — FB/Google зөв ангилна
      type: title.type === 'SERIES' ? 'video.tv_show' : 'video.movie',
      ...(title.year ? { releaseDate: `${title.year}-01-01` } : {}),
    },
    twitter: {
      /* ⚠️ Админы сонголтыг хүндэтгэнэ — өмнө нь ХАТУУ бичсэн байв */
      card: (seo?.twitterCard as 'summary_large_image' | 'summary') || 'summary_large_image',
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
  const { data, notFound: missing } = await fetchTitle(slug);
  const title = data as Record<string, any> | null;

  /**
   * ⚠️⚠️ БАЙХГҮЙ КИНО — ЗААВАЛ 404.
   *
   * БОДИТ АЛДАА: `title` нь `null` байхад ч хуудас HTTP **200**
   * буцаадаг байв. Үр дагавар:
   *   • Google эвдэрсэн холбоосыг ИНДЕКСЖҮҮЛНЭ (soft 404) —
   *     хайлтын үр дүнд хоосон хуудас гарч чанар буурна
   *   • Хэрэглэгч буруу линк дарахад "олдсонгүй" гэсэн мессеж л
   *     харна, browser нь алдаа гэж мэдэхгүй
   *   • Устгасан кино руу заасан хуучин холбоос мөнхөд 200 үлдэнэ
   *
   * ⚠️ `notFound()` нь `app/not-found.tsx`-ыг 404 статустай
   * рендерлэнэ — SEO ба хэрэглэгч ХОЁУЛАНД зөв.
   */
  if (missing) notFound();

  /**
   * Movie / TVSeries structured data — Google хайлтад од (үнэлгээ), жил,
   * найруулагч, жүжигчид зэргийг rich result болгож харуулна.
   * Мөн Breadcrumb — хайлтын үр дүнд зам харагдана.
   */
  /**
   * ⚠️ 18+ эсэхийг ЖАНРААС тооцно — `Title` дээр `isAdult` талбар
   * БАЙХГҮЙ (`generateMetadata` дотор ч ижил аргаар бодсон, мөр 89).
   */
  const ldIsAdult =
    !!title &&
    Array.isArray(title.genres) &&
    title.genres.some((g: { isAdult?: boolean }) => g?.isAdult);

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
          /**
           * ⚠️⚠️ ЦУВРАЛЫН БҮТЭЦ — Google-ийн TVSeries rich snippet-д
           * улирал/ангийн тоо ЗААВАЛ (эс бөгөөс энгийн холбоос шиг
           * харагдана).
           *
           * ⚠️ Зөвхөн БЭЛЭН (`playable`) ангийг тоолно — 10 анги
           * зарлаад 5 нь л тоглодог бол Google-д худал мэдээлэл
           * өгөх болно.
           */
          ...(title.type === 'SERIES' && Array.isArray(title.seasons)
            ? (() => {
                const seasons = title.seasons as { episodes?: { playable?: boolean }[] }[];
                const epCount = seasons.reduce(
                  (n, s) => n + (s.episodes ?? []).filter((e) => e.playable).length,
                  0,
                );
                return {
                  numberOfSeasons: seasons.length,
                  ...(epCount > 0 ? { numberOfEpisodes: epCount } : {}),
                };
              })()
            : {}),
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
        /**
         * ⚠️⚠️ VideoObject — Google-ийн ВИДЕО таб / video rich result-д
         * орох ЗААВАЛ шаардлага. `Movie`/`TVSeries` schema ДАНГААРАА
         * хангалтгүй (тэр нь зөвхөн бүтээлийн мэдээлэл, видео БИШ).
         *
         * Стриминг платформын хувьд хамгийн өндөр өгөөжтэй schema —
         * хайлтын үр дүнд thumbnail + үргэлжлэх хугацаа харагдана.
         *
         * ⚠️ `thumbnailUrl` ба `uploadDate` нь Google-ийн ЗААВАЛ талбар;
         *    аль нэг нь дутвал schema бүхэлдээ үл тоомсорлогдоно.
         */
        ...(title.posterUrl || title.backdropUrl
          ? [
              {
                '@context': 'https://schema.org',
                '@type': 'VideoObject',
                name: title.title,
                description:
                  title.description || `${title.title} — BestTV дээр онлайнаар үзэх`,
                thumbnailUrl: [title.posterUrl, title.backdropUrl].filter(Boolean),
                uploadDate: title.createdAt ?? new Date().toISOString(),
                ...(title.duration ? { duration: `PT${title.duration}M` } : {}),
                embedUrl: `${SITE_URL}/watch/${slug}`,
                contentUrl: `${SITE_URL}/watch/${slug}`,
                inLanguage: 'mn',
                isFamilyFriendly: !ldIsAdult,
              },
            ]
          : []),
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
      {/*
        ⚠️⚠️ `Suspense` — өмнөх `loading.tsx`-ыг ОРЛОНО.
        `loading.tsx` нь route түвшинд STREAMING идэвхжүүлдэг тул
        толгой эрт илгээгдэж `notFound()` статус тавьж чаддаггүй байв
        (байхгүй кино 200 буцааж Google индексжүүлдэг). Энд бол 404
        аль хэдийн шийдэгдсэний ДАРАА streaming эхэлнэ — skeleton
        хэвээр, статус ч зөв.
      */}
      <Suspense fallback={<DetailSkeleton />}>
        <TitleDetailClient slug={slug} initial={(title as TitleDetail | null) ?? undefined} />
      </Suspense>
    </>
  );
}
