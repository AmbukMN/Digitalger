import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import Script from 'next/script';
import { Providers } from './providers';
import { SiteChrome } from '@/components/layout/site-chrome';
import { ContentProtection } from '@/components/content-protection';
import { SITE_URL, getSeoOverride, getSiteBrand, getSiteSeo, jsonLd } from '@/lib/seo';
import './globals.css';

// Manrope — кирилл дэмжлэгтэй, орчин үеийн geometric font
const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap',
});

/* ⚠️ `SeoSettings` интерфэйс болон татах функц нь `@/lib/seo`-д НҮҮСЭН —
   өмнө нь энд хуулбар байсан тул бусад хуудас админы og зургийг ХАРААГҮЙ */

export async function generateMetadata(): Promise<Metadata> {
  /* ⚠️ Нүүр хуудсын админ override — root layout нь "/"-ийн metadata-г ч өгдөг.
     Зэрэг татна — өмнө нь дараалуулж 2 дахин удаан байв. */
  const [seo, home] = await Promise.all([getSiteSeo(), getSeoOverride('/')]);

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
  /**
   * ⚠️ ЗЭРЭГ татна — дараалуулбал хуудас 2 дахин удаан рендерлэнэ.
   * `brand` нь лого/нэрийг СЕРВЕР талд бэлдэж, client дээр анивчихаас
   * сэргийлнэ (доор `Providers`-д тайлбарласан).
   */
  const [seo, brand] = await Promise.all([getSiteSeo(), getSiteBrand()]);

  return (
    /**
     * ⚠️ `suppressHydrationWarning` ЗААВАЛ — `next-themes` нь хадгалсан
     * сонголтыг уншаад `<html>`-д class-ыг ХУУДАС ЗУРАГДАХААС ӨМНӨ
     * (blocking script) тавьдаг. Тэр нь server-ийн HTML-ээс зөрөх тул
     * энэ тугийг тавихгүй бол React hydration warning шидэнэ.
     *
     * ⚠️ `className`-д `dark` ХАТУУ БИЧИХГҮЙ — `ThemeProvider` удирдана.
     */
    <html lang="mn" className={manrope.variable} suppressHydrationWarning>
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
          ⚠️ БОДИТ АЛДАА: `facebookPixelId`-г админ панелиас тохируулж
          хадгалдаг МӨРТЛӨӨ хуудсанд ОГТ рендерлэгддэггүй байв — админ
          пиксел оруулсан ч Facebook сурталчилгааны хөрвөлт огт бүртгэгдэхгүй.
        */}
        {seo?.facebookPixelId && (
          <>
            <Script id="fb-pixel" strategy="afterInteractive">
              {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
                t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window,document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init','${seo.facebookPixelId}');fbq('track','PageView');`}
            </Script>
            {/* JS унтраасан хөтчид зориулсан нөөц (Meta-гийн зөвлөмж) */}
            <noscript>
              <img
                height="1"
                width="1"
                style={{ display: 'none' }}
                alt=""
                src={`https://www.facebook.com/tr?id=${seo.facebookPixelId}&ev=PageView&noscript=1`}
              />
            </noscript>
          </>
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
        <Providers initialBrand={brand}>
          {/* Баруун товч / хуулах / F12 хамгаалалт (бүх хуудсанд) */}
          <ContentProtection />
          {/* ⚠️ Chrome-ыг SiteChrome шийднэ — /watch дээр бүгд нуугдана */}
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
