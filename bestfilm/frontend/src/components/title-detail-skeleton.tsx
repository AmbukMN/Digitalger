import { Skeleton } from '@besttv/shared/ui';

export function TitleDetailSkeleton() {
  return (
    <main className="min-h-screen bg-background pb-16" aria-busy="true" aria-label="Ачааллаж байна">
      <div className="relative h-[46vw] max-h-[520px] min-h-[300px] w-full bg-muted" />
      <div className="relative -mt-24 px-4 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row">
          <Skeleton className="aspect-2/3 w-40 shrink-0 rounded-lg md:w-56" />
          <div className="flex-1 space-y-4 pt-2">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full max-w-2xl" />
            <div className="flex gap-3">
              <Skeleton className="h-11 w-36" />
              <Skeleton className="h-11 w-44" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
