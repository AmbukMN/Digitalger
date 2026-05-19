import { Skeleton } from '@digitalger/shared/ui';
import { ProductCard } from './product-card';
import type { ProductSummary } from '@/types/api';

export function ProductGrid({
  products,
  loading,
}: {
  products: ProductSummary[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Бүтээгдэхүүн олдсонгүй.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
