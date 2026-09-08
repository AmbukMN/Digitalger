'use client';

import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UiProvider } from '@besttv/shared/ui';
import { useAdminAuth } from '@/lib/auth-store';
import { useSiteStore } from '@/lib/site-store';

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

  /**
   * ⚠️⚠️ САЙТ СОЛИХОД КЭШИЙГ БҮРЭН ЦЭВЭРЛЭНЭ.
   *
   * БОДИТ ЭРСДЭЛ: TanStack Query нь түлхүүрээр (`['users']`) кэшилдэг.
   * Түлхүүрт сайт ОРООГҮЙ тул BestTV-ээс BestFilm рүү шилжихэд
   * ХУУЧИН ЖАГСААЛТ харагдана — админ BestTV-ийн хэрэглэгчийг
   * BestFilm-ийнх гэж бодоод устгаж болзошгүй.
   *
   * ⚠️ ЯАГААД `clear()`, `invalidateQueries()` БИШ: invalidate нь
   * хуучин өгөгдлийг ХАРУУЛСААР дахин татдаг (stale-while-revalidate).
   * Хормын зуур ч буруу сайтын өгөгдөл харагдах нь аюултай.
   * `clear()` нь skeleton харуулаад шинээр татна.
   *
   * ⚠️ Эхний ачаалалт дээр ажиллуулахгүй (`prev.current` шалгалт) —
   * эс бөгөөс хуудас нээх бүрд хоосон кэшээс эхэлнэ.
   */
  const site = useSiteStore((s) => s.site);
  const prevSite = useRef(site);
  useEffect(() => {
    if (prevSite.current === site) return;
    prevSite.current = site;
    client.clear();
  }, [site, client]);

  return (
    <QueryClientProvider client={client}>
      {/* Toast + confirm/prompt модалыг нэг дор — window.confirm/alert ХЭРЭГЛЭХГҮЙ */}
      <UiProvider theme="dark">{children}</UiProvider>
    </QueryClientProvider>
  );
}
