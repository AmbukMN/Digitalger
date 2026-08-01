import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CatalogGrid } from '@/components/catalog-grid';

export const metadata: Metadata = {
  title: 'Олон ангит',
  description: 'Хамгийн сүүлийн үеийн шилдэг олон ангит кинонууд — BestTV дээр үзээрэй.',
};

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
