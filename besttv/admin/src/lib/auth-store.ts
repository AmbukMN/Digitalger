'use client';

import { create } from 'zustand';
import { ApiError, api, clearTokens, getAccessToken, setTokens, tryRefresh } from './api';

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatarUrl?: string | null;
  emailVerified?: boolean;
  createdAt?: string;
}

interface AuthState {
  user: AdminUser | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  /** Профайл зассаны дараа /auth/me-г дахин татаж UI-г шинэчилнэ */
  refreshMe: () => Promise<void>;
  logout: () => void;
}

export const useAdminAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    /**
     * ⚠️⚠️ REFRESH TOKEN-ЫГ Ч ШАЛГАНА.
     *
     * Access нь 15 минут, refresh нь 30 хоног. Зөвхөн access-ыг
     * шалгавал 30 хоногийн хүчинтэй refresh байсаар атал админ
     * гарна (storage хэсэгчлэн цэвэрлэгдсэн, өөр таб дуусгасан).
     * Вэб талд (`frontend/src/lib/auth-store.ts`) энэ нь аль хэдийн
     * зөв — админд хуулагдаагүй байв.
     */
    const hasRefresh = Boolean(localStorage.getItem('btv_admin_refresh'));
    if (!getAccessToken() && !hasRefresh) {
      set({ user: null, loading: false });
      return;
    }
    if (!getAccessToken()) {
      const ok = await tryRefresh();
      if (!ok) {
        clearTokens();
        set({ user: null, loading: false });
        return;
      }
    }
    try {
      const user = await api<AdminUser>('/auth/me');
      set({ user, loading: false });
    } catch (e) {
      /**
       * ⚠️⚠️ СҮЛЖЭЭНИЙ АЛДААНД ГАРГАХГҮЙ.
       *
       * Өмнө нь `catch { user: null }` байсан тул 500, timeout, DNS,
       * JSON задлах алдаа — БҮГД «нэвтрээгүй» болж, админыг /login
       * руу шиднэ. Backend deploy хийж байхад F5 дарвал 502 → гарна,
       * токен нь бүрэн хүчинтэй атал.
       *
       * ⚠️ Зөвхөн 401 (жинхэнэ эрхийн алдаа) үед л токен цэвэрлэнэ.
       */
      if (e instanceof ApiError && e.status === 401) {
        clearTokens();
        set({ user: null, loading: false });
      } else {
        set({ loading: false });
      }
    }
  },

  login: async (email, password) => {
    const data = await api<{ accessToken: string; refreshToken: string; user: AdminUser }>(
      '/auth/admin/login',
      { method: 'POST', body: JSON.stringify({ email, password }), auth: false },
    );
    setTokens(data.accessToken, data.refreshToken);
    set({ user: data.user });
  },

  refreshMe: async () => {
    const user = await api<AdminUser>('/auth/me');
    set({ user });
  },

  logout: () => {
    /**
     * ⚠️⚠️ BACKEND-Д ЗААВАЛ МЭДЭГДЭНЭ.
     *
     * Зөвхөн localStorage цэвэрлэвэл `UserSession` мөр DB-д 30 хоног
     * үлдэж, ТӨХӨӨРӨМЖИЙН ХЯЗГААРЫН БАЙРЫГ дэмий эзэлнэ — «2
     * төхөөрөмж» гэж зарласан атлаа 1 л ажиллана. Админ 2 удаа
     * гараад орвол 3 дахь нэвтрэлт өмнөх session-ыг чимээгүй хөөнө.
     *
     * ⚠️ `await` ХИЙХГҮЙ — офлайн үед UI гацна. Гарах нь клиент
     * талдаа шууд болно.
     */
    const rt = localStorage.getItem('btv_admin_refresh');
    if (rt) {
      void api('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: rt }),
        auth: false,
      }).catch(() => null);
    }
    clearTokens();
    set({ user: null });
  },
}));
