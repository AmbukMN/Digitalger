'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProductSummary } from '@/types/api';

interface WishlistState {
  items: ProductSummary[];
  toggle: (product: ProductSummary) => void;
  has: (productId: string) => boolean;
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
    }),
    { name: 'digitalger-wishlist' },
  ),
);
