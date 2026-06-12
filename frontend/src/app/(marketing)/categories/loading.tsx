import { Skeleton } from '@digitalger/shared/ui';

// Ангиллын жагсаалтын skeleton — categories/page.tsx-ийн grid-тэй тааруулав
// (2/3/4/5 багана, дугуй icon + нэр).
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* PageHeader skeleton */}
      <div className="mb-10">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-1 w-48 rounded-full" />
        <Skeleton className="mt-3 h-5 w-80 max-w-full" />
      </div>

      {/* Categories grid skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5"
          >
            <Skeleton className="h-16 w-16 rounded-2xl" />
            <div className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
