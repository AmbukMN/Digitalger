import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/constants';

const BACKEND =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000';

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return fallback;
    return res.json() as Promise<T>;
  } catch {
    return fallback;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/categories`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/search`, changeFrequency: 'weekly', priority: 0.5 },
  ];

  type ProductItem = { slug: string; updatedAt?: string };
  type CategoryItem = { slug: string };
  type BlogItem = { slug: string; updatedAt?: string };

  const [productData, categories, blogData] = await Promise.all([
    safeFetch<{ items: ProductItem[] }>(
      `${BACKEND}/api/products?pageSize=1000&published=true`,
      { items: [] },
    ),
    safeFetch<CategoryItem[]>(`${BACKEND}/api/categories`, []),
    safeFetch<{ items: BlogItem[] }>(
      `${BACKEND}/api/blog?pageSize=500`,
      { items: [] },
    ),
  ]);

  const productRoutes: MetadataRoute.Sitemap = productData.items.map((p) => ({
    url: `${SITE_URL}/products/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/categories/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const blogRoutes: MetadataRoute.Sitemap = blogData.items.map((b) => ({
    url: `${SITE_URL}/blog/${b.slug}`,
    lastModified: b.updatedAt ? new Date(b.updatedAt) : new Date(),
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...blogRoutes];
}
