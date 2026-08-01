import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

const API_URL = process.env.API_URL ?? 'http://localhost:4100';

/**
 * ⚠️ ЗААВАЛ RUNTIME — build үед backend унтарсан байдаг тул sitemap хоосон
 * (зөвхөн 6 статик зам) үүсээд, кино/блог ОГТ ороогүй байв.
 * Энэ мөр байхгүй бол Next нь sitemap-ыг build-д нэг л удаа үүсгэнэ.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

/** ⚠️ Sitemap-аас болж build унах ёсгүй — алдаа гарвал хоосон массив */
async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}/api${path}`, { next: { revalidate: 3600 } });
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
    { url: `${SITE_URL}/movies`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/series`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  // Кино / олон ангит — хамгийн чухал контент
  const titles = await safeFetch<{ items?: TitleRow[] } | TitleRow[]>(
    '/titles?limit=1000',
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
