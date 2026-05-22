'use client';

import { useQuery } from '@tanstack/react-query';
import { productTypesApi } from '@/lib/api';

export function useProductTypes() {
  return useQuery({
    queryKey: ['public', 'product-types'],
    queryFn: () => productTypesApi.list(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useProductTypeLabel(type: string): string {
  const { data } = useProductTypes();
  const found = data?.find((t) => t.value === type);
  return found?.label ?? type;
}

export function useProductTypeIcon(type: string): string | null {
  const { data } = useProductTypes();
  const found = data?.find((t) => t.value === type);
  return found?.icon ?? null;
}
