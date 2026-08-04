'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/lib/auth-store';

/**
 * Google/Facebook signIn() амжилттай болмогц NextAuth session-д
 * backend-ийн accessToken/refreshToken гарч ирнэ (auth.ts callbacks.session).
 * Энэ мөрийг манай localStorage JWT (btv_access/btv_refresh) руу
 * нэг удаа хуулна — цаашид апп бүхэлдээ өөрийн JWT flow-оор ажиллана
 * (NextAuth session-ийг зөвхөн OAuth "гүүр" болгож ашиглана).
 */
export function OAuthSessionSync() {
  const { data: session, status } = useSession();
  const syncFromOAuth = useAuth((s) => s.syncFromOAuth);
  const synced = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const accessToken = (session as any)?.accessToken as string | undefined;
    const refreshToken = (session as any)?.refreshToken as string | undefined;
    if (!accessToken || !refreshToken) return;
    if (synced.current === accessToken) return; // давхар sync хийхгүй

    synced.current = accessToken;
    syncFromOAuth(accessToken, refreshToken).catch(() => null);
  }, [session, status, syncFromOAuth]);

  return null;
}
