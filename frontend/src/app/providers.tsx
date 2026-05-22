'use client';

import { ThemeProvider } from '@digitalger/shared/ui';
import type { Theme } from '@digitalger/shared/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { SessionProvider } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { Toaster } from 'sonner';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import { downloadsApi, wishlistApi } from '@/lib/api';

// Нэвтрэхэд: сагс + wishlist давхардал шийдэх
function SessionSyncEffect() {
  const { data: session, status } = useSession();
  const removePurchased = useCartStore((s) => s.removePurchased);
  const mergeWishlist = useWishlistStore((s) => s.mergeFromBackend);
  const wishlistItems = useWishlistStore((s) => s.items);
  const syncedRef = useRef<string | null>(null);

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
}

export function Providers({ children, defaultTheme = 'system' }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1 },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme={defaultTheme} storageKey="digitalger-theme">
          <SessionSyncEffect />
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
