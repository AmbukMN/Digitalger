import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductGrid } from '@/components/products/product-grid';
import { categoriesApi, productsApi } from '@/lib/api';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const cat = await categoriesApi.bySlug(slug);
    return { title: cat.name, description: cat.description ?? undefined };
  } catch {
    return { title: 'Ангилал' };
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  let category: Awaited<ReturnType<typeof categoriesApi.bySlug>>;
  try {
    category = await categoriesApi.bySlug(slug);
  } catch {
    notFound();
  }

  let products: Awaited<ReturnType<typeof productsApi.list>>['items'] = [];
  try {
    const data = await productsApi.list({ category: slug, pageSize: 24 });
    products = data.items;
  } catch {
    products = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold">{category.name}</h1>
      {category.description && (
        <p className="mt-2 text-muted-foreground">{category.description}</p>
      )}
      <div className="mt-8">
        <ProductGrid products={products} />
      </div>
    </div>
  );
}
