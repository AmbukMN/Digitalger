import { Skeleton } from '@digitalger/shared/ui';

// Ангиллын дэлгэрэнгүй (бүтээгдэхүүний жагсаалт) skeleton —
// [slug]/page.tsx-ийн гарчиг + ProductGrid (default cols="four": 2/3/4) хэлбэртэй.
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Гарчиг + тайлбар skeleton */}
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-2 h-5 w-96 max-w-full" />

      {/* Product grid skeleton (cols="four") */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[4/3] w-full rounded-xl" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
