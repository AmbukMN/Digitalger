'use client';

import { useEffect, useRef } from 'react';
import { trackProductView } from '@/lib/analytics';
import { productsApi } from '@/lib/api';
import { useRecentlyViewedStore } from '@/store/recently-viewed';

export function ProductTracker({
  productId,
  productSlug,
  price,
  title,
  compareAtPrice,
  thumbnailUrl,
  type,
  featured,
  rating,
  ratingCount,
  downloadCount,
}: {
  productId: string;
  productSlug: string;
  price?: number;
  // Саяхан үзсэн carousel-д шаардлагатай нэмэлт талбарууд (localStorage-д хадгална —
  // нүүр хуудасны card-тай ИЖИЛ badge харагдахын тулд бүх талбар).
  title?: string;
  compareAtPrice?: number | null;
  thumbnailUrl?: string | null;
  type?: string;
  featured?: boolean;
  rating?: number;
  ratingCount?: number;
  downloadCount?: number;
}) {
  const viewedRef = useRef<string | null>(null);
  const addViewed = useRecentlyViewedStore((s) => s.addViewed);
  useEffect(() => {
    trackProductView(productId, productSlug, price);
    // Үзэлт +1 — нэг session-д ижил бүтээгдэхүүнд нэг л удаа (давхар тооцохгүй)
    if (viewedRef.current !== productSlug) {
      viewedRef.current = productSlug;
      productsApi.incrementView(productSlug);
    }
    // Саяхан үзсэн (localStorage) — нэвтрэхгүй ч ажиллана. Сүүлд үзсэн нь эхэнд.
    if (title) {
      addViewed({
        productId,
        slug: productSlug,
        title,
        price: price ?? 0,
        compareAtPrice: compareAtPrice ?? null,
        thumbnailUrl: thumbnailUrl ?? null,
        type,
        featured,
        rating,
        ratingCount,
        downloadCount,
      });
    }
  }, [productId, productSlug, price, title, compareAtPrice, thumbnailUrl, type, featured, rating, ratingCount, downloadCount, addViewed]);

  return null;
}
