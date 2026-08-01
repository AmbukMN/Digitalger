'use client';

import Link from 'next/link';
import { ErrorState } from '@besttv/shared/ui';
import { useHome } from '@/lib/queries';
import { HeroBanner } from '@/components/hero-banner';
import { TitleRow } from '@/components/title-row';
import { HomeSkeleton } from '@/components/home-skeleton';

export default function HomePage() {
  const { data, isLoading, isError, refetch } = useHome();

  if (isLoading) return <HomeSkeleton />;

  // ⚠️ Алдааг ЗААВАЛ харуулна — өмнө нь `!data` үед мөнхийн skeleton дээр
  // гацдаг байсан (хамгийн их зочилдог хуудас тул онцгой чухал)
  if (isError || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 pt-16">
        <ErrorState
          title="Ачаалж чадсангүй"
          message="Сүлжээний алдаа гарлаа. Дахин оролдоно уу."
          onRetry={() => refetch()}
        />
      </main>
    );
  }

  // Continue-watching картуудад progress bar харуулах хувь
  const progressById = Object.fromEntries(
    data.continueWatching
      .filter((t) => t.progress?.durationSec > 0)
      .map((t) => [t.id, (t.progress.positionSec / t.progress.durationSec) * 100]),
  );

  const genreRows = data.genreRows.filter((r) => r.titles.length > 0);

  return (
    <main className="min-h-screen bg-background pb-16">
      <HeroBanner banners={data.banners} />

      {/* ⚠️ Нүүрэнд ЗӨВХӨН жанрын мөрүүд (Топ 10 / Шинээр нэмэгдсэн /
          Удахгүй гарах ЗОРИУД хасагдсан). Үргэлжлүүлэн үзэх нь хэрэглэгчийн
          өөрийнх тул үлдээв. */}
      <div className="relative z-10 -mt-8 space-y-9 md:-mt-12">
        {data.continueWatching.length > 0 && (
          <TitleRow
            title="Үргэлжлүүлэн үзэх"
            items={data.continueWatching}
            progressById={progressById}
          />
        )}

        {genreRows.map((row) => (
          <TitleRow
            key={row.id}
            title={row.name}
            items={row.titles}
            href={`/movies?genre=${row.slug}`}
          />
        ))}

        {/* Жанр бүгд хоосон бол хэрэглэгч цоо хоосон хуудас харахгүй */}
        {genreRows.length === 0 && data.continueWatching.length === 0 && (
          <div className="px-4 py-16 text-center md:px-8">
            <p className="text-white/50">Контент удахгүй нэмэгдэнэ.</p>
            <Link
              href="/movies"
              className="mt-3 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
            >
              Бүх контент үзэх
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
