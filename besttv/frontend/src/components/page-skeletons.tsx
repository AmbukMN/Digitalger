/**
 * Хуудасны skeleton-ууд — `Suspense fallback`-д зориулсан.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: өмнө нь fallback нь ХООСОН `<div>` байсан тул
 * хэрэглэгч ачаалах хугацаанд цоо хоосон дэлгэц хараад "эвдэрсэн юм уу"
 * гэж боддог байв. Skeleton нь (1) ямар бүтэцтэй контент ирэхийг
 * урьдчилж харуулж, (2) контент ирэхэд layout ҮСЭРДЭГГҮЙ, (3) spinner-
 * ээс хамаагүй хурдан мэдрэгддэг (төслийн дүрэм: spinner БИШ skeleton).
 *
 * ⚠️ Гурван хуудсанд ижил код давтахгүйн тулд НЭГ файлд төвлөрүүлэв.
 */

/** Каталог/хайлт — гарчиг + шүүлтүүр + постерын grid */
export function CatalogSkeleton({ chips = 3 }: { chips?: number }) {
  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-24 md:px-8">
      <div className="skeleton-shimmer h-8 w-56 rounded md:h-9" />
      <div className="skeleton-shimmer mt-2 h-4 w-72 rounded" />

      <div className="mt-6 flex gap-2">
        {Array.from({ length: chips }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-8 w-24 rounded-full" />
        ))}
      </div>

      <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton-shimmer aspect-2/3 rounded-lg" />
            <div className="skeleton-shimmer mt-2 h-4 w-3/4 rounded" />
          </div>
        ))}
      </div>
    </main>
  );
}

/**
 * Плеер — 16:9 хар талбай + доорх мэдээлэл.
 * ⚠️ Дэвсгэр нь ҮРГЭЛЖ хар: видео гарах газар тул гэрэл горимд ч
 * цагаан байвал видео ачаалахад огцом харанхуйлж, нүд цохино.
 */
export function WatchSkeleton() {
  return (
    <main className="min-h-screen bg-black">
      <div className="skeleton-shimmer aspect-video w-full" />
      <div className="px-4 py-5 md:px-8">
        <div className="skeleton-shimmer h-6 w-1/2 rounded md:h-7" />
        <div className="skeleton-shimmer mt-3 h-4 w-24 rounded" />
      </div>
    </main>
  );
}
