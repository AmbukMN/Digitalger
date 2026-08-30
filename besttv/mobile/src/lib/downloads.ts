/**
 * ⚠️⚠️ `expo-file-system/legacy` — SDK 57-д үндсэн API нь
 * `File`/`Directory`/`Paths` класс болж БҮРЭН өөрчлөгдсөн.
 *
 * Legacy API (`documentDirectory`, `downloadAsync`, `readDirectoryAsync`)
 * нь хэвээр дэмжигдэж байгаа ба HLS segment олноор татахад илүү
 * тохиромжтой (шинэ API нь файл тус бүрд объект үүсгэдэг).
 */
import * as FileSystem from 'expo-file-system/legacy';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/**
 * ОФЛАЙН ТАТАХ.
 *
 * ⚠️⚠️ ХЭРХЭН АЖИЛЛАДАГ ВЭ:
 *  1. Сервер эрх шалгаад segment бүрийн 7 хоногийн URL өгнө
 *  2. Апп бүх segment-ийг ТАТАЖ локал санд хадгална
 *  3. Апп m3u8-ыг ДАХИН БИЧНЭ — segment мөрийг локал файлын нэрээр солино
 *  4. Плеер локал m3u8-ыг тоглуулна (сүлжээгүй ч ажиллана)
 *
 * ⚠️ DRM БАЙХГҮЙ тул `documentDirectory` (апп-ын хамгаалагдсан сан)
 *    ашиглана — бусад апп хандахгүй. Эрх дуусмагц устгана.
 */

const ROOT = `${FileSystem.documentDirectory}offline/`;

export interface DownloadRow {
  id: string;
  target: string;
  targetId: string;
  quality: string;
  expiresAt: string;
  expired: boolean;
  title: { id: string; title: string; slug: string; posterUrl: string | null };
}

interface AuthorizeRes {
  downloadId: string;
  titleId: string;
  title: string;
  quality: string;
  expiresAt: string;
  segments: { name: string; url: string; durationSec: number }[];
  playlistHeader: string;
}

/** Локал сан — `offline/<target>_<id>/` */
function dirFor(target: string, targetId: string): string {
  return `${ROOT}${target}_${targetId}/`;
}

/** Татсан контентын локал m3u8 зам (плеерт өгнө) */
export function localPlaylist(target: string, targetId: string): string {
  return `${dirFor(target, targetId)}index.m3u8`;
}

/** Локал файл бэлэн эсэх */
export async function isDownloaded(target: string, targetId: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(localPlaylist(target, targetId));
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * Татаж эхлэнэ.
 *
 * @param onProgress 0–1 хооронд явц
 * ⚠️ Дараалан татна — зэрэг 20 холболт нээвэл сүлжээ дүүрч, бусад
 *    хүсэлт (эрх шалгах, мэдэгдэл) удаашрана.
 */
export async function downloadEpisode(
  target: 'movie' | 'episode',
  targetId: string,
  opts: { quality?: string; onProgress?: (p: number) => void; signal?: { cancelled: boolean } } = {},
): Promise<void> {
  const auth = await api<AuthorizeRes>('/downloads/authorize', {
    method: 'POST',
    body: JSON.stringify({ target, targetId, quality: opts.quality }),
  });

  const dir = dirFor(target, targetId);
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  const total = auth.segments.length;
  for (let i = 0; i < total; i += 1) {
    /* ⚠️ Хэрэглэгч болиулсан — цаашид татахгүй, хагасыг цэвэрлэнэ */
    if (opts.signal?.cancelled) {
      await removeLocal(target, targetId);
      throw new Error('Татахыг болиулав');
    }
    const seg = auth.segments[i];
    const dest = `${dir}${seg.name}`;

    /* ⚠️ Аль хэдийн татсан бол алгасна — тасарсан татацыг
       ҮРГЭЛЖЛҮҮЛЭХ боломж (эхнээс нь дахин татахгүй) */
    const info = await FileSystem.getInfoAsync(dest);
    if (!info.exists) {
      await FileSystem.downloadAsync(seg.url, dest);
    }
    opts.onProgress?.((i + 1) / total);
  }

  /**
   * ⚠️⚠️ ЛОКАЛ M3U8 — segment мөрийг ФАЙЛЫН НЭРЭЭР солино.
   *
   * Серверийн playlist дотор бүтэн URL байдаг. Тэрийг хэвээр
   * үлдээвэл офлайн үед плеер сүлжээ рүү орох гэж оролдоно.
   *
   * ⚠️ Толгойг (`#EXT-X-TARGETDURATION` г.м) серверээс авсан —
   * өөрөө зохиовол плеер татгалзана.
   */
  const body = auth.segments
    .map((s) => `#EXTINF:${s.durationSec.toFixed(6)},\n${s.name}`)
    .join('\n');
  const m3u8 = `${auth.playlistHeader}\n${body}\n#EXT-X-ENDLIST\n`;
  await FileSystem.writeAsStringAsync(`${dir}index.m3u8`, m3u8);
}

/** Локал файлыг устгана */
export async function removeLocal(target: string, targetId: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(dirFor(target, targetId), { idempotent: true });
  } catch {
    /* Файл байхгүй ч алдаа шидэхгүй */
  }
}

