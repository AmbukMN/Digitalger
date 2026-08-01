import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * robots.txt — өмнө нь өөрийн файл БАЙГААГүй тул Cloudflare-ийн автомат
 * хувилбар үйлчилж, `Sitemap:` мөр огт байгаагүй → Google sitemap-ыг олохгүй.
 *
 * ⚠️ Disallow: хувийн болон noindex хуудсуудыг crawl хийлгэхгүй —
 * crawl budget-ыг кино/блог руу чиглүүлнэ.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/watch/', // тоглуулах — noindex, хувийн
          '/profile',
          '/my-list',
          '/login',
          '/search', // хайлтын үр дүн индексжүүлэхгүй (thin content)
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
