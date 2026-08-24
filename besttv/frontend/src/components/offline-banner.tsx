'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * ИНТЕРНЭТ ТАСАРСАН ТУХАЙ МЭДЭГДЭЛ.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: сүлжээ унахад бүх query унаж, хэрэглэгч
 * «Контент ачаалахад алдаа гарлаа» гэсэн мессеж хардаг. Энэ нь
 * САЙТ ЭВДЭРСЭН гэсэн дохио — үнэндээ хэрэглэгчийн интернет тасарсан.
 * Монголд утсаар үзэж байгаад лифт/метронд орход байнга тохиолддог
 * бөгөөд дэмжлэг рүү залгах гол шалтгаан болдог.
 *
 * ⚠️ `navigator.onLine` нь ТӨГС БИШ (WiFi холбогдсон ч интернетгүй
 * байж болно) — тиймээс энэ нь зөвхөн ИЛЭРХИЙ тасалдлыг барина.
 * Худал эерэг гаргахгүйн тулд `false` болмогц л харуулна.
 */
export function OfflineBanner() {
  /**
   * ⚠️ Эхлэлийн утга ЗААВАЛ `false` — SSR дээр `navigator` байхгүй ба
   * hydration зөрчил гаргахгүйн тулд эхний render-т хэзээ ч харуулахгүй.
   */
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      /* ⚠️ `z-200` — navbar (z-100) болон модалуудаас ДЭЭГҮҮР: холболт
         тасарсныг хэрэглэгч ЯМАР Ч дэлгэцэн дээр харах ёстой. */
      className="fixed inset-x-0 top-0 z-200 flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-center text-[13px] font-semibold text-white"
    >
      <WifiOff size={15} className="shrink-0" />
      Интернэт холболт тасарлаа — сүлжээгээ шалгана уу
    </div>
  );
}
