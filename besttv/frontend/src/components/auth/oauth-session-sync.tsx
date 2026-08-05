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
    /**
     * ⚠️⚠️ Session-д токен БАЙХГҮЙ ч ГАРАХГҮЙ — `/api/auth/bridge`-ээр сэргээнэ.
     *
     * Өмнө нь энд `if (!accessToken || !refreshToken) return;` гэж эрт
     * гардаг байв. Гэтэл session нь backend restart-аас ӨМНӨ үүссэн,
     * эсвэл `jwt` callback токен бичээгүй тохиолдолд session ХҮЧИНТЭЙ
     * мөртлөө доторх токен ХООСОН байдаг. Тэр үед хэрэглэгч сэргэх
     * ямар ч зам үлдэхгүй гацдаг байв (бодит гомдол).
     * Одоо session хүчинтэй л бол bridge-ээр ШИНЭ токен авна.
     */

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
    /**
     * ⚠️⚠️ ХҮЧИНГҮЙ токеныг СЭРГЭЭНЭ (зөвхөн "байгаа эсэх" биш).
     *
     * Өмнө нь `getAccessToken() || getRefreshToken()` гэж ЗӨВХӨН БАЙГАА
     * эсэхийг шалгадаг байв. Гэтэл localStorage-д ХУГАЦАА ДУУССАН токен
     * байхад ч энэ нөхцөл үнэн болж, session-ээс сэргээхгүй буцдаг байв.
     * Үр дүнд: NextAuth cookie 30 хоног хүчинтэй БАЙХАД хэрэглэгч
     * "нэвтрэх боломжгүй" гацдаг (бодит гомдол — DevTools-д btv_access,
     * btv_refresh ХОЁУЛАА байсан ч /auth/me 401 буцаж байсан).
     *
     * Одоо ХОЁУЛАА хүчингүй бол session-ийн токеноор СЭРГЭЭНЭ.
     * Нэг нь ч хүчинтэй бол хөндөхгүй (шинэ токеныг хуучнаар дарахгүй).
     */
    /**
     * ⚠️ ЦАГААС ХАМААРАХГҮЙ — зөвхөн "байгаа эсэх"-ийг шалгана.
     *
     * Өмнө нь `isJwtExpired()`-ээр хугацааг client тал шалгадаг байв.
     * Хэрэглэгчийн цаг буруу бол буруу шийдвэр гарна. Хугацааны
     * шийдвэрийг СЕРВЕР гаргана: токен хүчингүй бол `api()` дотор
     * 401 → refresh → амжилтгүй бол clearTokens() хийгдэнэ. Тэр үед
     * localStorage хоосорч, энэ effect дараагийн render-д session-ээс
     * СЭРГЭЭНЭ. Ингэснээр гацах ч үгүй, буруу шийдвэр ч гарахгүй.
     */
    if (getAccessToken() || getRefreshToken()) return;

    /**
     * Гогцоо хамгаалалт — нэг хуудасны амьдралд НЭГ л удаа сэргээнэ.
     * (session доторх токен байхгүй ч байж болох тул түлхүүр нь
     * хэрэглэгчийн ID эсвэл 'bridge' тогтмол)
     */
    const key = accessToken ?? `bridge:${(session?.user as { id?: string })?.id ?? '1'}`;
    if (syncedToken.current === key) return;
    syncedToken.current = key;

    /**
     * ⚠️⚠️ ҮРГЭЛЖ `/api/auth/bridge`-ЭЭР ШИНЭ ТОКЕН АВНА.
     *
     * ЯАГААД session доторх токеныг ШУУД ХЭРЭГЛЭХГҮЙ ВЭ:
     * NextAuth session 30 хоног амьдардаг ч доторх accessToken ердөө
     * 15 минут. Түүгээр шууд синк хийвэл ХУГАЦАА ДУУССАН токен
     * localStorage-д бичигдэж, бүх хүсэлт 401 болно.
     *
     * ЯАГААД "хүчинтэй эсэхийг шалгаад" гэж ХИЙХГҮЙ ВЭ:
     * Тэр шалгалт нь хэрэглэгчийн компьютерийн цагаас хамаарна. Цаг
     * буруу тохируулсан хэрэглэгч МАШ ОЛОН — тэдэнд буруу шийдвэр
     * гарч, мөнхийн 401 гогцоонд ордог (бодит алдаа).
     *
     * Bridge нь СЕРВЕР талд session-ийг баталгаажуулж, backend-ээс
     * ЦОО ШИНЭ токен авдаг тул цагаас бүрэн хамааралгүй, үргэлж зөв.
     */
    fetch('/api/auth/bridge', { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d: { accessToken: string; refreshToken: string } | null) => {
        if (d?.accessToken && d?.refreshToken) {
          return syncFromOAuth(d.accessToken, d.refreshToken);
        }
        return null;
      })
      .catch(() => null);
  }, [session, status, syncFromOAuth]);

  return null;
}
