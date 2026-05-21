export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { ProductGrid } from '@/components/products/product-grid';
import { productsApi, productTypesApi } from '@/lib/api';
import { SITE_URL } from '@/lib/constants';
import type { ProductSummary } from '@/types/api';

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

const COMPOUND_HEADINGS: Record<string, { title: string; desc: string }> = {
  'FILE,TEMPLATE': { title: 'Файл & Загварууд', desc: 'Бэлэн файл, загвар болон бусад татаж авах дижитал контент' },
  'FILE,TEMPLATE,DOCUMENT,BUNDLE': { title: 'Дижитал бүтээгдэхүүн', desc: 'Файл, загвар, баримт болон багц — татаж авах дижитал контент' },
  'LESSON,BUNDLE': { title: 'Хичээлүүд', desc: 'Видео хичээл болон багц хичээлүүд' },
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string; featured?: string; type?: string; types?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const typesKey = params.types ?? params.type ?? '';

  const [productsData, productTypeConfigs] = await Promise.all([
    productsApi.list({
      page,
      pageSize: 24,
      category: params.category,
      featured: params.featured === 'true' ? true : undefined,
      types: params.types,
      type: params.type,
    }).catch(() => ({ items: [] as ProductSummary[], total: 0, page: 1, pageSize: 24 })),
    productTypesApi.list().catch(() => []),
  ]);

  const products = productsData.items;

  let heading: { title: string; desc: string };
  if (COMPOUND_HEADINGS[typesKey]) {
    heading = COMPOUND_HEADINGS[typesKey];
  } else if (typesKey) {
    const found = productTypeConfigs.find((t) => t.value === typesKey);
    heading = found
      ? { title: `${found.label}үүд`, desc: found.description ?? `${found.label} бүтээгдэхүүнүүд` }
      : { title: 'Бүтээгдэхүүн', desc: 'Файл, загвар, хичээл болон бусад дижитал бүтээгдэхүүн' };
  } else {
    heading = { title: 'Бүтээгдэхүүн', desc: 'Файл, загвар, хичээл болон бусад дижитал бүтээгдэхүүн' };
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
