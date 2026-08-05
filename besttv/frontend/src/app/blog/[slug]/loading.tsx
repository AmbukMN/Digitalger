/**
 * Блог нийтлэлийн skeleton — spinner БИШ (төслийн дүрэм).
 * Гарчиг → мета → cover → догол мөрүүд гэсэн бодит layout-ыг дуурайна.
 */
export default function Loading() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-16 pt-24 md:px-8">
      <div className="skeleton-shimmer h-9 w-5/6 rounded md:h-11" />
      <div className="mt-3 flex gap-2">
        <div className="skeleton-shimmer h-4 w-24 rounded" />
        <div className="skeleton-shimmer h-4 w-20 rounded" />
      </div>

      <div className="skeleton-shimmer mt-6 aspect-video w-full rounded-xl" />

      <div className="mt-8 space-y-3">
        {[
          'w-full',
          'w-11/12',
          'w-full',
          'w-4/5',
          'w-full',
          'w-3/4',
          'w-full',
          'w-2/3',
        ].map((w, i) => (
          <div key={i} className={`skeleton-shimmer h-4 rounded ${w}`} />
        ))}
      </div>
    </main>
  );
}
