'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProductSummary } from '@/types/api';

interface CartItem {
  productId: string;
  slug: string;
  title: string;
  price: number;
  compareAtPrice?: number | null;
  thumbnailUrl: string | null;
  couponCodes?: string[];
  couponDiscount?: number;
}

interface CartState {
  items: CartItem[];
  add: (product: ProductSummary, options?: { couponCodes?: string[]; couponDiscount?: number }) => void;
  remove: (productId: string) => void;
  clear: () => void;
  has: (productId: string) => boolean;
  total: () => number;
  updateThumbnail: (productId: string, thumbnailUrl: string) => void;
  removePurchased: (purchasedIds: string[]) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (product, options) => {
        const price = Number(product.price);
        const compareAtPrice = product.compareAtPrice ? Number(product.compareAtPrice) : null;
        const discount = options?.couponDiscount ?? 0;
        set((s) => {
          if (s.items.some((i) => i.productId === product.id)) return s;
          return {
            items: [
              ...s.items,
              {
                productId: product.id,
                slug: product.slug,
                title: product.title,
                price: Math.max(0, price - discount),
                compareAtPrice: compareAtPrice ?? price,
                thumbnailUrl: product.thumbnailUrl ?? product.previewUrl ?? null,
                ...(options?.couponCodes?.length ? { couponCodes: options.couponCodes } : {}),
                ...(discount > 0 ? { couponDiscount: discount } : {}),
              },
            ],
          };
        });
      },
      remove: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      updateThumbnail: (productId, thumbnailUrl) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.productId === productId ? { ...i, thumbnailUrl } : i,
          ),
        })),
      clear: () => set({ items: [] }),
      has: (productId) => get().items.some((i) => i.productId === productId),
      total: () => get().items.reduce((sum, i) => sum + i.price, 0),
      removePurchased: (purchasedIds) =>
        set((s) => ({
          items: s.items.filter((i) => !purchasedIds.includes(i.productId)),
        })),
    }),
    { name: 'digitalger-cart' },
  ),
);
