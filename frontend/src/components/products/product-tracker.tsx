'use client';

import { useEffect } from 'react';
import { trackProductView } from '@/lib/analytics';

export function ProductTracker({ productId, productSlug, price }: { productId: string; productSlug: string; price?: number }) {
  useEffect(() => {
    trackProductView(productId, productSlug, price);
  }, [productId, productSlug, price]);

  return null;
}
