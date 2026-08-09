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
          // ⚠️ Нууц үг сэргээх — /reset-password?token=... нь НУУЦ токен
          // агуулдаг тул crawl хийгдэх нь ЭРСДЭЛТЭЙ (referrer/лог задрал)
          '/forgot-password',
          '/reset-password',
          '/search', // хайлтын үр дүн индексжүүлэхгүй (thin content)
          /**
           * ⚠️⚠️ 18+ ХЭСЭГ — ГУРАВДАХЬ давхар хамгаалалт.
           *
           *   1. `/adult/layout.tsx` → `robots: { index: false }`
           *   2. Sitemap-аас 18+ кино хасагдсан (`NOT_ADULT`)
           *   3. ЭНД — crawler тэр замд ОГТ орохгүй
           *
           * Google-д насанд хүрэгчдийн контент индексжих нь AdSense /
           * Search Console зөрчил, брэндийн нэр хүндэд эрсдэлтэй.
           */
          '/adult',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
