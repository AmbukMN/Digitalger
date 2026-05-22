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
  if (typesKey) {
    const typeValues = typesKey.split(',');
    if (typeValues.length === 1) {
      const found = productTypeConfigs.find((t) => t.value === typeValues[0]);
      heading = found
        ? { title: `${found.label}үүд`, desc: found.description ?? `${found.label} бүтээгдэхүүнүүд` }
        : { title: typeValues[0], desc: 'Дижитал бүтээгдэхүүн' };
    } else {
      const labels = typeValues.map((v) => productTypeConfigs.find((t) => t.value === v)?.label ?? v);
      heading = { title: labels.join(' & '), desc: 'Дижитал бүтээгдэхүүн' };
    }
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
