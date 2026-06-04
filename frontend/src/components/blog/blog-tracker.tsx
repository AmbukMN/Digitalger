'use client';

import { useEffect, useRef } from 'react';
import { blogApi } from '@/lib/api';

// Нийтлэл уншихад уншилт +1 (client-side, нэг session-д нэг удаа).
// Server render + generateMetadata давхар increment-аас сэргийлж client-side.
export function BlogTracker({ slug }: { slug: string }) {
  const trackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (trackedRef.current !== slug) {
      trackedRef.current = slug;
      blogApi.incrementView(slug);
    }
  }, [slug]);
  return null;
}
