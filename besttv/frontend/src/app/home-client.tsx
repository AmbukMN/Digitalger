'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { cn } from '@besttv/shared';
import { ErrorState } from '@besttv/shared/ui';
import { useHome, useHomeBanners, usePromotionBanners } from '@/lib/queries';
import { HeroBanner } from '@/components/hero-banner';
import { TitleRow } from '@/components/title-row';
import { HomeBannerStrip } from '@/components/home-banner-strip';
import { PromotionBannerStrip } from '@/components/promotion-banner';
import { HomeSkeleton } from '@/components/home-skeleton';

export function HomeClient() {
  const { data, isLoading, isError, refetch } = useHome();
  /**
   * ⚠️ Баннер нь нүүрний датанаас ТУСДАА — ачаалагдаагүй ч хуудас
   * харагдана (`?? []`). Сурталчилгааны төлөө контентыг хүлээлгэхгүй.
   */
  const { data: banners = [] } = useHomeBanners();
  /* ⚠️ Урамшууллын баннер — админы гараар оруулсан баннераас ТУСДАА
     (энэ нь урамшуулалтай холбоотой, үлдсэн хугацааг тоолно) */
  const { data: promoBanners = [] } = usePromotionBanners();

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

  /**
   * ⚠️ Баннерыг `position`-оор бүлэглэнэ — эгнээ бүрийн дараа шалгахад
   * `filter` дуудвал O(эгнээ × баннер). Map нь нэг дамжилтаар бэлдэнэ.
   */
  const bannersByPosition = new Map<number, typeof banners>();
  for (const b of banners) {
    const arr = bannersByPosition.get(b.position);
    if (arr) arr.push(b);
    else bannersByPosition.set(b.position, [b]);
  }
  /**
   * ⚠️ Banner БАЙХГҮЙ үед `-mt-8` сөрөг margin нь эхний мөрийг header
   * ДООГУУР татаж, гарчиг navbar-тай давхцдаг байв. Сөрөг margin нь
   * зөвхөн hero-той үед утгатай (түүн дээр давхарлах зорилготой).
   */
  const hasHero = data.banners.length > 0;

  return (
    <main className="min-h-screen bg-background pb-16">
      <HeroBanner banners={data.banners} />

      {/* ⚠️ Нүүрэнд ЗӨВХӨН жанрын мөрүүд (Топ 10 / Шинээр нэмэгдсэн /
          Удахгүй гарах ЗОРИУД хасагдсан). Үргэлжлүүлэн үзэх нь хэрэглэгчийн
          өөрийнх тул үлдээв. */}
      <div
        className={cn(
          'relative z-10 space-y-9',
          hasHero ? 'pt-6 md:pt-8' : 'pt-24 md:pt-28',
        )}
      >
        {data.continueWatching.length > 0 && (
          <TitleRow
            title="Үргэлжлүүлэн үзэх"
            items={data.continueWatching}
            progressById={progressById}
            /* ⚠️ ҮРГЭЛЖ нэг мөр — цөөн кинотой ч 2 эгнээ болгож
               дэлгэцийн зай эзлэхгүй (бусад жанр 2 мөр хэвээр) */
            singleRow
          />
        )}

        {/* ⚠️ `position=0` — эгнээнүүдийн ӨМНӨ (хамгийн дээр) */}
        {bannersByPosition.get(0)?.map((b) => (
          <HomeBannerStrip key={b.id} banner={b} />
        ))}

        {/*
          ⚠️ ЖАНРЫН ЭГНЭЭ + ДУНД БАННЕР.
          Баннер бүр `position` талбартай — хэддэх эгнээний ДАРАА орохыг
          админ панелиас тохируулна. Ижил `position`-той олон баннер
          байвал `order`-оор эрэмбэлэгдэнэ (backend талд).
        */}
        {genreRows.map((row, i) => (
          <Fragment key={row.id}>
            <TitleRow
              title={row.name}
              items={row.titles}
              href={`/movies?genre=${row.slug}`}
              /* ⚠️ Гүйлгэхэд тухайн жанрын үлдсэн киног нэмж татна —
                 нүүр нь эгнээ бүрд 24 л өгдөг (анхны ачаалалт хурдан) */
              genreSlug={row.slug}
            />
            {bannersByPosition.get(i + 1)?.map((b) => (
              <HomeBannerStrip key={b.id} banner={b} />
            ))}

            {/*
              ⚠️⚠️ УРАМШУУЛЛЫН БАННЕР — 2 дахь эгнээний ДАРАА.
              Хамгийн дээр тавибал hero-той өрсөлдөж, доор тавибал
              ихэнх хэрэглэгч хүрэхгүй. Хоёр эгнээ гүйлгэсэн хүн нь
              «үзэх юм хайж байгаа» — багц санал болгох хамгийн зөв мөч.

              ⚠️ Хугацаа дууссаныг компонент нь өөрөө нуудаг тул энд
              шүүх шаардлагагүй.
            */}
            {i === 1 && promoBanners.map((pb) => (
              <PromotionBannerStrip key={pb.id} promo={pb} />
            ))}
          </Fragment>
        ))}

        {/*
          ⚠️ Эгнээнээс ХЭТЭРСЭН байрлалтай баннерууд — админ `position=99`
          гэж тохируулбал хаана ч гарахгүй алга болно. Тэднийг эцэст нь
          харуулна ("яагаад гарахгүй байна?" гэсэн гомдол гарахгүй).
        */}
        {banners
          .filter((b) => b.position > genreRows.length)
          .map((b) => (
            <HomeBannerStrip key={b.id} banner={b} />
          ))}

        {/* Жанр бүгд хоосон бол хэрэглэгч цоо хоосон хуудас харахгүй */}
        {genreRows.length === 0 && data.continueWatching.length === 0 && (
          <div className="px-4 py-16 text-center md:px-8">
            <p className="text-foreground/50">Контент удахгүй нэмэгдэнэ.</p>
            <Link
              href="/movies"
              className="mt-3 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
            >
              Бүх контент үзэх
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
