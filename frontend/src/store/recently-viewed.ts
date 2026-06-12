'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Саяхан үзсэн бүтээгдэхүүн — localStorage (нэвтрэхгүй ч ажиллана, backend хэрэггүй).
// cart.ts/wishlist.ts-ийн pattern яг дагасан: skipHydration + sanitize (бохир дата crash сэргийлэх).
export interface RecentlyViewedItem {
  productId: string;
  slug: string;
  title: string;
  price: number;
  compareAtPrice?: number | null;
  thumbnailUrl: string | null;
  // ⚠️ ProductCard-ийн badge-д хэрэгтэй талбарууд (нүүр хуудасны card-тай ИЖИЛ
  // харагдахын тулд) — type, featured, rating, downloadCount.
  type?: string;
  featured?: boolean;
  rating?: number;
  ratingCount?: number;
  downloadCount?: number;
}

const MAX_VIEWED = 12;

interface RecentlyViewedState {
  items: RecentlyViewedItem[];
  // Сүүлд үзсэнийг ЭХЭНД нэмнэ, давхардлыг (productId) арилгана, дээд тал нь 12.
  addViewed: (item: RecentlyViewedItem) => void;
  // Одоогийн жагсаалт (тодорхой productId-г хасах боломжтой — өөрийгөө carousel-д харуулахгүй).
  getViewed: (excludeId?: string) => RecentlyViewedItem[];
  clear: () => void;
}

// rehydrate хийсэн дата бохир (items массив биш, эсвэл элемент productId-гүй)
// байвал crash хийхээс сэргийлж цэвэрлэнэ (cart.ts-ийн pattern).
function sanitizeItems(value: unknown): RecentlyViewedItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (i): i is RecentlyViewedItem =>
        !!i &&
        typeof i === 'object' &&
        typeof (i as RecentlyViewedItem).productId === 'string' &&
        typeof (i as RecentlyViewedItem).slug === 'string',
    )
    .slice(0, MAX_VIEWED);
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      items: [],
      addViewed: (item) => {
        if (!item || typeof item.productId !== 'string' || typeof item.slug !== 'string') return;
        const clean: RecentlyViewedItem = {
          productId: item.productId,
          slug: item.slug,
          title: item.title ?? '',
          price: Number(item.price) || 0,
          compareAtPrice:
            item.compareAtPrice != null ? Number(item.compareAtPrice) || null : null,
          thumbnailUrl: item.thumbnailUrl ?? null,
          // Badge талбарууд (нүүр хуудасны card-тай ИЖИЛ харагдах).
          type: item.type ?? 'FILE',
          featured: item.featured ?? false,
          rating: Number(item.rating) || 0,
          ratingCount: Number(item.ratingCount) || 0,
          downloadCount: Number(item.downloadCount) || 0,
        };
        set((s) => {
          const existing = (s.items ?? []).filter((i) => i.productId !== clean.productId);
          // Сүүлд үзсэн нь эхэнд, дээд тал нь 12.
          return { items: [clean, ...existing].slice(0, MAX_VIEWED) };
        });
      },
      getViewed: (excludeId) => {
        const items = get().items ?? [];
        return excludeId ? items.filter((i) => i.productId !== excludeId) : items;
      },
      clear: () => set({ items: [] }),
    }),
    {
      name: 'digitalger-recently-viewed',
      skipHydration: true,
      // v2: badge талбар (type/featured/rating/downloadCount) нэмэгдсэн — хуучин v1
      // кэш (badge-гүй) цэвэрлэгдэж, шинээр үзсэн product бүрэн дата хадгална.
      version: 2,
      // Хуучин схем/бохир датаг rehydrate хийхэд цэвэрлэнэ.
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<RecentlyViewedState>;
        return {
          ...state,
          items: sanitizeItems((state as { items?: unknown }).items),
        } as RecentlyViewedState;
      },
      // rehydrate хийсний дараа items заавал массив байхыг баталгаажуулна.
      onRehydrateStorage: () => (state) => {
        if (state) state.items = sanitizeItems(state.items);
      },
    },
  ),
);
