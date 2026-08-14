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
 * Хамгийн СҮҮЛИЙН нөөц OG зураг — `app/opengraph-image.tsx` динамикаар зурна.
 * ⚠️ Зөвхөн админ SEO-д зураг ОГТ оруулаагүй үед л хэрэглэнэ.
 */
const FALLBACK_OG = `${SITE_URL}/opengraph-image`;

/** Сайтын нэрийн анхдагч — админ тохируулаагүй үед */
const FALLBACK_SITE_NAME = 'BestTV';

export interface SeoSettings {
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

/**
 * Сайт даяарх SEO тохиргоо — админ панелиас (`/admin/seo`).
 *
 * ⚠️⚠️ БОДИТ АЛДАА: энэ функц өмнө нь ЗӨВХӨН `layout.tsx` дотор байсан
 * тул `/movies`, `/pricing`, `/blog`, `/faq`, кино, блог, статик хуудас
 * бүгд админы `ogImageUrl`-ыг ОГТ ХАРААГҮЙ — админ Open Graph зураг
 * тохируулсан хэдий ч Facebook-д хуучин кодоор зурсан зураг гарч байв.
 *
 * Одоо НЭГ ЭХ СУРВАЛЖ: og зураг/сайтын нэр хэрэгтэй бүх газраас энийг
 * дуудна.
 *
 * ⚠️ Алдаа гарвал null — SEO-гийн улмаас хуудас унах ЁСГҮЙ.
 */
export async function getSiteSeo(): Promise<SeoSettings | null> {
  return fetchSeoJson<SeoSettings>(`${SERVER_API_URL}/api/seo`);
}

/**
 * ⚠️⚠️ BUILD ҮЕД БАЙХГҮЙ BACKEND — ХАМГИЙН ЧУХАЛ.
 *
 * БОДИТ АЛДАА: `docker build` явагдах үед `besttv-backend` контейнер нь
 * тухайн сүлжээнд БАЙХГҮЙ. Тиймээс `getSiteSeo()` алдаа өгч `null`
 * буцаана — тэгээд Next нь хуудсыг БҮРЭН СТАТИК болгож, кодын анхдагч
 * зургийг HTML-д ШАТААЖ бичдэг. Үр дүнд нь админ SEO зураг тохируулсан ч
 * Facebook-д ХУУЧИН зураг л гардаг байв (`revalidate` тоолуур ч эхлэхгүй,
 * учир нь fetch амжилтгүй болсон тул кэш бүртгэл ҮҮСЭХГҮЙ).
 *
 * ЗАСВАР: fetch унавал `null` буцаахын оронд ЭНЭ рендерийг динамик
 * болгоно (`connection()`) — дараагийн бодит хүсэлт дээр backend
 * ажиллаж байгаа тул зөв утга ирнэ.
 */
async function fetchSeoJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    return json && typeof json === 'object' ? (json as T) : null;
  } catch {
    /* Build үед статик шатахаас сэргийлнэ. Ажиллах үед fetch унасан бол
       энэ нь хуудсыг тухайн хүсэлтэд динамик болгоно — SEO буруу
       шатаахаас илүү дээр. */
    try {
      const { connection } = await import('next/server');
      await connection();
    } catch {
      /* `connection()` байхгүй/боломжгүй орчин — чимээгүй үргэлжилнэ */
    }
    return null;
  }
}

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
  /* ⚠️ `fetchSeoJson` — build үед backend байхгүй бол статик шатахаас
     сэргийлж динамик болгоно (дэлгэрэнгүйг тэнд бич) */
  return fetchSeoJson<SeoPageOverride>(
    `${SERVER_API_URL}/api/seo/override?path=${encodeURIComponent(path)}`,
  );
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
  /* ⚠️ Зэрэг татна — дараалуулбал хуудас 2 дахин удаан рендерлэнэ */
  const [o, seo] = await Promise.all([getSeoOverride(opts.path), getSiteSeo()]);

  const title = o?.title || opts.title;
  const description = o?.description || opts.description;
  /* Эрэмбэ: хуудасны админ override → хуудасны өөрийн зураг →
     САЙТЫН админ og зураг → кодын динамик зураг */
  const ogImage = o?.ogImageUrl || opts.ogImage || seo?.ogImageUrl || FALLBACK_OG;
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
      siteName: seo?.siteName || FALLBACK_SITE_NAME,
      type: 'website',
      locale: 'mn_MN',
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: title }] } : {}),
    },
    twitter: {
      /* ⚠️ Админы сонголтыг хүндэтгэнэ — өмнө нь ХАТУУ бичсэн байв */
      card: (seo?.twitterCard as 'summary_large_image' | 'summary') || 'summary_large_image',
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

/**
 * `metaTitle`-ээс сайтын нэрийг ХАСНА — НЭГ ЭХ СУРВАЛЖ.
 *
 * ⚠️⚠️ БОДИТ АЛДАА: 131/131 киноны гарчиг «X — BestTV | BestTV» гэж
 * ДАВХАРДАЖ харагдаж байв (Google-ийн хайлтын үр дүнд ч).
 *
 * Шалтгаан: админ панелийн auto-SEO нь `metaTitle`-д «— BestTV»
 * нэмдэг, дээр нь root layout-ийн `title.template` нь «| BestTV»
 * нэмнэ.
 *
 * ⚠️ Блогт `.replace(/\s*\|\s*BestTV\s*$/i, '')` байсан нь ХАНГАЛТГҮЙ
 * — зөвхөн `|` тусгаарлагчийг барьдаг, `—` (em dash) барихгүй.
 * Энд БҮХ түгээмэл тусгаарлагчийг хамруулав.
 *
 * ⚠️ DB дэх утгыг ЗАСАХГҮЙ — админ гараар бичсэн байж болно.
 * Зөвхөн ХАРУУЛАХ үед цэвэрлэнэ.
 */
export function stripSiteName(
  raw: string | null | undefined,
  /** Админаас тохируулсан сайтын нэр (өгөөгүй бол анхдагч) */
  siteName: string = FALLBACK_SITE_NAME,
): string {
  /* ⚠️ RegExp-д ОРУУЛАХ өмнө escape — админ сайтын нэрэнд `.` `(` зэрэг
     тусгай тэмдэгт бичвэл regex эвдэрч ЦОЧМОГ алдаа өгнө */
  const esc = siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    (raw ?? '')
      /**
       * ⚠️ ХОЁР хэлбэр:
       *   «X — BestTV дээр онлайнаар үзэх»  (админ auto-SEO, урт)
       *   «X — BestTV»                       (60 тэмдэгт хэтэрсэн үед)
       * Тусгаарлагч нь `—` `–` `-` `|` `·` аль нь ч байж болно.
       */
      .replace(new RegExp(`\\s*[—–\\-|·]\\s*${esc}(\\s+дээр\\s+онлайнаар\\s+үзэх)?\\s*$`, 'i'), '')
      .trim()
  );
}
