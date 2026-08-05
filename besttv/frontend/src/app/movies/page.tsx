import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CatalogGrid } from '@/components/catalog-grid';
import { buildPageMetadata } from '@/lib/seo';

// ⚠️ Админ панелаас (SEO → Хуудасны тохиргоо) дарж бичих боломжтой
export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    path: '/movies',
    title: 'Бүх Кинонууд',
    description:
      'Таны үзэх дуртай бүх төрлийн кино — BestTV дээр эрэлттэй, шинэ бүгд.',
  });
}

/**
 * ⚠️⚠️ "КИНО" бол ЕРӨНХИЙ НЭРШИЛ — нэг ангит БОЛОН олон ангит ХОЁУЛАА
 * энд харагдана. Хэрэглэгчийн талд MOVIE/SERIES гэж ЯЛГАХГҮЙ (тэр нь
 * зөвхөн админ талын дотоод хэрэгсэл — контент оруулах хэлбэрийг заана).
 * Ангилал = ЖАНР.
 */
export default function MoviesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background pt-24" />}>
      <CatalogGrid
        heading="Бүх Кинонууд"
        subheading="Жанраар шүүж, өөрт таарсан киногоо олоорой"
      />
    </Suspense>
  );
}
