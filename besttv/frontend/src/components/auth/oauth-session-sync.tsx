'use client';

import { useEffect, useRef } from 'react';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { useAuth } from '@/lib/auth-store';
import { clearTokens, getAccessToken } from '@/lib/api';

/**
 * Google/Facebook signIn() амжилттай болмогц NextAuth session-д
 * backend-ийн accessToken/refreshToken гарч ирнэ (auth.ts callbacks.session).
 * Энэ мөрийг манай localStorage JWT (btv_access/btv_refresh) руу
 * нэг удаа хуулна — цаашид апп бүхэлдээ өөрийн JWT flow-оор ажиллана
 * (NextAuth session-ийг зөвхөн OAuth "гүүр" болгож ашиглана).
 */
/**
 * Sync хийхэд БҮТЭЛГҮЙТСЭН accessToken-ууд.
 * ⚠️ Компонентоос ГАДНА (модуль түвшинд) — re-mount болоход ч хадгалагдана.
 * Session cookie устгах оролдлого амжилтгүй болсон ч гогцоо үүсэхгүй.
 */
const failedTokens = new Set<string>();

/**
 * ⚠️ Явагдаж буй sync — ЗЭРЭГ хоёр sync ажиллуулахгүй.
 *
 * React StrictMode / re-render / `useSession` polling зэргээс болж энэ
 * effect олон удаа зэрэг ажилладаг. Тэр үед хоёр sync localStorage-ыг
 * бие биенийхээ доор дарж бичиж, "refresh 201 → me 401" гэсэн зөрчил
 * үүсгэдэг байв (production console-д баталсан).
 */
let syncing = false;

