'use client';

import { useEffect, useRef, useState } from 'react';
import { SessionProvider, signOut as nextAuthSignOut } from 'next-auth/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from 'next-themes';
import { UiProvider } from '@besttv/shared/ui';
import { useAuth, type AuthUser } from '@/lib/auth-store';
import { useBrand } from '@/lib/queries';
import { useMyListStore } from '@/lib/my-list-store';
import { api, clearTokens, getAccessToken, getRefreshToken } from '@/lib/api';
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
    /**
     * ⚠️ `getRefreshToken()` ч хангалттай: access 15 минутын дараа
     * дуусдаг тул түүнийг шаардвал watcher унтарч, эрхийн өөрчлөлт
     * (багц авсан, блоклогдсон) UI-д тусахаа болино. api() нь refresh-ээр
     * access-ыг өөрөө сэргээнэ.
     */
    enabled: !!userId && !!(getAccessToken() || getRefreshToken()),
    refetchInterval: 180_000,
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
  /**
   * ⚠️⚠️ ЗӨВХӨН ТОКЕН ҮНЭХЭЭР УСТСАН ҮЕД гаргана.
   *
   * ЯАГААД: `api()` дотор 401 гарвал refresh автоматаар оролддог бөгөөд
   * үр дүнг ӨӨРӨӨ зөв боловсруулна:
   *   - 'ok'      → дахин хүсэлт явуулна (алдаа гарахгүй)
   *   - 'invalid' → clearTokens() хийнэ (сервер хүчингүй гэж БАТАЛСАН)
   *   - 'network' → токеныг ЗОРИУД ХАДГАЛНА (түр саатал, дараа сэргэнэ)
   *
   * Гэтэл 'network' үед ч эцэст нь ApiError(401) шидэгддэг. Хэрэв энд
   * ялгалгүй clearTokens() хийвэл ТҮР СҮЛЖЭЭНИЙ СААТЛААС болж 30 хоногийн
   * refresh token устаж, хэрэглэгч шалтгаангүй гардаг байв
   * (Монгол↔Герман хооронд сүлжээ тогтворгүй тул бодит эрсдэл).
   *
   * Иймд `getRefreshToken()` шалгана: api() аль хэдийн цэвэрлэсэн бол
   * (үнэхээр хүчингүй) л UI-г гаргана. Токен хэвээр байвал түр саатал
   * гэж үзэж, ЮУ Ч ХИЙХГҮЙ — дараагийн refetch-д өөрөө сэргэнэ.
   * ⚠️ 45 секунд → 3 минут: нээлттэй таб бүрээс цагт 80 хүсэлт
   * явдаг байв. `refetchOnWindowFocus` нь шуурхай байдлыг аль
   * хэдийн хангадаг тул интервал ойрхон байх шаардлагагүй.
   */
  useEffect(() => {
    const status = (error as { status?: number } | null)?.status;
    if (!status || ![401, 403, 404].includes(status)) return;
    if (getRefreshToken()) return; // түр саатал — токен хэвээр, бүү гарга

    clearTokens();
    useAuth.getState().setUser(null);
    nextAuthSignOut({ redirect: false }).catch(() => null);
  }, [error]);

  return null;
}

/**
 * Toast (sonner) нь идэвхтэй theme-ийг ДАГАНА.
 *
 * ⚠️ `UiProvider theme="dark"` гэж ХАТУУ бичсэн байсан тул light mode-д
 * цагаан дэвсгэр дээр хар toast гарч, харагдац зөрчилддөг байв.
 * `resolvedTheme` нь "system" сонголтыг ч бодит утга болгож өгнө.
 */
function ThemedUi({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  return <UiProvider theme={resolvedTheme === 'light' ? 'light' : 'dark'}>{children}</UiProvider>;
}

/**
 * АДМИНААС тохируулсан анхдагч өнгөний горимыг АНХНЫ зочинд хэрэглэнэ.
 *
 * ⚠️⚠️ ЗӨВХӨН СОНГОЛТ ХИЙГЭЭГҮЙ хэрэглэгчид. `next-themes` нь хэрэглэгч
 * товч дарахад `btv_theme`-д бичдэг. Тэр түлхүүр байгаа бол хэрэглэгч
 * өөрөө шийдсэн гэсэн үг — админ ДАРЖ БИЧВЭЛ сонголт нь бүрмөсөн
 * ажиллахгүй болно (товч дарахад нүд ирмэхэд эргээд буцна).
 *
 * ⚠️ `system` сонголтыг `next-themes` өөрөө боловсруулна (үйлдлийн
 * системийн `prefers-color-scheme`-ийг дагана).
 */
function BrandThemeSync() {
  const { data: brand } = useBrand();
  const { setTheme } = useTheme();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || !brand?.defaultTheme) return;
    applied.current = true;

    let userChose = false;
    try {
      userChose = localStorage.getItem('btv_theme') !== null;
    } catch {
      /* storage хаалттай — админы утгыг хэрэглэнэ */
    }
    if (!userChose) setTheme(brand.defaultTheme);
  }, [brand?.defaultTheme, setTheme]);

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
    /**
     * ⚠️ `attribute="class"` — Tailwind-ийн `.dark` class-ыг `<html>`-д тавина
     * (shared/globals.css нь `:root` = light, `.dark` = dark гэж тодорхойлсон).
     * ⚠️ `defaultTheme="dark"` — BestTV бол кино сайт, анхдагч нь бараан.
     * ⚠️ `disableTransitionOnChange` — theme солиход бүх элемент зэрэг
     *    шилжиж "анивчдаг" эффект гарахаас сэргийлнэ.
     */
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      /**
       * ⚠️ `enableSystem` ЗААВАЛ — админ "Системийн дагуу" сонголт
       * хийвэл `next-themes` нь `prefers-color-scheme`-ийг дагах ёстой.
       * `false` байвал тэр сонголт ЧИМЭЭГҮЙ ажиллахгүй болно.
       */
      enableSystem
      disableTransitionOnChange
      storageKey="btv_theme"
    >
      <SessionProvider>
        <QueryClientProvider client={client}>
          <ThemedUi>
            <BrandThemeSync />
            <OAuthSessionSync />
            <MyListSync />
            <AuthSessionWatcher />
            <PageTracker />
            {children}
          </ThemedUi>
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
