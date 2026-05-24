export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Button } from '@digitalger/shared/ui';
import Link from 'next/link';
import { Suspense } from 'react';
import { ProductSection } from '@/components/home/product-section';
import { BannerCarousel } from '@/components/home/banner-carousel';
import { TestimonialsSection } from '@/components/home/testimonials-section';
import { BlogSection } from '@/components/home/blog-section';
import { bannersApi, blogApi, testimonialsApi, siteSettingsApi } from '@/lib/api';
import type { Banner, BlogPost, Testimonial } from '@/types/api';
import { Shield, Zap, Download, Star } from 'lucide-react';
import { CategoryStrip } from '@/components/home/category-strip';
import { SITE_NAME, SITE_URL } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const s = await siteSettingsApi.getPublic();
    const title = s.metaTitle || `${s.siteName} — Дижитал бүтээгдэхүүний marketplace`;
    const description = s.metaDescription || 'Файл, загвар, баримт, видео, курс зэрэг дижитал бүтээгдэхүүн худалдаж авах Монголын marketplace.';
    const ogTitle = s.ogTitle || title;
    const ogDesc = s.ogDescription || description;
    return {
      title,
      description,
      alternates: { canonical: SITE_URL },
      openGraph: {
        type: 'website',
        title: ogTitle,
        description: ogDesc,
        url: SITE_URL,
        ...(s.ogImageUrl ? { images: [{ url: s.ogImageUrl, width: 1200, height: 630, alt: ogTitle }] } : {}),
      },
      twitter: {
        card: (s.twitterCardType as 'summary' | 'summary_large_image') || 'summary_large_image',
        title: ogTitle,
        description: ogDesc,
        ...(s.ogImageUrl ? { images: [s.ogImageUrl] } : {}),
      },
    };
  } catch {
    return {
      title: `${SITE_NAME} — Дижитал бүтээгдэхүүний marketplace`,
      description: 'Файл, загвар, баримт, видео, курс зэрэг дижитал бүтээгдэхүүн худалдаж авах Монголын marketplace.',
      alternates: { canonical: SITE_URL },
    };
  }
}

async function getBanners(): Promise<Banner[]> {
  try { return await bannersApi.list(); } catch { return []; }
}
async function getTestimonials(): Promise<Testimonial[]> {
  try { return await testimonialsApi.listActive(); } catch { return []; }
}
async function getBlogPosts(): Promise<BlogPost[]> {
  try { return await blogApi.latest(6); } catch { return []; }
}
const TRUST_ITEMS = [
  { icon: Shield,   label: '100% Аюулгүй төлбөр',       desc: 'QPay болон картаар баталгаатай, шифрлэгдсэн төлбөр хийгддэг', iconCls: 'text-blue-500   bg-blue-500/10'   },
  { icon: Zap,      label: 'Шууд татаж авах',             desc: 'Төлбөр төлөгдсөн даруй секундын дотор татаж авна',            iconCls: 'text-violet-500 bg-violet-500/10' },
  { icon: Download, label: '500+ Бэлэн Шийдэл, бүтээгдэхүүн', desc: 'Файл, загвар, хичээл — нэг газраас бүгдийг',           iconCls: 'text-teal-500   bg-teal-500/10'   },
  { icon: Star,     label: '4.8★ Дундаж Үнэлгээ',        desc: '1000+ хэрэглэгч итгэж, дахин дахин худалдаж авдаг',          iconCls: 'text-amber-500  bg-amber-500/10'  },
];



const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/products?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

export default async function HomePage() {
  const [banners, testimonials, blogPosts] = await Promise.all([
    getBanners(),
    getTestimonials(),
    getBlogPosts(),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <BannerCarousel banners={banners} />

      {/* Trust badges */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {TRUST_ITEMS.map(({ icon: Icon, label, desc, iconCls }, i) => (
              <div key={label} className={[
                'flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-5',
                i % 2 === 0 ? 'border-r border-border' : '',
                i >= 2 ? 'border-t border-border' : '',
                'lg:border-t-0 lg:border-r lg:last:border-r-0',
              ].join(' ')}>
                <div className={`shrink-0 rounded-lg p-2 sm:p-2.5 ${iconCls}`}>
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold">{label}</p>
                  <p className="hidden sm:block text-[10px] sm:text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Хамгийн их эрэлттэй */}
      <Suspense fallback={null}>
        <ProductSection title="Хамгийн Их Эрэлттэй" href="/products?featured=true" featured swiper swiperMobileRows={2} />
      </Suspense>

      {/* Ангилал */}
      <CategoryStrip />

      {/* Шинэ бүтээгдэхүүн */}
      <Suspense fallback={null}>
        <ProductSection title="Шинэ Бүтээгдэхүүн" href="/products?sortBy=newest" sortBy="newest" swiper pageSize={16} swiperMobileRows={2} />
      </Suspense>

      {/* CTA */}
      <section className="py-8 sm:py-10 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-linear-to-r from-primary to-accent p-6 sm:p-8 md:p-12 text-primary-foreground flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Долоо хоног бүр шинэ бүтээгдэхүүн нэмэгддэг</h2>
              <p className="mt-2 text-sm sm:text-base text-primary-foreground/80">Бүртгүүлээд 10% хөнгөлөлт авдаг. Шинэ бүтээгдэхүүн гарах бүрт хамгийн түрүүнд мэдэгдэнэ — Боломжийг бүү алд.</p>
            </div>
            <div className="flex gap-3 shrink-0 flex-wrap">
              <Button asChild size="lg" className="font-bold bg-[#ffbe00] text-[#022179] hover:bg-[#ffd84d] dark:bg-[#ffbe00] dark:text-[#022179] dark:hover:bg-[#ffd84d]">
                <Link href="/signup">Бүртгүүлэх</Link>
              </Button>
              <Button asChild size="lg" className="bg-white/15 border border-white/40 text-white hover:bg-white/25 font-semibold">
                <Link href="/products">Бүтээгдэхүүн</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Хамгийн их хямдарсан — CTA дараа */}
      <Suspense fallback={null}>
        <ProductSection title="Хамгийн Их Хямдарсан" href="/products?onSale=true&sortBy=discount" onSale sortBy="discount" swiper pageSize={4} swiperMobileRows={2} />
      </Suspense>

      {/* Testimonials */}
      {testimonials.length > 0 && <TestimonialsSection testimonials={testimonials} />}

      {/* Latest blog posts */}
      <BlogSection posts={blogPosts} />
    </>
  );
}
