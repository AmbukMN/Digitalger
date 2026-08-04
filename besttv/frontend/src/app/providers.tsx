'use client';

import { useEffect, useState } from 'react';
import { SessionProvider, signOut as nextAuthSignOut, useSession } from 'next-auth/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { UiProvider } from '@besttv/shared/ui';
import { useAuth, type AuthUser } from '@/lib/auth-store';
import { useMyListStore } from '@/lib/my-list-store';
import { api, clearTokens, getAccessToken } from '@/lib/api';
import { OAuthSessionSync } from '@/components/auth/oauth-session-sync';
import { PageTracker } from '@/components/page-tracker';

/** Нэвтэрсэн хэрэглэгч өөрчлөгдөх бүрт (login/guest/logout) my-list-ийг realtime sync хийнэ */
function MyListSync() {
  const userId = useAuth((s) => s.user?.id);
  const hydrate = useMyListStore((s) => s.hydrate);
  const hydrateGuest = useMyListStore((s) => s.hydrateGuest);

  useEffect(() => {
    // ⚠️ Зочин ч дуртай кино цуглуулна (localStorage). Нэвтрэхэд hydrate нь
    // зочны жагсаалтыг сервер рүү нийлүүлнэ.
    if (userId) hydrate();
    else hydrateGuest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return null;
}

/**
 * Session-ийн бодит төлөв (эрх/block) 45 секунд тутам + tab-руу буцах үед
 * дахин шалгаж, browser refresh хийлгүйгээр UI-г шинэчилнэ. Жишээ нь:
 * admin-аас premium эрх олгосон, эсвэл хэрэглэгчийг blocked хийсэн тохиолдол.
 */
function AuthSessionWatcher() {
  const userId = useAuth((s) => s.user?.id);
  const { status: oauthStatus } = useSession();

  /**
   * ⚠️⚠️ OAUTH НЭВТРЭЛТ ЦИКЛ БОЛЖ БАЙСНЫ ШАЛТГААН:
   *
   * Google-ээр нэвтрэхэд урсгал ингэж эвдэрдэг байв:
   *   1. OAuth амжилттай → NextAuth session үүснэ
   *   2. `OAuthSessionSync` ШИНЭ токен хадгалж `refreshMe()` дуудна
   *   3. ГЭТЭЛ энэ watcher нь ХУУЧИН/ХООСОН токеноор ЗЭРЭГ `/auth/me`
   *      дуудаад 401 авна
   *   4. Тэр 401-ийг барьж `clearTokens()` + `signOut()` хийнэ
   *   5. Сая хадгалсан ШИНЭ токен УСТАНА → "Нэвтрэх" товч буцаж гарна
   *
   * Production логт яг ийм харагдсан:
   *   callback/google 302 → session 200 → me 401 ×4 → /login
   *
   * Засвар 1: NextAuth session `loading` үед watcher ОГТ ажиллахгүй
   *           (OAuth sync дуустал хүлээнэ).
   */
  const ready = oauthStatus !== 'loading';

  const { data, error } = useQuery({
    queryKey: ['auth-watch', userId],
    queryFn: () => api<AuthUser>('/auth/me'),
    enabled: ready && !!userId && !!getAccessToken(),
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    // ⚠️ 401-д АВТОМАТ дахин оролдохгүй — доорх logout логик шийднэ
    retry: false,
  });

  useEffect(() => {
    if (data) useAuth.getState().setUser(data);
  }, [data]);

  /**
   * Засвар 2: OAuth session АМЖИЛТТАЙ байхад 401 гарвал энд гаргахгүй —
   * `OAuthSessionSync` токеныг сольж сэргээнэ.
   *
   * ⚠️ Sync амжилтгүй болбол ТЭР ӨӨРӨӨ session-ийг устгана (гацахгүй).
   * Тиймээс энд хугацаа хэмжих/албадан гаргах шаардлагагүй — давхар
   * логик нь сая нэвтэрсэн хэрэглэгчийг буруугаар гаргах эрсдэлтэй.
   */
  useEffect(() => {
    /**
     * ⚠️⚠️ `instanceof` БИШ, ТАЛБАРААР шалгана — ЭНЭ НЬ НЭВТРЭЛТ ЭВДЭЖ БАЙВ.
     *
     * Production build-д `ApiError` класс минифай хийгдэж, өөр chunk-д
     * хуулагдвал `error instanceof ApiError` ХУДАЛ буцаана. Тэр үед энэ
     * effect шууд `return` хийж, 401 гарсан ч токен цэвэрлэгдэхгүй,
     * session устахгүй → хэрэглэгч мөнхийн 401 дээр гацна.
     *
     * Яг ижил алдаа админы зураг upload-д гарч байсныг өмнө нь зассан
     * (`admin/src/lib/upload.ts` — тэнд ч `instanceof` талбар шалгалт
     * болсон). Энэ бол ижил алдааны frontend дэх ХОСМОГ нь.
     */
    const status = (error as { status?: number } | null)?.status;
    if (typeof status !== 'number' || ![401, 403, 404].includes(status)) return;

    const bail = () => {
      clearTokens();
      useAuth.getState().setUser(null);
      nextAuthSignOut({ redirect: false }).catch(() => null);
    };

    /**
     * ⚠️⚠️ NextAuth session БАЙВАЛ ГАРГАХГҮЙ.
     *
     * Хэрэглэгч Google/Facebook-ээр саяхан нэвтэрсэн бол session хүчинтэй.
     * Тэр үед 401 гарах нь ЗӨВХӨН токен sync хийгдэж дуусаагүйгээс —
     * `OAuthSessionSync` шинэ токеноор сэргээнэ. Энд хүчээр гаргавал
     * САЯ АМЖИЛТТАЙ нэвтэрсэн хэрэглэгчийг буцаана (яг тэр алдаа
     * production дээр гарч байв).
     *
     * Session үнэхээр хүчингүй бол NextAuth өөрөө `unauthenticated`
     * болгоно — тэр үед доорх `bail()` ажиллана.
     */
    if (oauthStatus === 'authenticated') return;
    bail();
  }, [error, oauthStatus]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } }),
  );
  const init = useAuth((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <SessionProvider>
      <QueryClientProvider client={client}>
        <UiProvider theme="dark">
          <OAuthSessionSync />
          <MyListSync />
          <AuthSessionWatcher />
          <PageTracker />
          {children}
        </UiProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
