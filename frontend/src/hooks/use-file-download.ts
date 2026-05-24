'use client';

import { useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { downloadsApi } from '@/lib/api';

interface CachedUrl {
  url: string;
  generatedAt: number;
  expiresIn: number;
}

// Refresh threshold: refresh if less than 60s remain
const REFRESH_THRESHOLD_MS = 60_000;

export function useFileDownload() {
  const { data: session } = useSession();
  const cache = useRef<Map<string, CachedUrl>>(new Map());
  // fileId → in-flight promise: давтан дарах үед нэг л request явна
  const inflight = useRef<Map<string, Promise<string | null>>>(new Map());

  const getUrl = useCallback(
    async (fileId: string): Promise<string | null> => {
      if (!session?.accessToken) return null;

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

      const promise = downloadsApi
        .signedUrl(session.accessToken, fileId)
        .then((result) => {
          cache.current.set(fileId, {
            url: result.url,
            generatedAt: result.generatedAt ?? Date.now(),
            expiresIn: result.expiresIn ?? 300,
          });
          return result.url;
        })
        .catch(() => null)
        .finally(() => { inflight.current.delete(fileId); });

      inflight.current.set(fileId, promise);
      return promise;
    },
    [session?.accessToken],
  );

  const download = useCallback(
    async (fileId: string, fileName: string) => {
      const url = await getUrl(fileId);
      if (!url) {
        toast.error('Татахад алдаа гарлаа');
        return false;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    },
    [getUrl],
  );

  return { download, getUrl };
}
