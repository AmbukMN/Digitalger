'use client';

import { create } from 'zustand';
import { signOut as nextAuthSignOut } from 'next-auth/react';
import { api, clearTokens, getAccessToken, getRefreshToken, setTokens } from './api';

/** Хэрэглэгчийн идэвхтэй нэг багц (олон багц зэрэг байж болно) */
export interface UserSubscription {
  planId: string;
  planName: string;
  isVip: boolean;
  expiresAt: string;
  genres: { id: string; name: string; slug: string }[];
  /** VIP авсан тул энэ багц илүүдэл болсон (хугацаа зогсохгүй) */
  supersededByVip?: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatarUrl: string | null;
  isGuest: boolean;
  provider: 'LOCAL' | 'GOOGLE' | 'FACEBOOK' | 'GUEST';
  emailVerified: boolean;
  /** Хэтэвчийн үлдэгдэл (₮) */
  walletBalance: number;
  /** Хамгийн сүүлд дуусах багц (backward-compat) */
  subscription: { planName: string; expiresAt: string } | null;
  /** Идэвхтэй БҮХ багц */
  subscriptions: UserSubscription[];
  /** 'ALL' = VIP, эсвэл нээлттэй жанруудын ID */
  accessGenreIds: 'ALL' | string[];
  /** VIP багц идэвхтэй эсэх */
  hasVip?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  /** Апп ачаалахад токеноос хэрэглэгч сэргээнэ */
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  /** OAuth signIn амжилттай болсны дараа NextAuth session-оос ирсэн
   * accessToken/refreshToken-г манай localStorage руу хадгална. */
  syncFromOAuth: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  /**
   * Профайл засах. Имэйл солиход `currentPassword` ЗААВАЛ
   * (сошиал хаягаар нэвтэрсэн бол имэйл солих боломжгүй).
   */
  updateProfile: (dto: {
    name?: string;
    email?: string;
    currentPassword?: string;
  }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /**
   * Гаднаас хэрэглэгчийн төлөв тавих (session watcher).
   * ⚠️ `setState` шууд дуудвал КЭШ зөрнө — заавал үүгээр дамжуулна.
   */
  setUser: (user: AuthUser | null) => void;
  uploadAvatar: (file: File) => Promise<void>;
}

/**
 * Хэрэглэгчийн сүүлийн мэдэгдэж байсан төлөв (localStorage).
 *
 * ⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: `/auth/me` сервер рүү явж ирэх хүртэл (удаан
 * интернетэд хэдэн секунд) navbar нь "нэвтрээгүй" хэлбэрээр — "Нэвтрэх" +
 * "Багц авах" — харагдаад, дараа нь гэнэт солигддог байсан. Энэ нь
 * хэрэглэгчид ЭВДЭРСЭН мэт сэтгэгдэл төрүүлдэг.
 *
 * Одоо кэшнээс ШУУД сэргээж (0ms), сервер хариулмагц чимээгүйхэн шинэчилнэ.
 * Кэш нь зөвхөн ХАРАГДАЦ-д зориулагдсан — эрхийн бодит шалгалт backend дээр.
 */
const USER_CACHE_KEY = 'btv_user_cache';

function readUserCache(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeUserCache(user: AuthUser | null) {
  if (typeof window === 'undefined') return;
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    /* private mode — алгасна */
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,

  init: async () => {
    // ⚠️ access ДУУССАН ч refresh (30 хоног) байвал сэргээнэ — хэрэглэгч тухайн
    // browser дээрээ дахин дахин нэвтрэх шаардлагагүй. api() дотор 401 үед
    // автомат refresh хийгдэнэ.
    if (!getAccessToken() && !getRefreshToken()) {
      writeUserCache(null);
      set({ user: null, loading: false });
      return;
    }

    // ⚠️ ХАМГИЙН ЧУХАЛ: кэшнээс ШУУД сэргээнэ — сервер хүлээхгүй.
    // Ингэснээр "Нэвтрэх → Профайл" гэсэн харагдацын үсрэлт (flash) арилна.
    const cached = readUserCache();
    if (cached) set({ user: cached, loading: false });

    try {
      const user = await api<AuthUser>('/auth/me');
      writeUserCache(user);
      set({ user, loading: false });
    } catch {
      // ⚠️ Сүлжээний алдаанд кэшийг УСТГАХГҮЙ — түр тасарсан байж болно.
      // Токен хүчингүй бол api() дотор 401 гарч clearTokens хийгдэнэ.
      if (!getAccessToken() && !getRefreshToken()) {
        writeUserCache(null);
        set({ user: null, loading: false });
      } else {
        set({ loading: false });
      }
    }
  },

  login: async (email, password) => {
    const data = await api<{ accessToken: string; refreshToken: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }), auth: false },
    );
    setTokens(data.accessToken, data.refreshToken);
    await get().refreshMe();
  },

  register: async (email, password, name) => {
    const data = await api<{ accessToken: string; refreshToken: string }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password, name }), auth: false },
    );
    setTokens(data.accessToken, data.refreshToken);
    await get().refreshMe();
  },

  syncFromOAuth: async (accessToken, refreshToken) => {
    setTokens(accessToken, refreshToken);
    await get().refreshMe();
  },

  logout: () => {
    clearTokens();
    writeUserCache(null);
    set({ user: null });
    // NextAuth session ч байвал цэвэрлэнэ (OAuth-аар нэвтэрсэн бол)
    nextAuthSignOut({ redirect: false }).catch(() => null);
  },

  refreshMe: async () => {
    const user = await api<AuthUser>('/auth/me');
    writeUserCache(user);
    set({ user });
  },

  updateProfile: async (dto) => {
    const user = await api<AuthUser>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
    writeUserCache(user);
    set({ user });
  },

  changePassword: async (currentPassword, newPassword) => {
    await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  setUser: (user) => {
    writeUserCache(user);
    set({ user, loading: false });
  },

  uploadAvatar: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const user = await api<AuthUser>('/auth/me/avatar', { method: 'POST', body: form });
    writeUserCache(user);
    set({ user });
  },
}));

/** Идэвхтэй premium эрхтэй эсэх */
export function hasPremium(user: AuthUser | null): boolean {
  return !!user?.subscription && new Date(user.subscription.expiresAt) > new Date();
}
