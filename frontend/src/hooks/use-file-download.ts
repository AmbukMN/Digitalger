'use client';

import { useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { downloadsApi } from '@/lib/api';
import { triggerFileDownload } from '@/lib/download-helper';

interface CachedUrl {
  url: string;
  generatedAt: number;
  expiresIn: number;
}

// Refresh threshold: refresh if less than 60s remain
const REFRESH_THRESHOLD_MS = 60_000;

/**
 * @param freeProductId — өгөгдвөл тухайн ҮНЭГҮЙ бүтээгдэхүүний public endpoint-ээр
 *   (нэвтрэхгүй, token-гүй) татна. Эс бол ердийн (нэвтэрсэн, эзэмшсэн) горим.
 */
export function useFileDownload(freeProductId?: string) {
  const { data: session } = useSession();
  const cache = useRef<Map<string, CachedUrl>>(new Map());
  // fileId → in-flight promise: давтан дарах үед нэг л request явна
  const inflight = useRef<Map<string, Promise<string | null>>>(new Map());

  const getUrl = useCallback(
    async (fileId: string): Promise<string | null> => {
      // Үнэгүй биш горимд token заавал
      if (!freeProductId && !session?.accessToken) return null;

      const cached = cache.current.get(fileId);
      if (cached) {
        const elapsed = Date.now() - cached.generatedAt;
        const remaining = cached.expiresIn * 1000 - elapsed;
        if (remaining > REFRESH_THRESHOLD_MS) {
          return cached.url;
        }
        cache.current.delete(fileId);
      }

      // Аль хэдийн request явж байвал түүнийг хуваалцана — давхар request гарахгүй
      const existing = inflight.current.get(fileId);
      if (existing) return existing;

      const req = freeProductId
        ? downloadsApi.freeFile(freeProductId, fileId).then((r) => ({ url: r.url, expiresIn: r.expiresIn ?? 300, generatedAt: Date.now() }))
        : downloadsApi.signedUrl(session!.accessToken!, fileId).then((r) => ({ url: r.url, expiresIn: r.expiresIn ?? 300, generatedAt: r.generatedAt ?? Date.now() }));

      const promise = req
        .then((result) => {
          cache.current.set(fileId, {
            url: result.url,
            generatedAt: result.generatedAt,
            expiresIn: result.expiresIn,
          });
          return result.url;
        })
        .catch(() => null)
        .finally(() => { inflight.current.delete(fileId); });

      inflight.current.set(fileId, promise);
      return promise;
    },
    [session?.accessToken, freeProductId],
  );

  const download = useCallback(
    async (fileId: string, fileName: string) => {
      const url = await getUrl(fileId);
      if (!url) {
        toast.error('Татахад алдаа гарлаа');
        return false;
      }
      // In-app browser (FB/IG)-т `<a download>` ажилладаггүй тул download-helper
      // нь шууд navigate ашиглана (Page not found-аас сэргийлнэ).
      triggerFileDownload(url, fileName);
      return true;
    },
    [getUrl],
  );

  return { download, getUrl };
}
