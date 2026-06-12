import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import { siteSettingsApi, getNavbarData } from '@/lib/api';
import type { Theme } from '@digitalger/shared/ui';
import { WebVitalsReporter } from '@/lib/web-vitals';
import { AnalyticsTracker } from '@/components/analytics-tracker';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
// Chat widget-ийг client wrapper дотор dynamic(ssr:false) хийж анхны JS
// bundle-аас гаргасан (ssr:false нь server component-д зөвшөөрөгдөхгүй).
import { ChatWidgetLazy } from '@/components/chat/chat-widget-lazy';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#022179' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1b3e' },
  ],
};

const DEFAULT_TITLE = `${SITE_NAME} — Дижитал бүтээгдэхүүний marketplace`;
const DEFAULT_DESC =
  'Файл, загвар, баримт, видео, сургалт зэрэг дижитал бүтээгдэхүүн худалдаж авах Монголын marketplace.';

export async function generateMetadata(): Promise<Metadata> {
  let ogImageUrl: string | null = null;
  try {
    const s = await siteSettingsApi.getPublic();
    ogImageUrl = s.ogImageUrl ?? null;
  } catch {
    // fallback to no image — acceptable
  }

  const ogImages = ogImageUrl
    ? [{ url: ogImageUrl, width: 1200, height: 630, alt: DEFAULT_TITLE }]
    : [];

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: DEFAULT_TITLE,
      template: `%s | ${SITE_NAME}`,
    },
    description: DEFAULT_DESC,
    keywords: [
      'дижитал бүтээгдэхүүн', 'файл татах', 'загвар', 'сургалт', 'монгол marketplace',
      'digital product', 'template', 'online course', 'Mongolia',
    ],
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    openGraph: {
      type: 'website',
      locale: 'mn_MN',
      siteName: SITE_NAME,
      url: SITE_URL,
      title: DEFAULT_TITLE,
      description: DEFAULT_DESC,
      ...(ogImages.length ? { images: ogImages } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: DEFAULT_TITLE,
      description: DEFAULT_DESC,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    alternates: { canonical: SITE_URL },
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: SITE_NAME,
    },
  };
}

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/brand/logo-color.png`,
  sameAs: [],
};

async function getDefaultTheme(): Promise<Theme> {
  try {
    const apiUrl =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:4000';
    const res = await fetch(`${apiUrl}/api/settings/public`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return 'system';
    const data = await res.json();
    const t = data?.defaultTheme;
    if (t === 'light' || t === 'dark' || t === 'system') return t;
    return 'system';
  } catch {
    return 'system';
  }
}

/**
 * Blocking inline script: localStorage хадгалагдсан preference, эсвэл
 * server default, эсвэл system preference-ийг ашиглан <html>-д class тавина.
 * Энэ нь React hydration-аас өмнө ажиллаж flash (FOUC) зайлуулна.
 */
function buildThemeScript(serverDefault: Theme): string {
  return `(function(){try{var s=localStorage.getItem('digitalger-theme');var d='${serverDefault}';var t=s||d||'system';var r=t==='system'?(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t;document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(r);}catch(e){}})();`;
}

// Meta (Facebook) Pixel — admin SEO-д fbPixelId оруулсан үед л ачаална.
function buildMetaPixel(id: string): string {
  return `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`;
}

// Google Analytics 4 (gtag) — admin SEO-д googleAnalyticsId оруулсан үед л.
function buildGtag(id: string): string {
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`;
}

// Google Tag Manager — admin SEO-д googleTagManagerId оруулсан үед л.
function buildGtm(id: string): string {
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Theme + navbar (меню/лого)-г server дээр зэрэг prefetch — navbar анхны HTML-д
  // бодит утгаар орох тул flash/үсрэлт гарахгүй.
  const [defaultTheme, navbar] = await Promise.all([
    getDefaultTheme(),
    getNavbarData(),
  ]);

  // Admin SEO-д оруулсан analytics ID-нууд (оруулсан үед л script ачаална)
  const s = navbar.settings;
  const fbPixelId = s?.fbPixelId?.trim() || null;
  const gaId = s?.googleAnalyticsId?.trim() || null;
  const gtmId = s?.googleTagManagerId?.trim() || null;

  return (
    <html lang="mn" suppressHydrationWarning>
      <head>
        {/* Flash prevention — synchronous, runs before any paint */}
        <script dangerouslySetInnerHTML={{ __html: buildThemeScript(defaultTheme) }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        {/* Google Tag Manager — admin SEO-д ID оруулсан үед */}
        {gtmId && (
          <script dangerouslySetInnerHTML={{ __html: buildGtm(gtmId) }} />
        )}
        {/* Google Analytics (gtag) — admin SEO-д ID оруулсан үед */}
        {gaId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script dangerouslySetInnerHTML={{ __html: buildGtag(gaId) }} />
          </>
        )}
        {/* Meta (Facebook) Pixel — admin SEO-д ID оруулсан үед */}
        {fbPixelId && (
          <>
            <script dangerouslySetInnerHTML={{ __html: buildMetaPixel(fbPixelId) }} />
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                height="1"
                width="1"
                style={{ display: 'none' }}
                src={`https://www.facebook.com/tr?id=${fbPixelId}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans antialiased`}
      >
        {/* GTM noscript (body эхэнд) — JS идэвхгүй үед */}
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
              title="gtm"
            />
          </noscript>
        )}
        <Providers defaultTheme={defaultTheme} navbar={navbar}>
          <AnalyticsTracker />
          {children}
          <ChatWidgetLazy />
        </Providers>
        <WebVitalsReporter />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
