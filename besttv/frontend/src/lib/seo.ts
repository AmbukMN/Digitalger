import type { Metadata } from 'next';
import { SERVER_API_URL } from '@/lib/server-api';

/**
 * Сайтын үндсэн хаяг — canonical / og:url / sitemap-д ЗААВАЛ.
 *
 * ⚠️ SITE_URL тохируулаагүй бол metadataBase нь localhost болж, бүх
 * харьцангуй OG зураг эвдэрдэг байсан (Facebook/Twitter хоосон харуулна).
 * Тиймээс production утгыг fallback болгов — localhost БИШ.
 */
export const SITE_URL = (
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  'https://besttv.us'
).replace(/\/$/, '');

/** Server талын API хаяг (container дотор шууд, nginx дамжихгүй) */

/**
 * Сайтын анхдагч OG зураг — `app/opengraph-image.tsx` динамикаар үүсгэнэ.
 * ⚠️ Админ SEO-д зураг оруулаагүй үед ч линк хуваалцахад зурагтай гарна
 * (өмнө нь ogImageUrl=null тул жагсаалтын хуудсууд ЗУРАГГҮЙ байсан).
 */
const DEFAULT_OG = `${SITE_URL}/opengraph-image`;

export interface SeoPageOverride {
  title?: string;
  description?: string;
  ogImageUrl?: string | null;
  keywords?: string;
  noindex?: boolean;
}

/**
 * Админаас тохируулсан хуудасны override.
 * ⚠️ Алдаа гарвал null — SEO-гийн улмаас хуудас унах ёсгүй.
 */
export async function getSeoOverride(path: string): Promise<SeoPageOverride | null> {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/seo/override?path=${encodeURIComponent(path)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json && typeof json === 'object' ? (json as SeoPageOverride) : null;
  } catch {
    return null;
  }
}

/**
 * Тогтмол хуудсын metadata үүсгэнэ — админы override-ыг дарж бичнэ.
 *
 * Эрэмбэ: админ override → дамжуулсан анхдагч утга.
 * canonical + og:url ҮРГЭЛЖ орно (өмнө нь ОГТ байгаагүй → Google давхардсан
 * хуудас гэж үзэх эрсдэлтэй байв).
 */
export async function buildPageMetadata(opts: {
  path: string;
  title: string;
  description: string;
  /** Хуудасны өөрийн OG зураг (байхгүй бол сайтын анхдагч) */
  ogImage?: string | null;
  /** Хайлт/хувийн хуудсууд — индексжүүлэхгүй */
  noindex?: boolean;
}): Promise<Metadata> {
  const o = await getSeoOverride(opts.path);

  const title = o?.title || opts.title;
  const description = o?.description || opts.description;
  // Эрэмбэ: админ override → хуудасны өөрийн зураг → сайтын анхдагч (динамик)
  const ogImage = o?.ogImageUrl || opts.ogImage || DEFAULT_OG;
  const noindex = o?.noindex ?? opts.noindex ?? false;
  const url = `${SITE_URL}${opts.path === '/' ? '' : opts.path}`;

  return {
    title,
    description,
    ...(o?.keywords ? { keywords: o.keywords } : {}),
    alternates: { canonical: url },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      locale: 'mn_MN',
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: title }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

/** JSON-LD script tag-д зориулж аюулгүй болгоно (</script> тасалдахаас) */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
