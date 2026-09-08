'use client';

import { create } from 'zustand';
import { api } from './api';

const GUEST_KEY = 'btv-my-list-guest';

/** Зочны жагсаалтыг localStorage-оос уншина */
function readGuest(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeGuest(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify([...ids]));
  } catch {
    /* private mode — алгасна */
  }
}

interface MyListState {
  ids: Set<string>;
  loaded: boolean;
  /** Нэвтэрсэн эсэх — toggle нь серверт бичих эсэхийг шийднэ */
  authed: boolean;
  /** Сервер дэх жагсаалтыг ачаална + зочны жагсаалтыг нийлүүлнэ */
  hydrate: () => Promise<void>;
  /** Зочны жагсаалтыг localStorage-оос сэргээнэ */
  hydrateGuest: () => void;
  has: (titleId: string) => boolean;
  /** Instant local toggle — UI шууд шинэчлэгдэнэ */
  toggleLocal: (titleId: string) => void;
  /** Бодит toggle: local instant + (нэвтэрсэн бол) API, алдаа гарвал revert */
  toggle: (titleId: string) => Promise<void>;
  reset: () => void;
}

/**
 * Дуртай кино (my-list).
 *
 * ⚠️ ЗОЧИН ч ашиглана — localStorage-д хадгална. Нэвтрэхэд `hydrate()` нь
 * зочны жагсаалтыг сервер рүү НИЙЛҮҮЛЖ (merge) дараа нь серверийнхийг эх
 * үүсвэр болгоно. Ингэснээр хэрэглэгч бүртгүүлэхээсээ өмнө цуглуулсан
 * жагсаалтаа алдахгүй.
 */
export const useMyListStore = create<MyListState>((set, get) => ({
  ids: new Set(),
  loaded: false,
  authed: false,

  hydrateGuest: () => {
    set({ ids: new Set(readGuest()), loaded: true, authed: false });
  },

  hydrate: async () => {
    const guestIds = readGuest();
    try {
      // Зочноор нэмсэн кинонуудыг серверт нийлүүлнэ (нэг удаа)
      if (guestIds.length) {
        await Promise.all(
          guestIds.map((id) => api(`/my-list/${id}`, { method: 'POST' }).catch(() => null)),
        );
        try {
          localStorage.removeItem(GUEST_KEY);
        } catch {
          /* алгасна */
        }
      }
      const ids = await api<string[]>('/my-list/ids');
      set({ ids: new Set(ids), loaded: true, authed: true });
    } catch {
      // Сервер унасан ч зочны жагсаалт хэвээр харагдана
      set({ ids: new Set(guestIds), loaded: true, authed: true });
    }
  },

  has: (titleId) => get().ids.has(titleId),

  toggleLocal: (titleId) => {
    set((state) => {
      const next = new Set(state.ids);
      if (next.has(titleId)) next.delete(titleId);
      else next.add(titleId);
      if (!state.authed) writeGuest(next);
      return { ids: next };
    });
  },

  toggle: async (titleId) => {
    const wasIn = get().has(titleId);
    get().toggleLocal(titleId);

    // Зочин — зөвхөн localStorage, сервер рүү явуулахгүй
    if (!get().authed) return;

    try {
      await api(`/my-list/${titleId}`, { method: wasIn ? 'DELETE' : 'POST' });
    } catch {
      get().toggleLocal(titleId);
      throw new Error('my-list toggle failed');
    }
  },

  reset: () => {
    // Гарахад зочны localStorage жагсаалт руу буцна
    set({ ids: new Set(readGuest()), loaded: true, authed: false });
  },
}));
