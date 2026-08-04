'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/lib/auth-store';
import { getAccessToken } from '@/lib/api';

/**
 * OAuth "гүүр" — Google/Facebook нэвтрэлтийн үр дүнг манай JWT flow руу
 * дамжуулна.
 *
 * NextAuth session-д backend-ийн accessToken/refreshToken байдаг
 * (`auth.ts` callbacks.session). Тэдгээрийг localStorage руу НЭГ УДАА
 * хуулна — цаашид апп бүхэлдээ өөрийн JWT flow-оор ажиллана.
 *
 * ⚠️ ЭНГИЙН БАЙЛГАХ НЬ ЧУХАЛ. Өмнө нь энд токены хугацаа шалгах, амжилтгүй
 * токен тэмдэглэх, session устгах, давхар sync хаах гэх мэт олон давхар
 * логик хуримтлагдаж, бие биенээ эвдэж байв. Одоо:
 *   - localStorage хоосон бол л sync хийнэ
 *   - Хугацааг ЗӨВХӨН СЕРВЕР шийднэ (401 → `api()` өөрөө refresh хийнэ)
 */
export function OAuthSessionSync() {
  const { data: session, status } = useSession();
  const syncFromOAuth = useAuth((s) => s.syncFromOAuth);
  const synced = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (synced.current) return;

    const accessToken = session?.accessToken;
    const refreshToken = session?.refreshToken;
    if (!accessToken || !refreshToken) return;

    // Аль хэдийн токентой бол гүүр хэрэггүй
    if (getAccessToken()) {
      synced.current = true;
      return;
    }

    synced.current = true;
    syncFromOAuth(accessToken, refreshToken).catch(() => {
      // Амжилтгүй бол дахин оролдох боломж үлдээнэ (шинэ session ирвэл)
      synced.current = false;
    });
  }, [session, status, syncFromOAuth]);

  return null;
}
