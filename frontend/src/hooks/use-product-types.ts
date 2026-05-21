'use client';

import { useQuery } from '@tanstack/react-query';
import { productTypesApi } from '@/lib/api';
import { PRODUCT_TYPE_LABELS } from '@/lib/constants';

export function useProductTypes() {
  return useQuery({
    queryKey: ['public', 'product-types'],
    queryFn: () => productTypesApi.list(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useProductTypeLabel(type: string): string {
  const { data } = useProductTypes();
  if (data) {
    const found = data.find((t) => t.value === type);
    if (found) return found.label;
  }
  return PRODUCT_TYPE_LABELS[type] ?? type;
}
