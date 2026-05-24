export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { categoriesApi } from '@/lib/api';
import { DynamicLucideIcon } from '@/components/ui/lucide-icon';
import { PageHeader } from '@/components/ui/page-header';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Бүх Ангилал — DigitalGer',
  description: 'Файл, загвар, курс, баримт зэрэг дижитал бүтээгдэхүүний ангиллуудыг харж, өөрт тохирохыг олоорой.',
  alternates: { canonical: `${SITE_URL}/categories` },
  openGraph: {
    type: 'website',
    title: 'Бүх Ангилал — DigitalGer',
    description: 'Файл, загвар, курс, баримт зэрэг дижитал бүтээгдэхүүний ангиллуудыг харж, өөрт тохирохыг олоорой.',
    url: `${SITE_URL}/categories`,
  },
};

const COLORS = [
  'from-blue-500/20 to-blue-600/10 text-blue-600 dark:text-blue-400',
  'from-amber-500/20 to-amber-600/10 text-amber-600 dark:text-amber-400',
  'from-emerald-500/20 to-emerald-600/10 text-emerald-600 dark:text-emerald-400',
  'from-violet-500/20 to-violet-600/10 text-violet-600 dark:text-violet-400',
  'from-rose-500/20 to-rose-600/10 text-rose-600 dark:text-rose-400',
  'from-cyan-500/20 to-cyan-600/10 text-cyan-600 dark:text-cyan-400',
  'from-orange-500/20 to-orange-600/10 text-orange-600 dark:text-orange-400',
  'from-indigo-500/20 to-indigo-600/10 text-indigo-600 dark:text-indigo-400',
];

export default async function CategoriesPage() {
  let categories: Awaited<ReturnType<typeof categoriesApi.list>> = [];
  try {
    categories = await categoriesApi.list();
  } catch {
    categories = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title="Бүх Ангилал" description="Өөрт тохирох ангиллаас бүтээгдэхүүн хайж олоорой" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {categories.map((cat, i) => {
          const colorCls = COLORS[i % COLORS.length];
          return (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:-translate-y-1"
            >
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br transition-transform duration-200 group-hover:scale-110 group-hover:shadow-md ${colorCls}`}>
                <DynamicLucideIcon
                  name={cat.icon ?? null}
                  className="h-7 w-7"
                  fallback={<span className="text-xl font-bold leading-none">{cat.name.slice(0, 2).toUpperCase()}</span>}
                />
              </div>
              <div>
                <p className="font-semibold transition-colors group-hover:text-primary">{cat.name}</p>
                {cat._count?.products !== undefined && (
                  <p className="text-xs text-muted-foreground mt-0.5">{cat._count.products} бүтээгдэхүүн</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
