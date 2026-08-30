import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { HomeData, TitleCard, TitleDetail } from './types';

/**
 * ⚠️⚠️ АППЫН ЗАМ НЬ `/mobile/*` — ВЭБИЙНХЭЭС ТУСДАА.
 *
 * Backend нь энэ зам дээр 18+ жанрын киног ОГТ буцаадаггүй
 * (App Store-ийн Guideline 1.1.4). Вэбийн `/titles/*` нь хэвээр —
 * тэнд 18+ ил байх ёстой.
 *
 * ⚠️ `/titles/*` руу БУЦААЖ БҮҮ сольж — апп дээр 18+ гарвал
 *    дэлгүүрээс татгалзана.
 */

/**
 * ⚠️ `staleTime` — мобайл сүлжээнд хүсэлт үнэтэй. Гэхдээ эрх/явцтай
 * холбоотой дата 0 байх ЁСТОЙ (багц авмагц шууд нээгдэнэ).
 */
const MIN = 60_000;

export function useHome() {
  return useQuery({
    queryKey: ['home'],
    queryFn: () => api<HomeData>('/mobile/home'),
    /* Backend талд 90 сек Redis кэштэй тул 1 мин зохимжтой */
    staleTime: MIN,
  });
}

export function useTitle(slug: string) {
  return useQuery({
    queryKey: ['title', slug],
    queryFn: () => api<TitleDetail>(`/mobile/titles/${slug}`),
    enabled: !!slug,
    /* ⚠️ 0 — `hasAccess` энд ирдэг тул багц авмагц шинэчлэгдэх ёстой */
    staleTime: 0,
  });
}

/**
 * Каталог — CURSOR пагинаци.
 *
 * ⚠️ offset (`page`) нь infinite scroll дээр мөр ДАВХАРДУУЛНА: шинэ
 * кино нэмэгдэхэд бүх мөр нэгээр шилжиж, page 2 дээр page 1-ийн
 * элемент дахин гарна. `FlatList` давхардсан `key`-д React алдаа өгнө.
 */
export function useCatalog(params: { type?: string; genre?: string }) {
  return useInfiniteQuery({
    queryKey: ['catalog', params],
    /* ⚠️ `null` = эхний хуудас (cursor байхгүй) */
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ limit: '24' });
      if (pageParam) q.set('cursor', pageParam);
      if (params.type && params.type !== 'ALL') q.set('type', params.type);
      if (params.genre && params.genre !== 'ALL') q.set('genre', params.genre);
      return api<{ items: TitleCard[]; nextCursor: string | null }>(`/mobile/titles?${q}`);
    },
    getNextPageParam: (last) => last.nextCursor,
    staleTime: MIN,
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => api<TitleCard[]>(`/mobile/search?q=${encodeURIComponent(q)}&limit=30`),
    /* ⚠️ 2 тэмдэгтээс богино хайлт утгагүй — сервер дэмий ачаална */
    enabled: q.trim().length >= 2,
    staleTime: MIN,
  });
}

export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    /* ⚠️ `/mobile/genres` нь 18+ жанрыг ӨӨРИЙГ нь ч буцаадаггүй */
    queryFn: () => api<{ id: string; name: string; slug: string }[]>('/mobile/genres'),
    /* Жанр бараг өөрчлөгддөггүй */
    staleTime: 10 * MIN,
  });
}

/* ── Дуртай ── */

export function useMyList() {
  return useQuery({
    queryKey: ['my-list'],
    queryFn: () => api<TitleCard[]>('/my-list'),
    staleTime: 0,
  });
}

export function useMyListIds() {
  return useQuery({
    queryKey: ['my-list-ids'],
    queryFn: () => api<string[]>('/my-list/ids'),
    staleTime: 0,
  });
}

export function useToggleMyList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ titleId, on }: { titleId: string; on: boolean }) =>
      api(`/my-list/${titleId}`, { method: on ? 'POST' : 'DELETE' }),
    /* ⚠️ Хоёуланг нь шинэчилнэ — `ids` нь картан дээрх зүрхэнд,
       жагсаалт нь «Дуртай» табд хэрэгтэй */
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-list'] });
      void qc.invalidateQueries({ queryKey: ['my-list-ids'] });
    },
  });
}

/* ── Үзсэн явц ── */

export function useSaveProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: {
      titleId: string;
      episodeId?: string;
      positionSec: number;
      durationSec: number;
    }) => api('/progress', { method: 'POST', body: JSON.stringify(b) }),
    /* ⚠️ Нүүрний «Үргэлжлүүлэх» эгнээг шинэчилнэ */
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['home'] }),
  });
}

/**
 * «ҮРГЭЛЖЛҮҮЛЭХ»-ЭЭС ХАСАХ.
 *
 * ⚠️⚠️ Үүнгүйгээр үзэж дууссан кино эгнээнд 99% дээр ҮҮРД үлдэж,
 * эгнээ хуучин контентоор дүүрч ашиггүй болно.
 */
export function useRemoveProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (titleId: string) =>
      api(`/progress/${titleId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['home'] });
    },
  });
}
