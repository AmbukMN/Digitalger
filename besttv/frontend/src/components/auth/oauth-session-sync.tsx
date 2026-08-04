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
    if (status !== 'authenticated') return;
    const accessToken = session?.accessToken;
    const refreshToken = session?.refreshToken;
    if (!accessToken || !refreshToken) return;
    if (synced.current === accessToken) return; // давхар sync хийхгүй

    synced.current = accessToken;
    // ⚠️ ЭХЛЭЭД цэвэрлэнэ — хуучин токеноор 401/refresh гогцоо үүсэхээс сэргийлнэ
    if (getAccessToken() !== accessToken) clearTokens();

    syncFromOAuth(accessToken, refreshToken).catch(() => {
      /**
       * ⚠️⚠️ SYNC УНАВАЛ SESSION-ЫГ УСТГАНА — ГАЦААНААС ГАРГАХ ЦОРЫН ГАНЦ ЗАМ.
       *
       * Өмнө нь `synced.current = null` тавьж "дахин оролдоно" гэсэн нь
       * МӨНХИЙН ГОГЦОО үүсгэж байв:
       *   session-ийн токен хүчингүй → /auth/me 401 → refresh ч амжилтгүй
       *   → synced тэглэгдэнэ → useSession дахин мэдэгдэнэ → ДАХИН sync
       *   → ДАХИН 401 ... эцэс төгсгөлгүй
       * Production console-д яг ийм: /api/auth/me 401 × 4, refresh огт үгүй.
       * Хэрэглэгч "Нэвтрэх" товч хараад л үлдэнэ, юу ч хийж чадахгүй.
       *
       * Session доторх токен сэргэхгүй нь тогтоогдсон тул тэр session
       * ХЭРЭГГҮЙ. Устгавал NextAuth `unauthenticated` болж, хэрэглэгч
       * ЦЭВЭР байдлаас дахин нэвтэрч чадна.
       */
      clearTokens();
      nextAuthSignOut({ redirect: false }).catch(() => null);
    });
  }, [session, status, syncFromOAuth]);

  return null;
}
