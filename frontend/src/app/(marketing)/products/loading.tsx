import { Skeleton } from '@digitalger/shared/ui';

// /products руу шилжихэд (force-dynamic) fetch дуустал харагдах skeleton.
// page.tsx-ийн layout-той тааруулсан: зүүн filter sidebar + баруун grid (cols="three").
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-8">
        {/* Desktop filter sidebar skeleton */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24 rounded-2xl border border-border bg-card p-4">
            <Skeleton className="h-5 w-24" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-lg" />
              ))}
            </div>
            <Skeleton className="mt-6 h-5 w-20" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* PageHeader skeleton */}
          <div className="mb-6">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="mt-2 h-1 w-56 rounded-full" />
            <Skeleton className="mt-3 h-5 w-full max-w-md" />
          </div>

          {/* Mobile filter bar skeleton */}
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>

          {/* Product grid skeleton (cols="three": 2/3/3) */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
