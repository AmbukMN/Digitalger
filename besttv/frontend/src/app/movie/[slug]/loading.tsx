/**
 * Кино дэлгэрэнгүйн skeleton.
 *
 * ⚠️ Өмнө нь `loading.tsx` ОГТ БАЙГААГҮЙ — ISR кэш байхгүй үед (шинэ кино,
 * revalidate дууссан, эхний зочин) хэрэглэгч ХООСОН ЦАГААН дэлгэц хараад
 * хүлээдэг байв. Spinner БИШ skeleton — контентын байрлалыг урьдчилж
 * харуулснаар "хурдан" мэдрэгддэг.
 *
 * ⚠️⚠️ Хэмжээс нь `title-detail-client.tsx`-ийн БОДИТ layout-той ЯГ таарна
 * (hero `h-[46vw] max-h-[520px] min-h-[300px]`, постер `w-40 md:w-56`,
 * `-mt-24`, `px-4 md:px-8`). Зөрвөл контент ирэхэд хуудас ҮСЭРЧ, skeleton
 * байхгүйгээс ч дор мэдрэгдэнэ.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-background pb-16">
      {/* Hero backdrop */}
      <section className="skeleton-shimmer relative h-[46vw] max-h-[520px] min-h-[300px] w-full" />

      <div className="relative -mt-24 px-4 md:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end">
          {/* Постер 2:3 */}
          <div className="skeleton-shimmer aspect-2/3 w-40 shrink-0 rounded-lg shadow-2xl md:w-56" />

          <div className="flex-1 space-y-3 pb-1">
            {/* Гарчиг */}
            <div className="skeleton-shimmer h-8 w-3/4 rounded md:h-10" />
            {/* Мета мөр — он · үргэлжлэх хугацаа · насны ангилал */}
            <div className="flex flex-wrap gap-2">
              <div className="skeleton-shimmer h-5 w-14 rounded" />
              <div className="skeleton-shimmer h-5 w-16 rounded" />
              <div className="skeleton-shimmer h-5 w-12 rounded" />
            </div>
            {/* Үзэх / Дуртай товч */}
            <div className="flex gap-2 pt-1">
              <div className="skeleton-shimmer h-11 w-36 rounded-lg" />
              <div className="skeleton-shimmer h-11 w-11 rounded-full" />
            </div>
          </div>
        </div>

        {/* Тайлбар — бодит нь `mt-4 max-w-2xl` */}
        <div className="mt-4 max-w-2xl space-y-2">
          <div className="skeleton-shimmer h-4 w-full rounded" />
          <div className="skeleton-shimmer h-4 w-11/12 rounded" />
          <div className="skeleton-shimmer h-4 w-2/3 rounded" />
        </div>

        {/* Төстэй кино эгнээ */}
        <div className="mt-10">
          <div className="skeleton-shimmer mb-3 h-6 w-40 rounded" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer aspect-2/3 w-37.5 shrink-0 rounded-lg sm:w-45" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
