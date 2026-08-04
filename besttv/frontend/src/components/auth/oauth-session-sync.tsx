'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/lib/auth-store';
import { getAccessToken } from '@/lib/api';

/**
 * OAuth "гүүр" — Google/Facebook нэвтрэлтийн үр дүнг манай JWT flow руу
 * дамжуулна.
 *
 * ⚠️⚠️ SESSION-ИЙН `accessToken`-Г ОГТ ХЭРЭГЛЭХГҮЙ.
 *
 * NextAuth session нь 30 ХОНОГ амьдардаг ч дотор нь 15 МИНУТЫН access
 * token ЦАРЦСАН байдаг (`jwt` callback зөвхөн анхны нэвтрэлтэд бичдэг).
 * Тиймээс session-ийн `accessToken` нь бараг ҮРГЭЛЖ хугацаа нь дууссан
 * байдаг — production backend лог үүнийг олон удаа баталсан:
 *     [jwt] 401 /api/auth/me — TokenExpiredError: jwt expired
 *
 * Урьд нь тэр хуучин токеныг хадгалаад дараа нь засах гэж оролдож
 * байсан нь олон давхар логик (хугацаа шалгах, уралдаан хаах,
 * амжилтгүй токен тэмдэглэх) хуримтлуулж, бүгд бие биенээ эвдэж байв.
 *
 * ЗӨВ ЗАМ: session-ээс ЗӨВХӨН `refreshToken` (30 хоног — session-тэй
 * ижил урт) авч, түүгээр ШИНЭ access token авна. Хугацааны ямар ч
 * шалгалт хэрэггүй — сервер өөрөө шийднэ.
 */
export function OAuthSessionSync() {
  const { data: session, status } = useSession();
  const syncFromOAuth = useAuth((s) => s.syncFromOAuth);
  const done = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || done.current) return;

    const refreshToken = session?.refreshToken;
    if (!refreshToken) return;

    // Аль хэдийн токентой бол гүүр хэрэггүй
    if (getAccessToken()) {
      done.current = true;
      return;
    }

    done.current = true;
    syncFromOAuth(refreshToken).catch(() => {
      done.current = false; // шинэ session ирвэл дахин оролдоно
    });
  }, [session, status, syncFromOAuth]);

  return null;
}
