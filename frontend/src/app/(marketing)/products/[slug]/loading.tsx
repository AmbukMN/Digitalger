import { Skeleton } from '@digitalger/shared/ui';

// Бүтээгдэхүүний дэлгэрэнгүй хуудасны skeleton — page.tsx-ийн layout-той тааруулав:
// breadcrumb → зүүн (gallery + гарчиг + тайлбар), баруун (purchase card md+).
export default function Loading() {
  return (
    <>
      {/* Breadcrumb skeleton */}
      <div className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5">
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px]">
          {/* Left column */}
          <div className="space-y-8 min-w-0">
            {/* Media gallery skeleton */}
            <div className="space-y-3">
              <Skeleton className="aspect-video w-full rounded-2xl" />
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-16 rounded-lg" />
                ))}
              </div>
            </div>

            {/* Title + meta skeleton */}
            <div className="space-y-3">
              <Skeleton className="h-8 w-3/4" />
              <div className="flex gap-3">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-28 rounded-full" />
              </div>
            </div>

            {/* Description skeleton */}
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>

            {/* Section block skeleton */}
            <div className="rounded-2xl border border-border bg-muted/30 p-5 sm:p-6 space-y-3">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>

          {/* Right sidebar (purchase card) — md+ */}
          <div className="hidden md:block">
            <div className="sticky top-24 rounded-2xl border border-border bg-card p-5 space-y-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <div className="space-y-2 pt-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
