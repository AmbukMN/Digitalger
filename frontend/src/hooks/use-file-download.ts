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
        // Expired or about to expire — refresh
        cache.current.delete(fileId);
      }

      try {
        const result = await downloadsApi.signedUrl(session.accessToken, fileId);
        cache.current.set(fileId, {
          url: result.url,
          generatedAt: result.generatedAt ?? Date.now(),
          expiresIn: result.expiresIn ?? 300,
        });
        return result.url;
      } catch {
        return null;
      }
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
