'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UiProvider } from '@besttv/shared/ui';
import { useAdminAuth } from '@/lib/auth-store';

export function Providers({ children }: { children: React.ReactNode }) {
  /**
   * ⚠️⚠️ АДМИН ПАНЕЛД ХУУЧИН ДАТА ХАРУУЛАХГҮЙ.
   *
   * 11 query hook (`useAdminGenres`, `useAdminPlans`, `useAdminCoupons`,
   * `useAdminBankSettings`, `*Counts`...) нь `staleTime` заагаагүй байв.
   * Одоо TanStack-ийн үндсэн утга (0 + focus refetch) аз болж таарч
   * байгаа ч ирээдүйд хэн нэгэн `defaultOptions` нэмэх мөчид тэдгээр
   * чимээгүй хуучирна.
   *
   * ⚠️ Тиймээс ЭНД илэрхий тогтооно — админ өөр табаас өгөгдөл
   * өөрчилчихөөд буцаж ирэхэд ШИНЭ утга харна.
   *
   * ⚠️ `retry: 1` — админ панел дотоод сүлжээнд, 3 удаа дахин
   * оролдох нь алдааг харуулахыг 10+ секунд хойшлуулна.
   */
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );
  const init = useAdminAuth((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <QueryClientProvider client={client}>
      {/* Toast + confirm/prompt модалыг нэг дор — window.confirm/alert ХЭРЭГЛЭХГҮЙ */}
      <UiProvider theme="dark">{children}</UiProvider>
    </QueryClientProvider>
  );
}
