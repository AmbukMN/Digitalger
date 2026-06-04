'use client';

import { useEffect, useRef } from 'react';
import { trackProductView } from '@/lib/analytics';
import { productsApi } from '@/lib/api';

export function ProductTracker({ productId, productSlug, price }: { productId: string; productSlug: string; price?: number }) {
  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    trackProductView(productId, productSlug, price);
    // Үзэлт +1 — нэг session-д ижил бүтээгдэхүүнд нэг л удаа (давхар тооцохгүй)
    if (viewedRef.current !== productSlug) {
      viewedRef.current = productSlug;
      productsApi.incrementView(productSlug);
    }
  }, [productId, productSlug, price]);

  return null;
}
