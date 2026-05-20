export const dynamic = 'force-dynamic';

import { Button } from '@digitalger/shared/ui';
import Link from 'next/link';
import { ProductSection } from '@/components/home/product-section';
import { BannerCarousel } from '@/components/home/banner-carousel';
import { TestimonialsSection } from '@/components/home/testimonials-section';
import { BlogSection } from '@/components/home/blog-section';
import { bannersApi, blogApi, testimonialsApi } from '@/lib/api';
import type { Banner, BlogPost, Testimonial } from '@/types/api';
import { Shield, Zap, Download, Star } from 'lucide-react';

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
  { icon: Shield, label: 'Аюулгүй төлбөр', desc: 'QPay болон банкны карт' },
  { icon: Zap, label: 'Шууд татах', desc: 'Төлбөрийн дараа нэн даруй' },
  { icon: Download, label: '500+ бүтээгдэхүүн', desc: 'Файл, загвар, курс' },
  { icon: Star, label: '4.8★ үнэлгээ', desc: '1000+ хэрэглэгчийн сэтгэгдэл' },
];

export default async function HomePage() {
  const [banners, testimonials, blogPosts] = await Promise.all([getBanners(), getTestimonials(), getBlogPosts()]);

  return (
    <>
      <BannerCarousel banners={banners} />

      {/* Trust badges */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 divide-x divide-y divide-border lg:grid-cols-4 lg:divide-y-0">
            {TRUST_ITEMS.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-4 sm:py-5">
                <div className="shrink-0 rounded-lg bg-primary/10 p-2 sm:p-2.5">
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold">{label}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Онцлох бүтээгдэхүүн */}
      <ProductSection
        title="Онцлох бүтээгдэхүүн"
        href="/products?featured=true"
        featured
      />

      {/* Дижитал бүтээгдэхүүн */}
      <ProductSection title="Дижитал бүтээгдэхүүн" href="/products" />

      {/* CTA */}
      <section className="py-10 sm:py-12 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-linear-to-r from-primary to-accent p-6 sm:p-8 md:p-12 text-primary-foreground flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Шинэ бүтээгдэхүүн байнга нэмэгдэж байна</h2>
              <p className="mt-2 text-sm sm:text-base text-primary-foreground/80">Бүртгүүлж хөнгөлөлт, шинэ бүтээгдэхүүний мэдээг хамгийн түрүүнд авна уу.</p>
            </div>
            <div className="flex gap-3 shrink-0 flex-wrap">
              <Button asChild variant="secondary" size="lg" className="font-bold">
                <Link href="/signup">Үнэгүй бүртгүүлэх</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
                <Link href="/products">Бүтээгдэхүүн үзэх</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && <TestimonialsSection testimonials={testimonials} />}

      {/* Latest blog posts */}
      <BlogSection posts={blogPosts} />
    </>
  );
}
