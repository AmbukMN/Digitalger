import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CatalogGrid } from '@/components/catalog-grid';
import { buildPageMetadata } from '@/lib/seo';

// ⚠️ Админ панелаас (SEO → Хуудасны тохиргоо) дарж бичих боломжтой
export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    path: '/series',
    title: 'Олон ангит',
    description: 'Хамгийн сүүлийн үеийн шилдэг олон ангит кинонууд — BestTV дээр үзээрэй.',
  });
}

export default function SeriesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background pt-24" />}>
      <CatalogGrid
        type="SERIES"
        heading="Олон ангит"
        subheading="Хамгийн сүүлийн үеийн шилдэг олон ангит кинонууд"
      />
    </Suspense>
  );
}
