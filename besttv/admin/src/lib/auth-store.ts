'use client';

import { create } from 'zustand';
import { api, clearTokens, getAccessToken, setTokens } from './api';

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
    if (!getAccessToken()) {
      set({ loading: false });
      return;
    }
    try {
      const user = await api<AdminUser>('/auth/me');
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
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
    clearTokens();
    set({ user: null });
  },
}));
