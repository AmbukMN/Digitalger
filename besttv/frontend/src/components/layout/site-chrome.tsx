'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { ChatWidgetLazy } from '@/components/chat/chat-widget-lazy';

/**
 * Сайтын нийтлэг chrome (navbar / footer / mobile nav / чат).
 *
 * ⚠️ ТОГЛУУЛАХ хуудсанд (/watch/...) БҮГДИЙГ нууна:
 *   - Player өөрийн буцах товч, гарчигтай тул navbar ДАВХАРДАНА
 *   - Кино үзэж байхад footer/mobile nav/чат нь анхаарал сарниулна
 *   - Дүүрэн дэлгэц (fullscreen) горимд эдгээр нь саад болно
 * Netflix/YouTube-ийн зан төлөвтэй ижил.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPlayer = pathname?.startsWith('/watch');

  if (isPlayer) {
    // Player хуудас — chrome-гүй, мобайл nav-ийн доод зай ч хэрэггүй
    return <div id="main-content">{children}</div>;
  }

  return (
    <>
      <Navbar />
      <div id="main-content" className="pb-mobile-nav">
        {children}
      </div>
      <Footer />
      <MobileBottomNav />
      <ChatWidgetLazy />
    </>
  );
}
