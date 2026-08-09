import type { MetadataRoute } from 'next';
import { SERVER_API_URL } from '@/lib/server-api';
import { SITE_URL } from '@/lib/seo';


/**
 * ⚠️⚠️ SITEMAP-ИЙН ТОХИРГОО — ГУРВАН удаа алдсаны эцсийн хувилбар.
 *
 * ТҮҮХ:
 *   1) Тохиргоогүй → Next нь build-д НЭГ л удаа үүсгэнэ. Build үед
 *      backend унтарсан тул sitemap ХООСОН (зөвхөн 5 статик зам).
 *   2) `force-dynamic` + `revalidate` ХАМТ → зөрчилддөг.
 *   3) `revalidate` ГАНЦААРАА → бас ажиллаагүй. Бодит хэмжилт:
 *      deploy хийсний дараа ч 5 URL хэвээр (131 кино байхад).
 *      Шалтгаан: `.next/server/app/sitemap.xml.body` нь build үед
 *      үүсээд `max-age=0, must-revalidate` толгойтой тул Next түүнийг
 *      ТОГТМОЛ барина. Container дахин үүсэх бүрд ижил хоосон файл.
 *
 * ЭЦСИЙН ШИЙДЭЛ: `force-dynamic` ГАНЦААРАА + fetch түвшний кэш.
 *
 * ⚠️ Энэ route-д АЮУЛГҮЙ:
 *   • Crawler өдөрт хэдхэн удаа ирнэ (хэрэглэгчийн траффик БИШ)
 *   • `/titles/sitemap` нь зөвхөн slug+updatedAt буцаана — 131 мөр ~10мс
 *   • №2-т дурдсан "байнгын DB ачаалал" нь `?limit=1000` бүтэн
 *     `CARD_SELECT` татдаг байсан үеийнх — одоо хамаарахгүй
 *   • `safeFetch`-ийн `next: { revalidate: 3600 }` тул дараалсан
 *     хүсэлт DB-д хүрэхгүй (цагт нэг л удаа)
 *
 * ⚠️ `export const revalidate` ТАВЬЖ БОЛОХГҮЙ — `force-dynamic`-тай
 * зөрчилдөнө (№2-ын алдаа).
 */
export const dynamic = 'force-dynamic';

/** ⚠️ Sitemap-аас болж build унах ёсгүй — алдаа гарвал хоосон массив */
async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${SERVER_API_URL}/api${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

interface TitleRow {
  slug: string;
  updatedAt?: string;
  createdAt?: string;
}
interface BlogRow {
  slug: string;
  updatedAt?: string;
  publishedAt?: string;
}
interface PageRow {
  slug: string;
  updatedAt?: string;
}

/**
 * sitemap.xml — өмнө нь ОГТ БАЙГААГҮЙ (404).
 * Google/Bing шинэ кино, блогийг олоход шаардлагатай.
 *
 * ⚠️ /watch, /search, /profile, /my-list зэрэг хувийн болон noindex
 * хуудсуудыг ОРУУЛАХГҮЙ.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    // ⚠️ `/series` ХАСАГДСАН — каталог нэгдэж `/movies` руу redirect болсон.
    // Redirect хуудсыг sitemap-д оруулах нь SEO-д сөрөг.
    { url: `${SITE_URL}/movies`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  /**
   * Кино / олон ангит — хамгийн чухал контент.
   *
   * ⚠️⚠️ `/titles/sitemap` АШИГЛАНА, `/titles?limit=1000` БИШ.
   *
   * БОДИТ АЛДАА: `list()` нь `Math.min(60, limit)` тул `limit=1000`
   * гэсэн ч ЗӨВХӨН 60 буцаадаг байв — 131 киноны 71 нь Google-д
   * ХЭЗЭЭ Ч индексжихгүй (шинэ 49 драм бүхэлдээ хайлтад олдохгүй).
   *
   * ⚠️ Тэр хязгаарыг өсгөх нь БУРУУ — каталогийг хамгаалдаг. Оронд
   * нь зөвхөн `slug`+`updatedAt` буцаадаг хөнгөн endpoint нэмсэн.
   */
  const titles = await safeFetch<{ items?: TitleRow[] } | TitleRow[]>(
    '/titles/sitemap',
    { items: [] },
  );
  const titleRows = Array.isArray(titles) ? titles : (titles.items ?? []);
  const titleUrls: MetadataRoute.Sitemap = titleRows
    .filter((t) => t.slug)
    .map((t) => ({
      url: `${SITE_URL}/movie/${t.slug}`,
      lastModified: t.updatedAt ? new Date(t.updatedAt) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

  // Блог / мэдээ
  const blog = await safeFetch<{ items?: BlogRow[] } | BlogRow[]>('/blog?limit=500', { items: [] });
  const blogRows = Array.isArray(blog) ? blog : (blog.items ?? []);
  const blogUrls: MetadataRoute.Sitemap = blogRows
    .filter((b) => b.slug)
    .map((b) => ({
      url: `${SITE_URL}/blog/${b.slug}`,
      lastModified: b.updatedAt ? new Date(b.updatedAt) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }));

  // Статик хуудас (үйлчилгээний нөхцөл, нууцлал г.м.)
  const pages = await safeFetch<{ items?: PageRow[] } | PageRow[]>('/pages', { items: [] });
  const pageRows = Array.isArray(pages) ? pages : (pages.items ?? []);
  const pageUrls: MetadataRoute.Sitemap = pageRows
    .filter((p) => p.slug)
    .map((p) => ({
      url: `${SITE_URL}/p/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    }));

  return [...staticRoutes, ...titleUrls, ...blogUrls, ...pageUrls];
}
