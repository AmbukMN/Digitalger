export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Card, CardContent } from '@digitalger/shared/ui';
import Link from 'next/link';
import { categoriesApi } from '@/lib/api';

export const metadata: Metadata = { title: 'Ангилал' };

export default async function CategoriesPage() {
  let categories: Awaited<ReturnType<typeof categoriesApi.list>> = [];
  try {
    categories = await categoriesApi.list();
  } catch {
    categories = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold">Бүх Ангилал</h1>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {categories.map((cat) => (
          <Link key={cat.id} href={`/categories/${cat.slug}`}>
            <Card className="hover:border-primary/50">
              <CardContent className="p-6 text-center font-medium">{cat.name}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
