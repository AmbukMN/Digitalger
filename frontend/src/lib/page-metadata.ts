import type { Metadata } from 'next';
import { SITE_URL } from './constants';
import { pagesApi, seoApi, siteSettingsApi, type PageData, type PublicSiteSettings } from './api';

/**
 * Тогтмол хуудсуудын (/, /products, /categories, /blog, /search) generateMetadata-д
 * admin-аас тохируулсан custom OG override-ийг дарж бичих helper.
 *
 * - Override байвал title/description/openGraph(images)/twitter(images)-ийг дарж бичнэ.
 * - Override байхгүй (null) бол defaultMeta ХЭВЭЭР буцна (анхдагч meta эвдрэхгүй).
 * - Override-д зөвхөн бөглөсөн талбарууд (title || description || ogImageUrl) дарж бичнэ.
 *
 * path нь backend ALLOWED_PATHS-тэй ижил байх ёстой: '/', '/products', '/categories',
 * '/blog', '/search'.
 */
export async function applySeoOverride(
  path: string,
  defaultMeta: Metadata,
): Promise<Metadata> {
  let override: Awaited<ReturnType<typeof seoApi.getOverride>> = null;
  try {
    override = await seoApi.getOverride(path);
  } catch {
    /* fallback — override уншиж чадсангүй, default хэвээр */
  }
  if (!override) return defaultMeta;

  const title = override.title || (defaultMeta.title as string | undefined);
  const description = override.description || defaultMeta.description || undefined;
  const ogImageUrl = override.ogImageUrl || null;

  const prevOg = defaultMeta.openGraph ?? {};
  const prevTwitter = defaultMeta.twitter ?? {};

  return {
    ...defaultMeta,
    title,
    description,
    openGraph: {
      ...prevOg,
      ...(override.title ? { title } : {}),
      ...(override.description ? { description } : {}),
      ...(ogImageUrl
        ? { images: [{ url: ogImageUrl, width: 1200, height: 630, alt: typeof title === 'string' ? title : 'DigitalGer' }] }
        : {}),
    },
    twitter: {
      ...prevTwitter,
      ...(override.title ? { title } : {}),
      ...(override.description ? { description } : {}),
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  };
}

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
