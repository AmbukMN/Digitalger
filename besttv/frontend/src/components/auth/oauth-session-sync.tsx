'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/lib/auth-store';
import { getAccessToken, getRefreshToken } from '@/lib/api';

/**
 * Google/Facebook signIn() амжилттай болмогц NextAuth session-д
 * backend-ийн accessToken/refreshToken гарч ирнэ (auth.ts callbacks.session).
 * Энэ мөрийг манай localStorage JWT (btv_access/btv_refresh) руу
 * нэг удаа хуулна — цаашид апп бүхэлдээ өөрийн JWT flow-оор ажиллана
 * (NextAuth session-ийг зөвхөн OAuth "гүүр" болгож ашиглана).
 *
 * ⚠️⚠️ ХАМГИЙН ЧУХАЛ АЛДАА — "browser хаагаад орохоор эрх татгалзана":
 *
 * NextAuth session нь 30 ХОНОГ амьдардаг (`auth.ts`: maxAge). Гэтэл түүний
 * дотор хадгалагдсан backend accessToken нь ердөө 15 МИНУТ. `jwt` callback
 * нь `if (user)` буюу ЗӨВХӨН ЭХНИЙ нэвтрэлтэд л токен бичдэг тул session
 * доторх токен ХЭЗЭЭ Ч ШИНЭЧЛЭГДДЭГГҮЙ — 30 хоногийн турш ХӨЛДӨНӨ.
 *
 * Иймд browser хаагаад маргааш нээхэд:
 *   1. session хүчинтэй хэвээр → status === 'authenticated'
 *   2. энэ компонент нь session доторх ХУГАЦАА ДУУССАН токеныг
 *      localStorage руу ДАРЖ бичнэ
 *   3. localStorage-д байсан ШИНЭХЭН (refresh-ээр сэргээгдсэн) токен
 *      устаж, /auth/me 401 буцаана
 *   4. api() refresh хийж шинэ токен авна ч, session дахин уншигдмагц
 *      мөн адил хуучин токеноор ДАХИН дарагдана → мөнхийн 401 гогцоо
 *
 * ЗАСВАР: localStorage-д АЛЬ ХЭДИЙН токен байвал ХЭЗЭЭ Ч дарж бичихгүй.
 * Синк нь зөвхөн ҮНЭХЭЭР ШИНЭ OAuth нэвтрэлтэд (localStorage хоосон үед)
 * хийгдэнэ. Токен хуучрах асуудлыг api() доторх refresh урсгал шийднэ —
 * refreshToken 30 хоног хүчинтэй тул хэрэглэгч дахин нэвтрэх шаардлагагүй.
 */
export function OAuthSessionSync() {
  const { data: session, status } = useSession();
  const syncFromOAuth = useAuth((s) => s.syncFromOAuth);
  const synced = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (synced.current) return;

    const accessToken = (session as { accessToken?: string } | null)?.accessToken;
    const refreshToken = (session as { refreshToken?: string } | null)?.refreshToken;
    if (!accessToken || !refreshToken) return;

    /**
     * ⚠️ Өөрийн JWT аль хэдийн байвал session-ийн ХУУЧИН токеноор
     * дарахгүй — дээрх тайлбарыг үз. Энэ мөр л 401 гогцоог таслана.
     */
    if (getAccessToken() || getRefreshToken()) {
      synced.current = true;
      return;
    }

    synced.current = true;
    syncFromOAuth(accessToken, refreshToken).catch(() => null);
  }, [session, status, syncFromOAuth]);

  return null;
}
