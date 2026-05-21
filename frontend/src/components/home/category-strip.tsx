import Link from 'next/link';
import { categoriesApi } from '@/lib/api';

const CATEGORY_ICONS: Record<string, string> = {
  templates: '🎨',
  documents: '📄',
  courses: '🎓',
  files: '📁',
  videos: '🎬',
  designs: '✏️',
  music: '🎵',
  software: '💻',
  photos: '📷',
  fonts: '🔤',
};

export async function CategoryStrip() {
  let categories: Awaited<ReturnType<typeof categoriesApi.list>> = [];
  try {
    categories = await categoriesApi.list();
  } catch {
    categories = [];
  }

  if (!categories.length) return null;

  return (
    <section className="py-10 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">Ангиллаар хайх</h2>
            <p className="text-sm text-muted-foreground mt-1">Хэрэгтэй ангиллаасаа хайгаад шийдлээ нэн даруй татаж ав</p>
          </div>
          <Link href="/categories" className="text-sm font-medium text-primary hover:underline">
            Бүх ангилал →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {categories.slice(0, 12).map((cat) => {
            const icon = CATEGORY_ICONS[cat.slug] ?? '📦';
            return (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-background p-4 text-center transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
              >
                <span className="text-3xl transition-transform group-hover:scale-110">{icon}</span>
                <div>
                  <p className="text-sm font-semibold group-hover:text-primary transition-colors">{cat.name}</p>
                  {cat._count?.products !== undefined && (
                    <p className="text-xs text-muted-foreground mt-0.5">{cat._count.products} бүтээгдэхүүн</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
