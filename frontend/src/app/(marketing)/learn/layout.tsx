import type { ReactNode } from 'react';

/**
 * Сургалт үзэх (learn) хуудасны бүтэн дэлгэцийн layout.
 *
 * (marketing) layout нь SiteNavbar + SiteFooter-ийг өгдөг бөгөөд main дээр
 * pt-16 padding тавьдаг. Премиум full-screen learning UI-д эдгээр chrome
 * хэрэггүй тул scoped CSS-ээр нуугаад main-ийн padding-ийг 0 болгоно.
 * (Nested layout нь parent-ийн navbar/footer-ийг устгаж чадахгүй тул CSS ашиглав.)
 */
export default function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        body:has([data-learn-fullscreen]) header[data-nextjs-scroll-focus-boundary],
        body:has([data-learn-fullscreen]) footer { display: none !important; }
        main:has([data-learn-fullscreen]) {
          padding-top: 0 !important;
          min-height: 0 !important;
        }
      `}</style>
      <div data-learn-fullscreen>{children}</div>
    </>
  );
}
