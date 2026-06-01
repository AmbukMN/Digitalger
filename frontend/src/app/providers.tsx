'use client';

import { ThemeProvider } from '@digitalger/shared/ui';
import type { Theme } from '@digitalger/shared/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { SessionProvider } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { signOut } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import { useCouponStore } from '@/store/coupon';
import { downloadsApi, wishlistApi, usersApi } from '@/lib/api';
import type { NavbarPrefetch } from '@/lib/api';

const VERIFY_TOAST_KEY = 'dg-verify-toast-shown';

// Realtime бүртгэл хяналт: админ хэрэглэгчийг блоклосон/устгасан үед
// тухайн хэрэглэгчийг бүх хуудсанд автоматаар гаргана (сайт удаашруулахгүйгээр).
//
// Хэрхэн ажилладаг:
// - Зөвхөн НЭВТЭРСЭН хэрэглэгчид л ажиллана (enabled: !!token) — зочинд fetch хийхгүй.
// - 45 секунд тутамд + таб руу буцаж ирэх (window focus) бүрд /users/me-г шалгана.
//   /users/me нь маш хөнгөн (1 мөр select) тул ачаалал бараг тэг.
// - backend jwt.strategy блоклосон/устсан үед 401 шиддэг → энд барьж signOut хийнэ.
function AuthWatcher() {
  const { data: session, status } = useSession();
  const token = session?.accessToken;

  const { error } = useQuery({
    queryKey: ['auth-watch', token],
    queryFn: () => usersApi.me(token!),
    enabled: status === 'authenticated' && !!token,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: token ? 45_000 : false, // idle үед 45с тутам
    refetchIntervalInBackground: false,       // нуугдсан таб дээр сэмжихгүй
    refetchOnWindowFocus: true,               // таб руу буцахад шууд шалгана
  });

  useEffect(() => {
    const s = (error as any)?.status;
    // blocked/устсан/токен хүчингүй → 401/403/404. Шууд гаргана.
    if (s === 401 || s === 403 || s === 404) {
      toast.error('Таны бүртгэл идэвхгүй болсон байна');
      signOut({ callbackUrl: '/' });
    }
  }, [error]);

  return null;
}

// Zustand persist store-уудыг SSR-ийн дараа нэг л удаа rehydrate хийнэ.
// skipHydration:true тохиргоотой хамт ажиллана — hydration mismatch арилна.
function StoreHydration() {
  useEffect(() => {
    useCartStore.persist.rehydrate();
    useWishlistStore.persist.rehydrate();
    useCouponStore.persist.rehydrate();
  }, []);
  return null;
}

// Нэвтрэхэд: сагс + wishlist давхардал шийдэх + email verify reminder
function SessionSyncEffect() {
  const { data: session, status } = useSession();
  const removePurchased = useCartStore((s) => s.removePurchased);
  const mergeWishlist = useWishlistStore((s) => s.mergeFromBackend);
  const wishlistItems = useWishlistStore((s) => s.items);
  const syncedRef = useRef<string | null>(null);

  // Email verify toast — session-once (зөвхөн баталгаажуулаагүй хэрэглэгчид)
  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return;
    const user = session.user as any;
    if (!user || user.isGuest || user.oauthProvider) return;
    if (user.emailVerified) return;
    const shown = sessionStorage.getItem(VERIFY_TOAST_KEY);
    if (shown) return;
    const t = setTimeout(() => {
      sessionStorage.setItem(VERIFY_TOAST_KEY, '1');
      toast.warning('И-мэйл баталгаажаагүй байна', {
        description: 'Профайл хуудсаа нээж и-мэйл хаягаа баталгаажуулна уу.',
        duration: 8000,
        action: {
          label: 'Профайл',
          onClick: () => { window.location.href = '/profile'; },
        },
      });
    }, 3000);
    return () => clearTimeout(t);
  }, [status, session?.accessToken]);

  // Guest recommendation notice — session-once
  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return;
    const user = session.user as any;
    if (!user?.isGuest) return;
    const shown = sessionStorage.getItem('dg-guest-notice-shown');
    if (shown) return;
    const t = setTimeout(() => {
      sessionStorage.setItem('dg-guest-notice-shown', '1');
      toast.info('Та зочноор нэвтэрч байна', {
        description: 'И-мэйл бүртгэл үүсгэснээр худалдан авалтын түүх, татаж авах боломжтой болно.',
        duration: 10000,
        action: {
          label: 'Бүртгүүлэх',
          onClick: () => { window.location.href = '/profile'; },
        },
      });
    }, 5000);
    return () => clearTimeout(t);
  }, [status, session?.accessToken]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return;
    // ижил session-д 2 удаа sync хийхгүй
    if (syncedRef.current === session.accessToken) return;
    syncedRef.current = session.accessToken;

    const token = session.accessToken;

    // 1. Худалдаж авсан бүтээгдэхүүнүүдийг сагснаас хас
    downloadsApi.history(token).then((purchased) => {
      const purchasedIds = purchased.map((p) => p.product.id);
      if (purchasedIds.length > 0) removePurchased(purchasedIds);
    }).catch(() => {});

    // 2. Wishlist: localStorage-аас backend руу sync, backend-ийн жагсаалтыг нэгтгэнэ
    wishlistApi.list(token).then(async (backendItems) => {
      // localStorage-т байгаа гэхдээ backend-д байхгүй items-ийг нэмнэ
      const backendIds = new Set(backendItems.map((i) => i.product.id));
      const localOnly = wishlistItems.filter((i) => !backendIds.has(i.id));
      for (const item of localOnly) {
        try {
          await wishlistApi.toggle(token, item.id);
        } catch { /* continue */ }
      }
      // backend-ийн final state татаж local-тай merge хийнэ
      const finalList = await wishlistApi.list(token);
      mergeWishlist(finalList.map((i) => i.product));
    }).catch(() => {});
  }, [status, session?.accessToken, removePurchased, mergeWishlist, wishlistItems]);

  return null;
}

interface ProvidersProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  navbar?: NavbarPrefetch;
}

export function Providers({ children, defaultTheme = 'system', navbar }: ProvidersProps) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60_000, retry: 1 },
      },
    });
    // Server дээр prefetch хийсэн меню/settings-ийг cache-д суулгана.
    // Navbar-ийн useQuery эдгээрийг анхны render-ээс шууд олж бодит утгаар
    // харуулна → cache-гүй ачаалал дээр flash/үсрэлт гарахгүй.
    if (navbar?.menu) {
      client.setQueryData(['public', 'menu'], navbar.menu);
    }
    if (navbar?.settings) {
      client.setQueryData(['public', 'settings'], navbar.settings);
    }
    return client;
  });

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme={defaultTheme} storageKey="digitalger-theme">
          <StoreHydration />
          <SessionSyncEffect />
          <AuthWatcher />
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
