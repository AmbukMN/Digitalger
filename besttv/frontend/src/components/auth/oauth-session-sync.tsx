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
  /** Аль accessToken-оор сүүлд синк хийснийг санана (давхар синк хийхгүй) */
  const syncedToken = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const accessToken = (session as { accessToken?: string } | null)?.accessToken;
    const refreshToken = (session as { refreshToken?: string } | null)?.refreshToken;
    if (!accessToken || !refreshToken) return;

    /**
     * ⚠️ Өөрийн JWT аль хэдийн байвал session-ийн ХУУЧИН токеноор
     * ДАРАХГҮЙ — дээрх тайлбарыг үз. Энэ нөхцөл 401 гогцоог таслана.
     *
     * ⚠️⚠️ ЧУХАЛ: энд `synced` ТУГ ТАВИХГҮЙ.
     * Өмнө нь энд туг тавьдаг байсан нь ХАГАС ТӨЛӨВ үүсгэдэг байв:
     * хуудас ачаалахад токен байвал туг тавигдана → дараа нь 401 гарч
     * clearTokens() хийгдэхэд localStorage хоосорно → гэтэл туг тавигдсан
     * тул ДАХИН СИНК ХИЙГДЭХГҮЙ → NextAuth session хүчинтэй хэвээр
     * мөртлөө хэрэглэгч токенгүй = "нэвтэрсэн байтлаа гарсан" төлөв.
     * Одоо токен байвал зүгээр л буцна — дараагийн удаа (токен алга
     * болсон бол) энэ effect дахин ажиллаж СЭРГЭЭНЭ.
     */
    if (getAccessToken() || getRefreshToken()) return;

    // Ижил токеноор дахин дахин синк хийхээс сэргийлнэ (гогцоо хамгаалалт)
    if (syncedToken.current === accessToken) return;
    syncedToken.current = accessToken;

    syncFromOAuth(accessToken, refreshToken).catch(() => null);
  }, [session, status, syncFromOAuth]);

  return null;
}
