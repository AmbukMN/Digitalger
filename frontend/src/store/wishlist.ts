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
  // FB/IG → системийн браузар шилжихэд: дамжсан wishlist-ийг ЭХЭНД нэгтгэнэ (дарж бичихгүй).
  mergeFront: (newItems: ProductSummary[]) => void;
  // нэвтрэхэд localStorage-аас backend руу sync хийх үед pending items буцаана
  getPendingIds: () => string[];
}

// rehydrate хийсэн дата бохир (items массив биш, эсвэл элемент нь id-гүй) байвал цэвэрлэнэ.
function sanitizeItems(value: unknown): ProductSummary[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (i): i is ProductSummary =>
      !!i && typeof i === 'object' && typeof (i as ProductSummary).id === 'string',
  );
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (product) =>
        set((s) => {
          const items = s.items ?? [];
          const exists = items.some((i) => i.id === product.id);
          if (exists) return { items: items.filter((i) => i.id !== product.id) };
          return { items: [...items, product] };
        }),
      has: (productId) => (get().items ?? []).some((i) => i.id === productId),
      mergeFromBackend: (backendItems) =>
        set((s) => {
          // backend items + local items-ийн union (давхардлыг id-р хасна)
          const backendIds = new Set(backendItems.map((i) => i.id));
          const localOnly = (s.items ?? []).filter((i) => !backendIds.has(i.id));
          return { items: [...backendItems, ...localOnly] };
        }),
      mergeFront: (newItems) =>
        set((s) => {
          // FB-гийн wishlist-ийг ЭХЭНД, өмнө байсан (FB-д байхгүй) бүтээгдэхүүнийг араас нь.
          const incoming = sanitizeItems(newItems);
          if (!incoming.length) return s;
          const existing = s.items ?? [];
          const incomingIds = new Set(incoming.map((i) => i.id));
          return {
            items: [...incoming, ...existing.filter((i) => !incomingIds.has(i.id))],
          };
        }),
      getPendingIds: () => (get().items ?? []).map((i) => i.id),
    }),
    {
      name: 'digitalger-wishlist',
      skipHydration: true,
      version: 1,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<WishlistState>;
        return { ...state, items: sanitizeItems((state as { items?: unknown }).items) } as WishlistState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.items = sanitizeItems(state.items);
      },
    },
  ),
);
