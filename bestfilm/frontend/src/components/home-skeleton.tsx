export function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Ачааллаж байна">
      <div className="skeleton-shimmer h-[62vw] max-h-180 min-h-105 w-full" />
      <div className="space-y-9 px-4 py-8 md:px-8">
        {[0, 1, 2].map((row) => (
          <div key={row} className="space-y-3">
            <div className="skeleton-shimmer h-5 w-44 rounded" />
            <div className="flex gap-3">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="skeleton-shimmer aspect-2/3 w-37.5 shrink-0 rounded-lg sm:w-45" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
