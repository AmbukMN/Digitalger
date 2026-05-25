'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProductSummary } from '@/types/api';

interface WishlistState {
  items: ProductSummary[];
  toggle: (product: ProductSummary) => void;
  has: (productId: string) => boolean;
  // нэвтрэхэд backend-тэй sync хийхэд ашиглана
  mergeFromBackend: (backendItems: ProductSummary[]) => void;
  // нэвтрэхэд localStorage-аас backend руу sync хийх үед pending items буцаана
  getPendingIds: () => string[];
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (product) =>
        set((s) => {
          const exists = s.items.some((i) => i.id === product.id);
          if (exists) return { items: s.items.filter((i) => i.id !== product.id) };
          return { items: [...s.items, product] };
        }),
      has: (productId) => get().items.some((i) => i.id === productId),
      mergeFromBackend: (backendItems) =>
        set((s) => {
          // backend items + local items-ийн union (давхардлыг id-р хасна)
          const backendIds = new Set(backendItems.map((i) => i.id));
          const localOnly = s.items.filter((i) => !backendIds.has(i.id));
          return { items: [...backendItems, ...localOnly] };
        }),
      getPendingIds: () => get().items.map((i) => i.id),
    }),
    { name: 'digitalger-wishlist', skipHydration: true },
  ),
);
