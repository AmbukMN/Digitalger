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
  types,
}: {
  title: string;
  href: string;
  featured?: boolean;
  type?: string;
  types?: string;
}) {
  let items: ProductSummary[] = [];
  try {
    const data = await productsApi.list({ pageSize: 8, featured, type, types });
    items = data.items;
  } catch {
    items = [];
  }

  if (!items.length) return null;

  return (
    <section className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-primary shrink-0" aria-hidden="true" />
            <h2 className="text-2xl font-bold">{title}</h2>
          </div>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground hover:text-foreground">
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
