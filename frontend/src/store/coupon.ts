'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppliedCoupon {
  code: string;
  type: string;
  value: number;
  discount: number;
  finalPrice: number;
}

export const MAX_COUPONS_PER_PRODUCT = 3;

interface CouponState {
  coupons: Record<string, AppliedCoupon[]>;
  add: (productId: string, coupon: AppliedCoupon) => boolean;
  remove: (productId: string, code: string) => void;
  clear: (productId: string) => void;
  getAll: (productId: string) => AppliedCoupon[];
  getTotalDiscount: (productId: string) => number;
  getFinalPrice: (productId: string, basePrice: number) => number;
}

// rehydrate хийсэн дата бохир (coupons объект биш) байвал цэвэрлэнэ.
function sanitizeCoupons(value: unknown): Record<string, AppliedCoupon[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, AppliedCoupon[]> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(v)) out[k] = v as AppliedCoupon[];
  }
  return out;
}

export const useCouponStore = create<CouponState>()(
  persist(
    (set, get) => ({
      coupons: {},

      add: (productId, coupon) => {
        const existing = (get().coupons ?? {})[productId] ?? [];
        if (existing.length >= MAX_COUPONS_PER_PRODUCT) return false;
        if (existing.some((c) => c.code === coupon.code)) return false;
        set((s) => ({ coupons: { ...(s.coupons ?? {}), [productId]: [...existing, coupon] } }));
        return true;
      },

      remove: (productId, code) =>
        set((s) => ({
          coupons: {
            ...(s.coupons ?? {}),
            [productId]: ((s.coupons ?? {})[productId] ?? []).filter((c) => c.code !== code),
          },
        })),

      clear: (productId) =>
        set((s) => {
          const next = { ...(s.coupons ?? {}) };
          delete next[productId];
          return { coupons: next };
        }),

      getAll: (productId) => (get().coupons ?? {})[productId] ?? [],

      getTotalDiscount: (productId) =>
        ((get().coupons ?? {})[productId] ?? []).reduce((sum, c) => sum + c.discount, 0),

      getFinalPrice: (productId, basePrice) =>
        Math.max(0, basePrice - ((get().coupons ?? {})[productId] ?? []).reduce((sum, c) => sum + c.discount, 0)),
    }),
    {
      name: 'digitalger-coupons',
      skipHydration: true,
      version: 1,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<CouponState>;
        return { ...state, coupons: sanitizeCoupons((state as { coupons?: unknown }).coupons) } as CouponState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.coupons = sanitizeCoupons(state.coupons);
      },
    },
  ),
);
