export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { ProductGrid } from '@/components/products/product-grid';
import { productsApi } from '@/lib/api';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Бүтээгдэхүүн',
  description: 'Бүх дижитал бүтээгдэхүүн — файл, загвар, хичээл.',
  alternates: { canonical: `${SITE_URL}/products` },
  openGraph: {
    title: 'Бүтээгдэхүүн',
    description: 'Бүх дижитал бүтээгдэхүүн — файл, загвар, хичээл.',
    url: `${SITE_URL}/products`,
  },
};

const TYPE_HEADINGS: Record<string, { title: string; desc: string }> = {
  'FILE,TEMPLATE': { title: 'Файл & Загварууд', desc: 'Бэлэн файл, загвар болон бусад татаж авах дижитал контент' },
  'LESSON,BUNDLE': { title: 'Хичээлүүд', desc: 'Видео хичээл болон багц хичээлүүд' },
  FILE: { title: 'Файлууд', desc: 'Татаж авах дижитал файлууд' },
  TEMPLATE: { title: 'Загварууд', desc: 'Бэлэн загвар болон шаблонууд' },
  LESSON: { title: 'Хичээлүүд', desc: 'Видео болон дижитал хичээлүүд' },
  BUNDLE: { title: 'Багц хичээлүүд', desc: 'Хичээлийн цуглуулга болон багцууд' },
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string; featured?: string; type?: string; types?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const typesKey = params.types ?? params.type ?? '';
  const heading = TYPE_HEADINGS[typesKey] ?? {
    title: 'Бүтээгдэхүүн',
    desc: 'Файл, загвар, хичээл болон бусад дижитал бүтээгдэхүүн',
  };

  let products: Awaited<ReturnType<typeof productsApi.list>>['items'] = [];
  try {
    const data = await productsApi.list({
      page,
      pageSize: 24,
      category: params.category,
      featured: params.featured === 'true' ? true : undefined,
      types: params.types,
      type: params.type,
    });
    products = data.items;
  } catch {
    products = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold">{heading.title}</h1>
      <p className="mt-2 text-muted-foreground">{heading.desc}</p>
      <div className="mt-8">
        <ProductGrid products={products} />
      </div>
    </div>
  );
}
