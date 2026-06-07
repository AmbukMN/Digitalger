import type { Metadata } from 'next';
import { SITE_URL } from './constants';
import { pagesApi, siteSettingsApi, type PageData, type PublicSiteSettings } from './api';

/**
 * Marketing page-уудын generateMetadata-д ашиглах нийтлэг helper.
 *
 * Эрэмбэ (fallback):
 *   title       → page.metaTitle → page.title → settings.metaTitle → fallbackTitle
 *   description → page.metaDescription → settings.metaDescription → fallbackDesc
 *   ogImage     → page.ogImageUrl → settings.ogImageUrl
 *   keywords    → page.metaKeywords → settings.metaKeywords
 *
 * page болон settings аль алиныг нь try/catch-аар уншиж, API унавал hardcode
 * fallback руу аюулгүй буцна. openGraph + twitter + canonical бүрэн.
 */
export async function buildPageMetadata(
  slug: string,
  fallbackTitle: string,
  fallbackDesc: string,
): Promise<Metadata> {
  let page: PageData | null = null;
  let settings: PublicSiteSettings | null = null;

  try {
    page = await pagesApi.bySlug(slug);
  } catch {
    /* fallback — page уншиж чадсангүй */
  }
  try {
    settings = await siteSettingsApi.getPublic();
  } catch {
    /* fallback — site settings уншиж чадсангүй */
  }

  const title =
    page?.metaTitle || page?.title || settings?.metaTitle || fallbackTitle;
  const description =
    page?.metaDescription || settings?.metaDescription || fallbackDesc;
  const ogImageUrl = page?.ogImageUrl || settings?.ogImageUrl || null;
  const keywords = page?.metaKeywords || settings?.metaKeywords || null;

  const url = `${SITE_URL}/${slug}`;

  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      ...(ogImageUrl
        ? { images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }] }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  };
}
