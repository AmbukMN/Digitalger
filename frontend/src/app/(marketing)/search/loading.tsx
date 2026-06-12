import { Skeleton } from '@digitalger/shared/ui';

// Хайлтын үр дүнгийн skeleton — search/page.tsx-ийн layout-той тааруулав:
// PageHeader → бүтээгдэхүүний grid (2/3/4/5) → нийтлэлийн grid (sm:grid-cols-2).
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* PageHeader skeleton */}
      <div className="mb-10">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-1 w-56 rounded-full" />
        <Skeleton className="mt-3 h-5 w-72 max-w-full" />
      </div>

      {/* Бүтээгдэхүүн section skeleton */}
      <section className="mb-12">
        <div className="mb-4 flex items-center gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[4/3] w-full rounded-xl" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </section>

      {/* Нийтлэл section skeleton */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 rounded-xl border border-border bg-card p-4">
              <Skeleton className="h-16 w-24 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
