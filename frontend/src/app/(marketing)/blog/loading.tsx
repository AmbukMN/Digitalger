import { Skeleton } from '@digitalger/shared/ui';

// Нийтлэлийн жагсаалтын skeleton — blog/page.tsx + blog-infinite-list-ийн
// BlogCardSkeleton хэлбэртэй (grid sm:grid-cols-2 lg:grid-cols-3).
function BlogCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <Skeleton className="aspect-video w-full" />
      <div className="p-5 space-y-3">
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3.5 w-2/3 mt-2" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* PageHeader skeleton */}
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-2 h-1 w-40 rounded-full" />
          <Skeleton className="mt-3 h-5 w-72 max-w-full" />
        </div>
        <Skeleton className="hidden sm:block h-5 w-28" />
      </div>

      {/* Blog grid skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <BlogCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
