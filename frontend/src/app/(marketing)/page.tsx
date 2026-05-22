export const dynamic = 'force-dynamic';

import { Button } from '@digitalger/shared/ui';
import Link from 'next/link';
import { Suspense } from 'react';
import { ProductSection } from '@/components/home/product-section';
import { BannerCarousel } from '@/components/home/banner-carousel';
import { TestimonialsSection } from '@/components/home/testimonials-section';
import { BlogSection } from '@/components/home/blog-section';
import { bannersApi, blogApi, categoriesApi, testimonialsApi } from '@/lib/api';
import type { Banner, BlogPost, Category, Testimonial } from '@/types/api';
import { Shield, Zap, Download, Star, ArrowRight } from 'lucide-react';
import Image from 'next/image';

async function getBanners(): Promise<Banner[]> {
  try { return await bannersApi.list(); } catch { return []; }
}
async function getTestimonials(): Promise<Testimonial[]> {
  try { return await testimonialsApi.listActive(); } catch { return []; }
}
async function getBlogPosts(): Promise<BlogPost[]> {
  try { return await blogApi.latest(6); } catch { return []; }
}
async function getCategories(): Promise<Category[]> {
  try { return await categoriesApi.list(); } catch { return []; }
}

const TRUST_ITEMS = [
  { icon: Shield,   label: '100% Аюулгүй төлбөр',       desc: 'QPay болон картаар баталгаатай, шифрлэгдсэн төлбөр хийгддэг', iconCls: 'text-blue-500   bg-blue-500/10'   },
  { icon: Zap,      label: 'Шууд татаж авах',             desc: 'Төлбөр төлөгдсөн даруй секундын дотор татаж авна',            iconCls: 'text-violet-500 bg-violet-500/10' },
  { icon: Download, label: '500+ Бэлэн Шийдэл, бүтээгдэхүүн', desc: 'Файл, загвар, хичээл — нэг газраас бүгдийг',           iconCls: 'text-teal-500   bg-teal-500/10'   },
  { icon: Star,     label: '4.8★ Дундаж Үнэлгээ',        desc: '1000+ хэрэглэгч итгэж, дахин дахин худалдаж авдаг',          iconCls: 'text-amber-500  bg-amber-500/10'  },
];

function CategoryGrid({ categories }: { categories: Category[] }) {
  if (!categories.length) return null;
  return (
    <section className="py-8 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-primary shrink-0" aria-hidden="true" />
            <h2 className="text-2xl font-bold">Ангиллаар Үзэх</h2>
          </div>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground hover:text-foreground">
            <Link href="/categories">
              Бүгдийг харах
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center hover:border-primary/50 hover:bg-primary/8 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            >
              {cat.imageUrl ? (
                <div className="relative h-12 w-12 overflow-hidden rounded-lg">
                  <Image src={cat.imageUrl} alt={cat.name} fill className="object-cover" sizes="48px" />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-2xl">
                  {cat.name.charAt(0)}
                </div>
              )}
              <span className="text-xs font-medium leading-tight group-hover:text-primary line-clamp-2">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const [banners, testimonials, blogPosts, categories] = await Promise.all([
    getBanners(),
    getTestimonials(),
    getBlogPosts(),
    getCategories(),
  ]);

  return (
    <>
      <BannerCarousel banners={banners} />

      {/* Trust badges */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 divide-x divide-y divide-border lg:grid-cols-4 lg:divide-y-0">
            {TRUST_ITEMS.map(({ icon: Icon, label, desc, iconCls }) => (
              <div key={label} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-4 sm:py-5">
                <div className={`shrink-0 rounded-lg p-2 sm:p-2.5 ${iconCls}`}>
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
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
      <Suspense fallback={null}>
        <ProductSection title="Хамгийн Их Эрэлттэй" href="/products?featured=true" featured />
      </Suspense>

      {/* Дижитал бүтээгдэхүүн — FILE, TEMPLATE, DOCUMENT, BUNDLE */}
      <Suspense fallback={null}>
        <ProductSection
          title="Дижитал бүтээгдэхүүн"
          href="/products?types=FILE,TEMPLATE,DOCUMENT,BUNDLE"
          types="FILE,TEMPLATE,DOCUMENT,BUNDLE"
        />
      </Suspense>

      {/* Ангилал */}
      <CategoryGrid categories={categories} />

      {/* Хичээлүүд — LESSON, BUNDLE */}
      <Suspense fallback={null}>
        <ProductSection
          title="Мэдлэгээ Өргөжүүлэх Хичээлүүд"
          href="/products?types=LESSON,BUNDLE"
          types="LESSON,BUNDLE"
        />
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
              <Button asChild variant="secondary" size="lg" className="font-bold">
                <Link href="/signup">Бүртгүүлэх</Link>
              </Button>
              <Button asChild size="lg" className="bg-white/15 border border-white/40 text-white hover:bg-white/25 font-semibold">
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
