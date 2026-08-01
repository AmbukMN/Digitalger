import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import Script from 'next/script';
import { Providers } from './providers';
import { ChatWidgetLazy } from '@/components/chat/chat-widget-lazy';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { MobileNav } from '@/components/layout/mobile-nav';
import './globals.css';

// Manrope — кирилл дэмжлэгтэй, орчин үеийн geometric font
const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap',
});

interface SeoSettings {
  siteName: string;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string | null;
  twitterCard: string;
  noindex: boolean;
  googleAnalyticsId: string;
  googleTagManagerId: string;
  facebookPixelId: string;
  siteVerification: string;
}

async function getSeo(): Promise<SeoSettings | null> {
  try {
    const api = process.env.API_URL ?? 'http://localhost:4100';
    const res = await fetch(`${api}/api/seo`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeo();
  return {
    title: { default: seo?.metaTitle ?? 'BestTV — Үз, мэдэр, дахин үз', template: `%s | ${seo?.siteName ?? 'BestTV'}` },
    description: seo?.metaDescription ?? 'Монголын киноны стриминг платформ',
    metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3100'),
    robots: seo?.noindex ? { index: false, follow: false } : undefined,
    verification: seo?.siteVerification ? { google: seo.siteVerification } : undefined,
    openGraph: {
      siteName: seo?.siteName ?? 'BestTV',
      locale: 'mn_MN',
      type: 'website',
      images: seo?.ogImageUrl ? [seo.ogImageUrl] : undefined,
    },
    twitter: {
      card: (seo?.twitterCard as 'summary_large_image' | 'summary') ?? 'summary_large_image',
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const seo = await getSeo();

  return (
    <html lang="mn" className={`dark ${manrope.variable}`}>
      <body className="antialiased font-sans" style={{ fontFamily: 'var(--font-manrope), system-ui, sans-serif' }}>
        {seo?.googleAnalyticsId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${seo.googleAnalyticsId}`} strategy="afterInteractive" />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${seo.googleAnalyticsId}');`}
            </Script>
          </>
        )}
        {seo?.googleTagManagerId && (
          <Script id="gtm-init" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
              var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
              j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${seo.googleTagManagerId}');`}
          </Script>
        )}
        <Providers>
          <Navbar />
          <div id="main-content" className="pb-mobile-nav">
            {children}
          </div>
          <Footer />
          <MobileNav />
          <ChatWidgetLazy />
        </Providers>
      </body>
    </html>
  );
}
