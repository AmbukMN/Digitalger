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
            /**
             * ⚠️⚠️ САЙТЫГ КЭШИЙН ТҮЛХҮҮРТ АВТОМАТААР ОРУУЛНА.
             *
             * БОДИТ АЛДАА (2026-09-08): сайт солиход хуудас гацаж,
             * skeleton удаан эргэлдээд зөвхөн F5 дарахад солигддог
             * байв.
             *
             * Шалтгаан: 173 `queryKey` нь сайтын нэргүй (`['users']`).
             * Сайт солиход `client.clear()` дуудагддаг байсан ч
             * `clear()` нь кэшийг УСТГАДАГ, дахин татахыг ЭХЛҮҮЛДЭГГҮЙ
             * — идэвхтэй observer-ууд `pending` төлөвт гацна.
             *
             * ⚠️ 173 түлхүүрийг ГАРААР засвал нэгийг нь мартаж, тэр
             * хуудас нөгөө сайтын өгөгдлийг ЧИМЭЭГҮЙ харуулна. Тиймээс
             * ЭНД, hash функцийн түвшинд шийднэ — цаашид нэмэгдэх
             * query ч автоматаар зөв ажиллана.
             *
             * ⚠️ Сайт солих нь ӨӨР түлхүүр болох тул React Query өөрөө
             * шинээр татна: хуучин дата ХАРАГДАХГҮЙ, `clear()` ч
             * хэрэггүй, гацахгүй.
             */
            queryKeyHashFn: (key) =>
              JSON.stringify([useSiteStore.getState().site, ...(key as unknown[])]),
          },
        },
      }),
  );
  const init = useAdminAuth((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  /**
   * ⚠️⚠️ САЙТ СОЛИХОД — ШУУД ДАХИН ТАТНА (гацахгүй).
   *
   * Түлхүүрийн hash-д сайт орсон (дээрх `queryKeyHashFn`) тул сайт
   * солих нь БҮХ query-г шинэ түлхүүр болгоно. Гэвч React Query нь
   * hash функц өөрчлөгдсөнийг өөрөө МЭДЭХГҮЙ — идэвхтэй observer-
   * ууд хуучин hash-аараа сууж үлдэнэ.
   *
   * `refetchQueries({ type: 'active' })` нь ДЭЛГЭЦЭН ДЭЭР БАЙГАА
   * query-г шууд дахин татна — тэр хуудас нь ХАМГИЙН ХУРДАН
   * шинэчлэгдэнэ (хэрэглэгчийн хүсэлт: «ямар хуудсан дээр байна
   * тэндээ солигдоно»).
   *
   * ⚠️ ЯАГААД `clear()` БИШ (өмнөх хувилбар): `clear()` нь кэшийг
   * УСТГАДАГ ч дахин татахыг ЭХЛҮҮЛДЭГГҮЙ — observer нь `pending`
   * төлөвт гацаж, skeleton эргэлдсээр үлддэг байв. Зөвхөн F5 л
   * туслана. Энэ нь яг хэрэглэгчийн мэдээлсэн алдаа.
   *
   * ⚠️ `removeQueries({ type: 'inactive' })` — далд хуудсуудын хуучин
   * сайтын дата санах ойд хуримтлагдахгүй (тэдгээр нь дахин нээгдэхэд
   * шинэ hash-аар шинээр татна).
   */
  const site = useSiteStore((s) => s.site);
  const prevSite = useRef(site);
  useEffect(() => {
    if (prevSite.current === site) return;
    prevSite.current = site;
    /* ⚠️ Дараалал ЧУХАЛ: эхлээд идэвхгүйг нь цэвэрлэж, дараа нь
       идэвхтэйг нь татна — эс бөгөөс шинээр татсныг нь ч устгана. */
    client.removeQueries({ type: 'inactive' });
    void client.refetchQueries({ type: 'active' });
  }, [site, client]);

  return (
    <QueryClientProvider client={client}>
      {/* Toast + confirm/prompt модалыг нэг дор — window.confirm/alert ХЭРЭГЛЭХГҮЙ */}
      <UiProvider theme="dark">{children}</UiProvider>
    </QueryClientProvider>
  );
}
