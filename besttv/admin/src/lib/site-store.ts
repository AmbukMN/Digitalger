'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * ⚠️⚠️ АДМИН ПАНЕЛИЙН САЙТ СОНГОЛТ.
 *
 * Нэг админ панель хоёр сайтыг (BestTV, BestFilm) удирдана.
 * Дээд талын шилжүүлэгчээр сонгосон сайт нь БҮХ API дуудлагад
 * `X-Site` толгойгоор явна.
 *
 * ГУРВАН ГОРИМ:
 *   `besttv`   — зөвхөн BestTV-ийн өгөгдөл
 *   `bestfilm` — зөвхөн BestFilm-ийн өгөгдөл
 *   `all`      — ХОЁУЛАНГИЙН нэгдсэн (зөвхөн ADMIN, дашбоардад)
 *
 * ⚠️ `all` горим нь өгөгдлийн тусгаарлалтыг унтраадаг тул
 * backend-ийн `AllSitesGuard` эрхийг дахин шалгана.
 */

export const ADMIN_SITES = ['besttv', 'bestfilm'] as const;
export type AdminSite = (typeof ADMIN_SITES)[number];
export type SiteScope = AdminSite | 'all';

export const SITE_META: Record<AdminSite, { label: string; domain: string; color: string }> = {
  besttv: { label: 'BestTV', domain: 'besttv.us', color: '#e50914' },
  /** ⚠️ Логоны улаан. Админ нь ихэвчлэн light горимд тул #C8001E (6.04:1) */
  bestfilm: { label: 'BestFilm', domain: 'bestfilm.net', color: '#c8001e' },
};

interface SiteState {
  site: SiteScope;
  setSite: (s: SiteScope) => void;
  /** Тухайн хуудсанд `all` горим зөвшөөрөгдөх эсэх (дашбоард л) */
  allowAll: boolean;
  setAllowAll: (v: boolean) => void;
}

/**
 * ⚠️ ЯАГААД `persist` ВЭ: админ хуудас сэргээхэд (F5) сонголт
 * алдагдвал BestFilm-ийн өгөгдөл засаж байгаад санамсаргүйгээр
 * BestTV-д үргэлжлүүлэх эрсдэлтэй.
 *
 * ⚠️ ЯАГААД `localStorage` ВЭ, cookie БИШ: сонголт нь ЗӨВХӨН энэ
 * хөтчид хамаарна. Cookie бол SSR-д ч нөлөөлж, кэш холилдоно.
 */
export const useSiteStore = create<SiteState>()(
  persist(
    (set) => ({
      /** ⚠️ Өгөгдмөл нь BestTV — одоогийн зан төлөв ХЭВЭЭР */
      site: 'besttv',
      setSite: (site) => set({ site }),
      allowAll: false,
      setAllowAll: (allowAll) => set({ allowAll }),
    }),
    {
      name: 'btv_admin_site',
      /** ⚠️ `allowAll` нь хуудас бүрд өөр — хадгалахгүй */
      partialize: (s) => ({ site: s.site }),
    },
  ),
);

/**
 * ⚠️ REACT-ААС ГАДУУР унших — `api()` функцэд хэрэгтэй.
 *
 * `api()` нь hook биш тул `useSiteStore()` дуудаж болохгүй.
 * Zustand-ийн `getState()` нь энэ зорилгоор бий.
 */
export function currentAdminSite(): SiteScope {
  return useSiteStore.getState().site;
}

/** Сонгосон сайтын өнгө/нэр — UI-д. */
export function siteMeta(s: SiteScope) {
  return s === 'all'
    ? { label: 'Бүх сайт', domain: 'besttv.us + bestfilm.net', color: '#6b7280' }
    : SITE_META[s];
}
