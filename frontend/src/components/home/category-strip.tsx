import Link from 'next/link';
import { categoriesApi } from '@/lib/api';
import { CategorySwiper } from './category-swiper';
import { ArrowRight } from 'lucide-react';
import { Button } from '@digitalger/shared/ui';

export async function CategoryStrip() {
  let categories: Awaited<ReturnType<typeof categoriesApi.list>> = [];
  try {
    categories = await categoriesApi.list();
  } catch {
    categories = [];
  }

  if (!categories.length) return null;

  return (
    <section className="py-8 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header — same style as ProductSection */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-primary shrink-0" aria-hidden="true" />
            <h2 className="text-2xl font-bold">Ангиллаар үзэх</h2>
          </div>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground hover:text-foreground">
            <Link href="/categories">
              Бүгдийг харах
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* px-6 gives room for -left-5/-right-5 nav buttons; overflow-visible lets hover shadow show */}
        <div className="px-6 overflow-visible">
          <CategorySwiper categories={categories} />
        </div>
      </div>
    </section>
  );
}
