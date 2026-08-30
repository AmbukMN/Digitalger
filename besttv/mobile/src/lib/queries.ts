import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { HomeData, Paged, TitleCard, TitleDetail } from './types';

/**
 * ⚠️ `staleTime` — мобайл сүлжээнд хүсэлт үнэтэй. Гэхдээ эрх/явцтай
 * холбоотой дата 0 байх ЁСТОЙ (багц авмагц шууд нээгдэнэ).
 */
const MIN = 60_000;

export function useHome() {
  return useQuery({
    queryKey: ['home'],
    queryFn: () => api<HomeData>('/titles/home'),
    /* Backend талд 90 сек Redis кэштэй тул 1 мин зохимжтой */
    staleTime: MIN,
  });
}

export function useTitle(slug: string) {
  return useQuery({
    queryKey: ['title', slug],
    queryFn: () => api<TitleDetail>(`/titles/${slug}`),
    enabled: !!slug,
    /* ⚠️ 0 — `hasAccess` энд ирдэг тул багц авмагц шинэчлэгдэх ёстой */
    staleTime: 0,
  });
}

/**
 * Каталог — хуудаслалттай.
 *
 * ⚠️ Backend нь offset (`page`) ашигладаг. Шинэ кино нэмэгдэхэд мөр
 * давхардаж болзошгүй тул `id`-гаар давхардлыг шүүнэ.
 */
export function useCatalog(params: {
  type?: string;
  genre?: string;
  sort?: string;
}) {
  return useInfiniteQuery({
    queryKey: ['catalog', params],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ page: String(pageParam), limit: '24' });
      if (params.type && params.type !== 'ALL') q.set('type', params.type);
      if (params.genre && params.genre !== 'ALL') q.set('genre', params.genre);
      if (params.sort) q.set('sort', params.sort);
      return api<Paged<TitleCard>>(`/titles?${q}`);
    },
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    staleTime: MIN,
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => api<TitleCard[]>(`/titles/search?q=${encodeURIComponent(q)}&limit=30`),
    /* ⚠️ 2 тэмдэгтээс богино хайлт утгагүй — сервер дэмий ачаална */
    enabled: q.trim().length >= 2,
    staleTime: MIN,
  });
}

export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    queryFn: () => api<{ id: string; name: string; slug: string; isAdult: boolean }[]>('/genres'),
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
