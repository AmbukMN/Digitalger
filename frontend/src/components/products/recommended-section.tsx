'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { ProductSwiper } from '@/components/products/product-swiper';
import { productsApi } from '@/lib/api';
import { useRecentlyViewedStore } from '@/store/recently-viewed';

// "Танд санал болгох" (personalized) — backend (category-based) + зочны localStorage viewedIds.
// Нэвтэрсэн бол token (userId-аар), зочин бол саяхан үзсэн productId-ууд дамжуулна.
// Хоосон бол render хийхгүй (backend fallback popular буцаадаг тул ихэвчлэн дүүрэн).
export function RecommendedSection() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const viewedItems = useRecentlyViewedStore((s) => s.items);

  // SSR/hydration mismatch сэргийлэх — store skipHydration тул mount хүртэл хүлээнэ.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const viewedIds = (viewedItems ?? []).map((v) => v.productId);

  const { data: products } = useQuery({
    // viewedIds өөрчлөгдвөл дахин татна (саяхан үзсэн нэмэгдэх бүрд шинэчилнэ).
    queryKey: ['products', 'recommended', token ?? 'guest', viewedIds],
    queryFn: () => productsApi.recommended(token, viewedIds, 12),
    enabled: mounted,
    staleTime: 5 * 60_000,
  });

  if (!mounted || !products || products.length === 0) return null;

  return (
    <section className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-secondary shrink-0" />
          <h2 className="text-2xl font-bold">Танд санал болгох</h2>
        </div>
        <ProductSwiper products={products} mobileRows={2} />
      </div>
    </section>
  );
}
