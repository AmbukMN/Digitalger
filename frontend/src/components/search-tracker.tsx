'use client';

import { useEffect } from 'react';
import { trackSearch } from '@/lib/analytics';

export function SearchTracker({ query, results }: { query: string; results: number }) {
  useEffect(() => {
    if (query.trim().length > 1) {
      trackSearch(query.trim(), results);
    }
  }, [query, results]);

  return null;
}
