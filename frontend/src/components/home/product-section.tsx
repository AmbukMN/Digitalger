import { Button } from '@digitalger/shared/ui';
import Link from 'next/link';
import { ProductGrid } from '@/components/products/product-grid';
import { ProductSwiper } from '@/components/products/product-swiper';
import { productsApi } from '@/lib/api';
import { ArrowRight } from 'lucide-react';
import type { ProductSummary } from '@/types/api';

export async function ProductSection({
  title,
  href,
  featured,
  type,
  types,
  swiper,
  swiperMobileRows,
  sortBy,
  onSale,
  pageSize: pageSizeProp,
}: {
  title: string;
  href: string;
  featured?: boolean;
  type?: string;
  types?: string;
  swiper?: boolean;
  swiperMobileRows?: 1 | 2;
  sortBy?: 'newest' | 'discount' | 'rating' | 'downloads';
  onSale?: boolean;
  pageSize?: number;
}) {
  let items: ProductSummary[] = [];
  try {
    const pageSize = pageSizeProp ?? (swiper ? 48 : 8);
    // ⚠️ Token-гүй public fetch — home хуудсыг STATIC ISR байлгахын тулд cookies/
    // getServerSession дуудахгүй. adminOnly бүтээгдэхүүн нь home-ийн discovery
    // section-д харагдах шаардлагагүй (зөвхөн public бүтээгдэхүүн).
    const data = await productsApi.list({ pageSize, featured, type, types, sortBy, onSale });
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
        {swiper
          ? <ProductSwiper products={items} mobileRows={swiperMobileRows ?? 1} />
          : <ProductGrid products={items} />}
      </div>
    </section>
  );
}
