'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { ProductSwiper } from '@/components/products/product-swiper';
import { useRecentlyViewedStore } from '@/store/recently-viewed';
import type { ProductSummary } from '@/types/api';

// "Таны саяхан үзсэн" — localStorage (нэвтрэхгүй ч ажиллана, backend хэрэггүй).
// Хоосон бол render хийхгүй (null). excludeId — одоогийн product-ийг хасна
// (product page дээр өөрийгөө carousel-д харуулахгүй).
export function RecentlyViewedSection({ excludeId }: { excludeId?: string }) {
  const items = useRecentlyViewedStore((s) => s.items);
  // SSR/hydration mismatch сэргийлэх — mount хүртэл юу ч render хийхгүй
  // (store skipHydration тул эхний render дээр items хоосон байна).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const viewed = (excludeId ? items.filter((i) => i.productId !== excludeId) : items).slice(0, 12);
  if (viewed.length === 0) return null;

  // RecentlyViewedItem → ProductSummary (ProductCard дахин ашиглах).
  const products: ProductSummary[] = viewed.map((v) => ({
    id: v.productId,
    title: v.title,
    slug: v.slug,
    description: '',
    price: v.price,
    compareAtPrice: v.compareAtPrice ?? null,
    type: 'FILE',
    featured: false,
    rating: 0,
    ratingCount: 0,
    downloadCount: 0,
    thumbnailUrl: v.thumbnailUrl,
  }));

  return (
    <section className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <Clock className="h-6 w-6 text-primary shrink-0" />
          <h2 className="text-2xl font-bold">Таны саяхан үзсэн</h2>
        </div>
        <ProductSwiper products={products} />
      </div>
    </section>
  );
}
