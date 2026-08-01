import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CatalogGrid } from '@/components/catalog-grid';

export const metadata: Metadata = {
  title: 'Бүх Кинонууд',
  description: 'Таны үзэх дуртай бүх төрлийн нэг ангит кинонууд — BestTV дээр эрэлттэй, шинэ кино бүгд.',
};

export default function MoviesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background pt-24" />}>
      <CatalogGrid
        type="MOVIE"
        heading="Бүх Кинонууд"
        subheading="Таны үзэх дуртай бүх төрлийн нэг ангит кинонууд"
      />
    </Suspense>
  );
}