/**
 * ⚠️⚠️ HEARTBEAT — апп нээгдэх бүрд.
 *
 * Багцаа цуцалсан/дууссан хэрэглэгчийн татацыг сервер «хүчингүй» гэж
 * хэлнэ. Локал файлыг УСТГАХГҮЙ бол төлбөрөө больсон хүн контентыг
 * үүрд хадгална (DRM байхгүйн орлуулагч).
 */
export async function syncDownloads(): Promise<number> {
  try {
    const res = await api<{ revoke: string[]; valid: number }>('/downloads/check');
    if (!res.revoke.length) return 0;

    /* ⚠️ Серверээс зөвхөн `id` ирдэг тул бүх локал санг шалгаж,
       жагсаалтад БАЙХГҮЙ болсныг устгана */
    const list = await api<DownloadRow[]>('/downloads');
    const keep = new Set(list.map((d) => `${d.target}_${d.targetId}`));
    const dirs = await FileSystem.readDirectoryAsync(ROOT).catch(() => [] as string[]);
    for (const d of dirs) {
      if (!keep.has(d)) {
        await FileSystem.deleteAsync(`${ROOT}${d}`, { idempotent: true }).catch(() => {});
      }
    }
    return res.revoke.length;
  } catch {
    /* ⚠️ Офлайн үед алдаа гарна — локал файлыг УСТГАХГҮЙ.
       Сүлжээгүй байхад контентоо алдах нь буруу. */
    return 0;
  }
}

/** Эзэлж буй зай (МБ) */
export async function usedSpaceMb(): Promise<number> {
  try {
    const dirs = await FileSystem.readDirectoryAsync(ROOT);
    let bytes = 0;
    for (const d of dirs) {
      const files = await FileSystem.readDirectoryAsync(`${ROOT}${d}`);
      for (const f of files) {
        const info = await FileSystem.getInfoAsync(`${ROOT}${d}/${f}`);
        if (info.exists && !info.isDirectory) bytes += info.size ?? 0;
      }
    }
    return Math.round(bytes / 1048576);
  } catch {
    return 0;
  }
}

/* ── React hook-ууд ── */

export function useDownloads() {
  return useQuery({
    queryKey: ['downloads'],
    queryFn: () => api<DownloadRow[]>('/downloads'),
    staleTime: 0,
  });
}

export function useRemoveDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: DownloadRow) => {
      await api(`/downloads/${d.id}`, { method: 'DELETE' });
      /* ⚠️ Локал файлыг ч устгана — эс бөгөөс зай эзэлсээр байна */
      await removeLocal(d.target, d.targetId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['downloads'] }),
  });
}
