import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import { siteSettingsApi, getNavbarData } from '@/lib/api';
import type { Theme } from '@digitalger/shared/ui';
import { WebVitalsReporter } from '@/lib/web-vitals';
import { AnalyticsTracker } from '@/components/analytics-tracker';
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
  'Файл, загвар, баримт, видео, курс зэрэг дижитал бүтээгдэхүүн худалдаж авах Монголын marketplace.';

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
      'дижитал бүтээгдэхүүн', 'файл татах', 'загвар', 'курс', 'монгол marketplace',
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

  return (
    <html lang="mn" suppressHydrationWarning>
      <head>
        {/* Flash prevention — synchronous, runs before any paint */}
        <script dangerouslySetInnerHTML={{ __html: buildThemeScript(defaultTheme) }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans antialiased`}
      >
        <Providers defaultTheme={defaultTheme} navbar={navbar}>
          <AnalyticsTracker />
          {children}
          <ChatWidgetLazy />
        </Providers>
        <WebVitalsReporter />
      </body>
    </html>
  );
}