export function OAuthSessionSync() {
  const { data: session, status } = useSession();
  const syncFromOAuth = useAuth((s) => s.syncFromOAuth);
  const synced = useRef<string | null>(null);

  /**
   * ⚠️⚠️ НЭВТРЭЛТ ЦИКЛ БОЛЖ БАЙСНЫ ГОЛ ШАЛТГААН:
   *
   * localStorage-д ХУУЧИН токен (`btv_access`/`btv_refresh`) үлдсэн байхад
   * OAuth-аар нэвтэрвэл:
   *   1. Callback → NextAuth session үүснэ (ШИНЭ токентой)
   *   2. Гэтэл өөр компонентууд ХУУЧИН токеноор `/auth/me` дуудаж 401 авна
   *   3. `api()` тэр 401-д ХУУЧИН refresh-ээр шинэчилнэ → 201 буцна,
   *      гэхдээ энэ нь ӨӨР/ХУУЧИРСАН хэрэглэгчийн токен
   *   4. Дахин 401 → цикл → /login руу буцна
   *
   * Production логт яг ийм: session 200 → me 401 → refresh 201 → me 401.
   *
   * Засвар: sync-ийн ЭХНИЙ алхам болгож хуучин токеныг цэвэрлээд, ДАРАА нь
   * session-ийн токеныг хадгална — хоорондоо зөрөх агшин үүсэхгүй.
   */
  useEffect(() => {
    // ⚠️ ТҮР ОНОШИЛГОО — sync хаана зогсож байгааг харуулна
    console.log('[sync]', {
      status,
      session: session?.accessToken ? 'токентой' : 'ТОКЕНГҮЙ',
      localStorage: getAccessToken() ? 'токентой' : 'ХООСОН',
    });

    if (status !== 'authenticated') return;
    const accessToken = session?.accessToken;
    const refreshToken = session?.refreshToken;
    if (!accessToken || !refreshToken) {
      console.warn('[sync] session-д токен АЛГА — гүүр ажиллахгүй');
      return;
    }
    if (synced.current === accessToken) return; // давхар sync хийхгүй
    if (syncing) return; // ⚠️ өөр sync явж байна — уралдаан үүсгэхгүй

    /**
     * ⚠️⚠️ БҮТЭЛГҮЙТСЭН ТОКЕНЫГ ДАХИН ХЭЗЭЭ Ч ОРОЛДОХГҮЙ.
     *
     * Production nginx лог (12:41:00) — гогцооны бодит хэлбэр:
     *   refresh 201 → me 401 → refresh 201 → me 401 → refresh 201 → me 401
     *   → signout 200 → session 200 (498 байт = ХЭРЭГЛЭГЧТЭЙ, УСТААГҮЙ!)
     *
     * `signOut({redirect:false})` нь cookie-г үргэлж НАЙДВАРТАЙ устгадаггүй.
     * Устгаагүй бол `useSession` дахин `authenticated` мэдэгдэж, sync
     * дахин ажиллаад мөнхийн гогцоо үргэлжилнэ.
     *
     * Тиймээс session-д найдахаа болиод, БҮТЭЛГҮЙТСЭН токеныг өөрийг нь
     * тэмдэглэнэ. Тэр токен дахин ирвэл ОГТ оролдохгүй → гогцоо таслагдана.
     */
    if (failedTokens.has(accessToken)) return;

    /**
     * ⚠️⚠️⚠️ ГОЛ ШАЛТГААН — SESSION-ИЙН ХУУЧИН ТОКЕНЫГ ДАХИН БИЧИХ.
     *
     * NextAuth session нь 30 ХОНОГ амьдардаг ч дотор нь 15 МИНУТЫН
     * access token ЦАРЦСАН байдаг (`jwt` callback зөвхөн анхны нэвтрэлтэд
     * бичдэг). Тэр токен удалгүй хугацаа нь дуусна.
     *
     * Production console-оос барьсан гогцоо:
     *   api() refresh → ШИНЭ токен хадгална ✅ (лог: "таарсан: тийм")
     *   → sync ДАХИН ажиллаж session-ийн ХУУЧИН токеныг дарж бичнэ ❌
     *   → /auth/me 401 → refresh → sync дахин дарна → эцэс төгсгөлгүй
     *
     * Тиймээс localStorage-д АЛЬ ХЭДИЙН токен байвал sync ОГТ ХИЙХГҮЙ.
     * OAuth "гүүр" нь зөвхөн токен АЛГА үед л хэрэгтэй.
     *
     * ⚠️⚠️ ХУГАЦААГ ЭНД ШАЛГАХГҮЙ. Өмнө нь `Date.now()`-оор `exp`-г
     * шалгадаг байсан нь ЭМЗЭГ: хэрэглэгчийн төхөөрөмжийн цаг зөрвөл
     * буруу шийдвэр гаргана (сервер Герман, хэрэглэгч Монголд —
     * production-д яг ийм асуудал гарсан). Хугацааг ЗӨВХӨН СЕРВЕР
     * шийднэ: токен хуучирсан бол `api()` 401 аваад refreshToken-оор
     * автоматаар сэргээнэ.
     */
    if (getAccessToken()) {
      synced.current = accessToken; // дахин шалгахгүй
      return;
    }

    synced.current = accessToken;
    // ⚠️ ЭХЛЭЭД цэвэрлэнэ — хуучин токеноор 401/refresh гогцоо үүсэхээс сэргийлнэ
    if (getAccessToken() !== accessToken) clearTokens();

    syncing = true;
    syncFromOAuth(accessToken, refreshToken)
      .then(() => console.log('[sync] ✅ АМЖИЛТТАЙ — нэвтэрлээ'))
      .catch((e) => {
        console.error('[sync] ❌ УНАЛАА —', e?.message ?? e);
        failedTokens.add(accessToken);
        clearTokens();
        // Session-ыг устгах оролдлого (амжилтгүй болсон ч дээрх хамгаалалт
        // гогцоог таслах тул хэрэглэгч гацахгүй).
        nextAuthSignOut({ redirect: false }).catch(() => null);
      })
      .finally(() => {
        syncing = false;
      });
  }, [session, status, syncFromOAuth]);

  return null;
}
