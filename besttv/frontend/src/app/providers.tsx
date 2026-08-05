'use client';

import { useEffect, useState } from 'react';
import { SessionProvider, signOut as nextAuthSignOut } from 'next-auth/react';
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

  const { data, error } = useQuery({
    queryKey: ['auth-watch', userId],
    queryFn: () => api<AuthUser>('/auth/me'),
    enabled: !!userId && !!getAccessToken(),
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (data) useAuth.getState().setUser(data);
  }, [data]);

  /**
   * ⚠️⚠️ `instanceof ApiError` ХЭРЭГЛЭХГҮЙ.
   *
   * Production build minify хийгдэхэд ApiError класс өөр chunk-д хуулбарлагдаж,
   * `instanceof` нь ХУДАЛ буцаадаг. Тэр үед 401 хэзээ ч баригдахгүй тул
   * хүчингүй токен цэвэрлэгдэхгүй, хэрэглэгч мөнхийн 401 гогцоонд ордог.
   * Иймд төрлөөр биш, ТАЛБАРААР шалгана.
   *
   * ⚠️ Мөн NextAuth session-ийг ЗААВАЛ signOut хийнэ — эс бөгөөс дараагийн
   * ачаалалд OAuthSessionSync нь session доторх ХУУЧИН токеныг дахин бичнэ.
   */
  useEffect(() => {
    const status = (error as { status?: number } | null)?.status;
    if (status && [401, 403, 404].includes(status)) {
      clearTokens();
      useAuth.getState().setUser(null);
      nextAuthSignOut({ redirect: false }).catch(() => null);
    }
  }, [error]);

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
