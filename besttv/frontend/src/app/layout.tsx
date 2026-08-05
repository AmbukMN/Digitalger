import type { Metadata } from 'next';
import { SERVER_API_URL } from '@/lib/server-api';
import { Manrope } from 'next/font/google';
import Script from 'next/script';
import { Providers } from './providers';
import { SiteChrome } from '@/components/layout/site-chrome';
import { ContentProtection } from '@/components/content-protection';
import { SITE_URL, getSeoOverride, jsonLd } from '@/lib/seo';
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
    const api = SERVER_API_URL;
    const res = await fetch(`${api}/api/seo`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeo();
  // ⚠️ Нүүр хуудсын админ override — root layout нь "/"-ийн metadata-г ч өгдөг
  const home = await getSeoOverride('/');

  const homeTitle = home?.title || seo?.metaTitle || 'BestTV — Үз, мэдэр, дахин үз';
  const homeDesc =
    home?.description || seo?.metaDescription || 'Монголын киноны стриминг платформ';
  // ⚠️ Анхдагч руу унана — ogImageUrl=null үед ч линк хуваалцахад зурагтай
  const homeOg = home?.ogImageUrl || seo?.ogImageUrl || `${SITE_URL}/opengraph-image`;

  return {
    title: { default: homeTitle, template: `%s | ${seo?.siteName ?? 'BestTV'}` },
    description: homeDesc,
    // ⚠️ SITE_URL байхгүй бол production хаяг — localhost БОЛГОХГҮЙ
    // (localhost болбол бүх харьцангуй OG зураг эвдэрч FB хоосон харуулна)
    metadataBase: new URL(SITE_URL),
    // Нүүр хуудсын canonical (дэд хуудсууд өөрсдөө дарж бичнэ)
    alternates: { canonical: SITE_URL },
    ...(home?.keywords ? { keywords: home.keywords } : {}),
    robots: seo?.noindex ? { index: false, follow: false } : undefined,
    verification: seo?.siteVerification ? { google: seo.siteVerification } : undefined,
    openGraph: {
      title: homeTitle,
      description: homeDesc,
      url: SITE_URL,
      siteName: seo?.siteName ?? 'BestTV',
      locale: 'mn_MN',
      type: 'website',
      images: homeOg ? [{ url: homeOg, width: 1200, height: 630, alt: homeTitle }] : undefined,
    },
    twitter: {
      card: (seo?.twitterCard as 'summary_large_image' | 'summary') ?? 'summary_large_image',
      title: homeTitle,
      description: homeDesc,
      ...(homeOg ? { images: [homeOg] } : {}),
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
        {/*
          Organization + WebSite structured data — Google-д сайтын нэр, лого,
          хайлтын хэлбэрийг мэдэгдэнэ (rich result / sitelinks searchbox).
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd([
              {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: seo?.siteName ?? 'BestTV',
                url: SITE_URL,
                ...(seo?.ogImageUrl ? { logo: seo.ogImageUrl } : {}),
              },
              {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: seo?.siteName ?? 'BestTV',
                url: SITE_URL,
                inLanguage: 'mn',
                potentialAction: {
                  '@type': 'SearchAction',
                  target: {
                    '@type': 'EntryPoint',
                    urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
                  },
                  'query-input': 'required name=search_term_string',
                },
              },
            ]),
          }}
        />
        <Providers>
          {/* Баруун товч / хуулах / F12 хамгаалалт (бүх хуудсанд) */}
          <ContentProtection />
          {/* ⚠️ Chrome-ыг SiteChrome шийднэ — /watch дээр бүгд нуугдана */}
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
