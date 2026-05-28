'use client';

import { useEffect } from 'react';
import { trackProductView } from '@/lib/analytics';

export function ProductTracker({ productId, productSlug }: { productId: string; productSlug: string }) {
  useEffect(() => {
    trackProductView(productId, productSlug);
  }, [productId, productSlug]);

  return null;
}
