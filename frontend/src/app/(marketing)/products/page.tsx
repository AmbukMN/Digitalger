export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProductGrid } from '@/components/products/product-grid';
import { ProductsFilter } from '@/components/products/products-filter';
import { productsApi, productTypesApi, categoriesApi } from '@/lib/api';
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

type SearchParams = {
  page?: string;
  category?: string;
  featured?: string;
  type?: string;
  types?: string;
  sortBy?: string;
  onSale?: string;
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const typesKey = params.types ?? params.type ?? '';
  const sortBy = (params.sortBy as 'newest' | 'discount' | 'rating' | 'downloads' | undefined) ?? undefined;
  const onSale = params.onSale === 'true' ? true : undefined;
  const featured = params.featured === 'true' ? true : undefined;

  const [productsData, productTypeConfigs, categories] = await Promise.all([
    productsApi.list({
      page,
      pageSize: 24,
      category: params.category,
      featured,
      types: params.types,
      type: params.type,
      sortBy,
      onSale,
    }).catch(() => ({ items: [] as ProductSummary[], total: 0, page: 1, pageSize: 24 })),
    productTypesApi.list().catch(() => []),
    categoriesApi.list().catch(() => []),
  ]);

  const products = productsData.items;
  const total = productsData.total;

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
  } else if (params.category) {
    const cat = categories.find((c) => c.slug === params.category);
    heading = cat
      ? { title: cat.name, desc: cat.description ?? `${cat.name} ангиллын бүтээгдэхүүнүүд` }
      : { title: 'Бүтээгдэхүүн', desc: 'Дижитал бүтээгдэхүүн' };
  } else {
    heading = { title: 'Бүтээгдэхүүн', desc: 'Файл, загвар, хичээл болон бусад дижитал бүтээгдэхүүн' };
  }

  const activeCount = [params.category, typesKey, sortBy, onSale, featured].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">{heading.title}</h1>
        <p className="mt-1 text-muted-foreground text-sm">{heading.desc}</p>
      </div>

      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24 rounded-2xl border border-border bg-card p-4 dark:bg-card">
            <Suspense>
              <ProductsFilter
                categories={categories}
                productTypes={productTypeConfigs}
                total={total}
              />
            </Suspense>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Mobile filter bar */}
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <p className="text-sm text-muted-foreground">{total.toLocaleString()} бүтээгдэхүүн</p>
            <Suspense>
              <ProductsFilter
                categories={categories}
                productTypes={productTypeConfigs}
                total={total}
              />
            </Suspense>
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-lg font-semibold">Бүтээгдэхүүн олдсонгүй</p>
              <p className="mt-1 text-sm text-muted-foreground">Шүүлтүүрийг өөрчилж дахин хайна уу</p>
            </div>
          ) : (
            <ProductGrid products={products} cols="three" />
          )}
        </div>
      </div>
    </div>
  );
}
