import { Button } from '@digitalger/shared/ui';
import Link from 'next/link';
import { ProductGrid } from '@/components/products/product-grid';
import { productsApi } from '@/lib/api';
import { ArrowRight } from 'lucide-react';
import type { ProductSummary } from '@/types/api';

export async function ProductSection({
  title,
  href,
  featured,
  type,
}: {
  title: string;
  href: string;
  featured?: boolean;
  type?: string;
}) {
  let items: ProductSummary[] = [];
  try {
    const data = await productsApi.list({ pageSize: 8, featured, type });
    items = data.items;
  } catch {
    items = [];
  }

  if (!items.length) return null;

  return (
    <section className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-primary">
            <Link href={href}>
              Бүгдийг харах
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <ProductGrid products={items} />
      </div>
    </section>
  );
}
