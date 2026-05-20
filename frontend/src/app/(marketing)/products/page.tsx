export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { ProductGrid } from '@/components/products/product-grid';
import { productsApi } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Бүтээгдэхүүн',
  description: 'Бүх дижитал бүтээгдэхүүн — файл, загвар, курс.',
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string; featured?: string; type?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;

  let products: Awaited<ReturnType<typeof productsApi.list>>['items'] = [];
  try {
    const data = await productsApi.list({
      page,
      pageSize: 24,
      category: params.category,
      featured: params.featured === 'true' ? true : undefined,
      type: params.type,
    });
    products = data.items;
  } catch {
    products = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold">Бүтээгдэхүүн</h1>
      <p className="mt-2 text-muted-foreground">
        Файл, загвар, курс болон бусад дижитал бүтээгдэхүүн
      </p>
      <div className="mt-8">
        <ProductGrid products={products} />
      </div>
    </div>
  );
}
