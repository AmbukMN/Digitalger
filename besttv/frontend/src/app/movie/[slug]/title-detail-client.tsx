'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Heart, Film, Lock, Play, Star, Ticket, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn, episodeLabel, formatPrice, formatRentDurationShort, formatRentLeft } from '@besttv/shared';
import { ErrorState } from '@besttv/shared/ui';
import { useTitleDetail } from '@/lib/queries';
import { useAuth } from '@/lib/auth-store';
import { useMyListStore } from '@/lib/my-list-store';
import { trackTitle } from '@/lib/track';
import { TitleRow } from '@/components/title-row';
import { TitleDetailSkeleton } from '@/components/title-detail-skeleton';
import { CastRow } from '@/components/title/cast-row';
import { TrailerModal } from '@/components/title/trailer-modal';
import { ShareButton } from '@/components/title/share-button';
import { GalleryRow } from '@/components/title/gallery-row';
import { ReviewsSection } from '@/components/title/reviews-section';
import { RentDialog } from '@/components/title/rent-dialog';
import { consumeAuthIntent, savePostPurchaseReturn } from '@/lib/auth-intent';

/**
 * ⚠️ СЭТГЭГДЭЛ ТҮР ХААЛТТАЙ.
 * Дахин нээхдээ ЗӨВХӨН энэ утгыг `true` болгоно — өөр юу ч засах шаардлагагүй.
 * Дата устаагүй: админ талд сэтгэгдэл хэвээр, зөвхөн нийтэд харуулахгүй.
 */
const REVIEWS_ENABLED = false;

export function TitleDetailClient({ slug }: { slug: string }) {
  const { data, isLoading, isError, refetch } = useTitleDetail(slug);
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const [activeSeason, setActiveSeason] = useState(0);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [myListPending, setMyListPending] = useState(false);
  const [rentOpen, setRentOpen] = useState(false);
  const inList = useMyListStore((s) => (data ? s.has(data.id) : false));
  const toggleMyListStore = useMyListStore((s) => s.toggle);

  /**
   * ⚠️ Нэвтэрсний дараа "түрээслэх" үйлдлийг үргэлжлүүлнэ — зочин байхдаа
   * түрээслэх дарж нэвтэрсэн бол буцаж ирээд модал АВТОМАТ нээгдэнэ.
   */
  const rentIntentRan = useRef(false);
  useEffect(() => {
    if (!user || !data || rentIntentRan.current) return;
    const intent = consumeAuthIntent();
    if (intent?.type !== 'rent-title' || intent.titleId !== data.id) return;
    rentIntentRan.current = true;
    if (data.rental?.available && !data.hasAccess) setRentOpen(true);
  }, [user, data]);

  // Analytics: тухайн киног ҮЗЭХЭЭР нээсэн — нэг хуудсанд нэг удаа
  const viewTracked = useRef<string | null>(null);
  useEffect(() => {
    if (!data || viewTracked.current === data.id) return;
    viewTracked.current = data.id;
    trackTitle({ type: 'view', titleId: data.id, titleSlug: slug, titleName: data.title });
  }, [data, slug]);

  if (isLoading) return <TitleDetailSkeleton />;

  if (isError || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 pt-16">
        <ErrorState
          title="Контент олдсонгүй"
          message="Хайж буй кино байхгүй эсвэл устгагдсан байна."
          onRetry={() => refetch()}
        />
      </main>
    );
  }

  /**
   * ⚠️ Эрх нь багц ↔ жанраар тодорхойлогдоно (backend `hasAccess` буцаана).
   * Хуучин "premium эсэх" ганц шалгуур ХАНГАЛТГҮЙ.
   *
   * ⚠️⚠️ `hasAccess === undefined` = ХАРИУ ХАРААХАН ИРЭЭГҮЙ (нэвтрэх үед
   * placeholder эрхийн талбарыг цэвэрлэдэг). Тэр үед ТҮГЖЭЭТЭЙ гэж
   * ҮЗЭХГҮЙ — эс бөгөөс төлбөр төлсөн хэрэглэгчид «Багц авах» товч
   * анивчиж гарна (бодит гомдол).
   */
  const accessKnown = data.hasAccess !== undefined;
  const locked = data.isPremium && accessKnown && !data.hasAccess;
  const cheapestPlan = data.requiredPlans?.length
    ? [...data.requiredPlans].sort((a, b) => a.price - b.price)[0]
    : null;
  const seasons = data.seasons ?? [];
  const firstPlayableEpisode = seasons.flatMap((s) => s.episodes).find((e) => e.playable);

  /**
   * ⚠️⚠️ ҮНЭГҮЙ ТАНИЛЦУУЛГА АНГИ — ЭРХГҮЙ ХҮНД Ч ҮЗҮҮЛНЭ.
   *
   * БОДИТ АЛДАА: `locked` үед дээд талын товч ҮРГЭЛЖ `/pricing` руу
   * явуулдаг байв. Гэтэл backend нь `isFreePreview` ангийг эрхгүй
   * хүнд ЗӨВШӨӨРДӨГ (`stream.service.ts`: `isPremium && !isFreePreview`).
   *
   * Үр дүн: 1-р ангиа үнэгүй болгосон цувралд зочин орж ирэхэд зөвхөн
   * «Багц авах» харагдана. Үнэгүй анги нь ЗӨВХӨН доод талын ангийн
   * жагсаалтад л байдаг — гар утсан дээр эхний дэлгэцэнд ОГТ харагдахгүй
   * тул ихэнх хүн скролл хийлгүй гардаг. Хамгийн чухал татах суваг
   * (үнэгүй үзүүлээд дараа нь худалдан авах) бүрэн алдагдаж байв.
   */
  const freePreviewEpisode = seasons
    .flatMap((s) => s.episodes)
    .find((e) => e.isFreePreview && e.playable);

  // ⚠️ Зочин ч дуртай кино нэмнэ (localStorage). Нэвтрэхэд серверт нийлнэ.
  const toggleMyList = async () => {
    setMyListPending(true);
    try {
      await toggleMyListStore(data.id);
      qc.invalidateQueries({ queryKey: ['my-list'] });
    } catch {
      toast.error('Алдаа гарлаа, дахин оролдоно уу');
    } finally {
      setMyListPending(false);
    }
  };

  /* ⚠️ Эрхгүй ч ҮНЭГҮЙ анги байвал тэр рүү нь явуулна (дээрх тайлбар) */
  const watchHref = locked
    ? freePreviewEpisode
      ? `/watch/${data.slug}?ep=${freePreviewEpisode.id}`
      : '/pricing'
    : data.type === 'MOVIE'
      ? `/watch/${data.slug}`
      : firstPlayableEpisode
        ? `/watch/${data.slug}?ep=${firstPlayableEpisode.id}`
        : undefined;

  return (
    <main className="min-h-screen bg-background pb-16">
      <section className="relative h-[46vw] max-h-[520px] min-h-[300px] w-full">
        {/*
          ⚠️⚠️ БУЦАХ ТОВЧ — өмнө нь ОГТ БАЙГААГҮЙ (админы гомдол).

          Хэрэглэгч нүүр/хайлт/жанраас кино руу орвол гарах цорын ганц
          зам нь browser-ийн back байсан. Гар утсанд тэр товч далд
          (заримдаа зөвхөн зангаагаар), FB/IG webview-д БАЙХГҮЙ.

          ⚠️ Яагаад `router.back()` вэ (`/movies` БИШ): хэрэглэгч энэ
          хуудсанд ОЛОН замаар ирдэг — нүүр, хайлт, жанр, «Ижил төстэй»,
          миний дуртай. Тодорхой зам руу хатуу явуулбал 5 тохиолдлын
          4-д нь БУРУУ болно. Player-ийнхээс ЯЛГААТАЙ: тэнд түүх
          эвдэрдэг байсан тул зорилтот хуудас зөв байв, харин энд түүх
          цэвэр (`replace` ашигласнаар).

          ⚠️ Түүхгүй үед (шинэ таб, хуваалцсан холбоос) нүүр рүү унана.
        */}
        <button
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push('/');
          }}
          aria-label="Буцах"
          /**
           * ⚠️⚠️ «БУЦАХ» БИЧГИЙГ ГАР УТСАНД Ч ХАРУУЛНА.
           *
           * БОДИТ АСУУДАЛ: `hidden sm:inline` тул утсан дээр ЗӨВХӨН
           * сум харагдаж, хэрэглэгч «энэ юуны товч вэ» гэж ойлгохгүй
           * байв. Дүрс тэмдэг ганцаараа хоёрдмол — зүүн сум нь
           * «өмнөх анги», «зүүн тийш гүйлгэх» гэж ч ойлгогдоно.
           *
           * ⚠️ `bg-black/70` + border — гэрэлтэй backdrop дээр
           * `bg-black/50` нь БҮДГЭРЧ, товч огт харагдахгүй байв.
           * ⚠️ `h-11` — Apple/Google-ийн хүрэх талбайн доод хязгаар.
           */
          /**
           * ⚠️⚠️ NAVBAR-ЫН ДООР — ард нь ОРЖ ДАВХЦАЖ байсныг зассан.
           *
           * БОДИТ АЛДАА: navbar нь `fixed top-0 z-50`, товч нь
           * `top-3 z-20` байсан тул ТУСЛАХ БОЛОМЖГҮЙ давхцаж, лого
           * болон цэсний ард ороод дарагдахгүй байв.
           *
           * ⚠️ `top-20` (80px) = navbar-ын 64px + 16px зай.
           * ⚠️ `z-30` — hero-гийн градиентээс дээр, navbar-аас ДООР
           *   (navbar-тай өрсөлдөх ёсгүй — тэр нь үргэлж дээр байна).
           * ⚠️ Гар утсанд navbar доод талд шилждэг (bottom nav) ч
           *   дээд мөр нь үлддэг тул ижил зай хэрэгтэй.
           */
          className="absolute left-3 top-20 z-30 flex h-11 items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-4 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition-colors hover:bg-black/85 focus-visible:ring-2 focus-visible:ring-white/70 md:left-6"
        >
          <ArrowLeft size={17} />
          Буцах
        </button>
        {data.backdropUrl ? (
          /**
           * ⚠️⚠️ `object-top` — ДЭЭД ТАЛ таслагдахгүй.
           *
           * Анхдагч `object-cover` нь ГОЛООС тайрдаг тул киноны
           * backdrop дээрх жүжигчдийн ТОЛГОЙ таслагддаг байв
           * (Agent Kim дээр бодитоор харагдсан). Постер/backdrop-д
           * гол зүйл (нүүр, гарчиг, лого) дээд талдаа байдаг.
           */
          <Image
            src={data.backdropUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-top"
          />
        ) : data.posterUrl ? (
          /**
           * ⚠️ BACKDROP БАЙХГҮЙ ҮЕД — ПОСТЕРЫГ дэвсгэр болгоно.
           *
           * Өмнө нь `bg-[#141414]` дээр жижиг icon гардаг байсан нь
           * ХООСОН ХАР ТАЛБАЙ болж маш эвгүй харагддаг байв
           * (хэрэглэгчийн гомдол). Одоо постерыг томруулж, хүчтэй
           * бүдгэрүүлээд өнгөт дэвсгэр болгоно — Spotify/Netflix-ийн
           * ашигладаг арга, кино бүрд өөрийн өнгөтэй болно.
           */
          <div className="h-full w-full overflow-hidden">
            <Image
              src={data.posterUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className="scale-110 object-cover blur-2xl"
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center bg-muted text-foreground/15">
            <Film size={64} />
          </div>
        )}
        <div className="hero-gradient absolute inset-0" />

      </section>

      <div className="relative -mt-24 px-4 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row">
          {/*
            ⚠️⚠️ МОБАЙЛД — постер ЗҮҮН, үндсэн товч БАРУУН талд зэрэгцэнэ.
            Өмнө нь товчнууд постерын ДООР байсан тул хэрэглэгч "Үзэх"
            хүртэл гүйлгэх шаардлагатай байв (хамгийн чухал үйлдэл нь
            эхний дэлгэцэд ҮЛ ХАРАГДДАГ). Десктопт хуучин байрлал хэвээр.
          */}
          <div className="flex items-end gap-4 md:block">
            <div className="relative aspect-2/3 w-32 shrink-0 overflow-hidden rounded-lg bg-foreground/5 shadow-2xl sm:w-40 md:w-56">
              {data.posterUrl ? (
                <Image src={data.posterUrl} alt={data.title} fill sizes="220px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-foreground/20">
                  <Film size={40} />
                </div>
              )}
            </div>

            {/* Мобайлын үндсэн үйлдэл — постерын хажууд, шууд харагдана */}
            <div className="flex min-w-0 flex-1 flex-col gap-2 pb-1 md:hidden">
              {locked ? (
                <>
                  {/* ⚠️ ҮНЭГҮЙ АНГИ — ХАМГИЙН ДЭЭР, хамгийн тод (дээрх тайлбар).
                       Худалдан авахаас өмнө үзүүлэх нь гол татах суваг. */}
                  {freePreviewEpisode && (
                    <Link
                      href={`/watch/${data.slug}?ep=${freePreviewEpisode.id}`}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-3 text-sm font-bold text-background shadow-lg active:scale-[0.98]"
                    >
                      <Play size={16} fill="currentColor" />
                      {freePreviewEpisode.number}-р анги үнэгүй үзэх
                    </Link>
                  )}
                  {data.rental?.available && (
                    <button
                      onClick={() => setRentOpen(true)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground active:scale-[0.98]"
                    >
                      <Ticket size={15} />
                      {formatPrice(data.rental.price)} · {formatRentDurationShort(data.rental.hours)}
                    </button>
                  )}
                  <Link
                    href="/pricing"
                    onClick={() => savePostPurchaseReturn()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-premium-solid px-3 py-2.5 text-xs font-bold text-premium-foreground active:scale-[0.98]"
                  >
                    <Lock size={15} /> Багц авах
                  </Link>
                </>
              ) : watchHref ? (
                <Link
                  href={watchHref}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-3 text-sm font-bold text-background shadow-lg active:scale-[0.98]"
                >
                  <Play size={16} fill="currentColor" /> Үзэх
                </Link>
              ) : null}

              {/*
                ⚠️ ТРЕЙЛЕР — МОБАЙЛД "Үзэх" товчны ЯГ ДООР.
                Өмнө нь тайлбарын доод талд байсан тул үндсэн товчноос
                САЛЖ, хооронд нь мета/тайлбар орж, хэрэглэгч доош гүйлгэж
                байж л олдог байв. Десктопт хуучнаар үйлдлийн мөрөнд.
                ⚠️ Хоёрдогч үйлдэл тул СУЛ өнгөөр — "Үзэх"-тэй өрсөлдөхгүй.
              */}
              {data.trailerAvailable && (
                <button
                  onClick={() => setTrailerOpen(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground/10 px-3 py-2.5 text-xs font-semibold text-foreground active:scale-[0.98]"
                >
                  <Film size={15} /> Трейлер
                </button>
              )}

              {/*
                ⚠️ ТҮРЭЭСИЙН ҮЛДЭГДЭЛ — МОБАЙЛД товчны ЯГ ДООР.
                Өмнө нь гарчиг/тайлбарын доор байсан тул хэрэглэгч
                товчоо дараад доош гүйлгэж байж л хугацаагаа хардаг байв.
              */}
              {data.rental?.active && (
                <p className="flex items-center justify-center gap-1 rounded-lg bg-success/12 px-2 py-1.5 text-[11px] font-semibold leading-tight text-success">
                  <Clock size={11} className="shrink-0" />
                  {formatRentLeft(data.rental.active.expiresAt)} үлдлээ
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 pt-2">
            {/*
              ⚠️ МОБАЙЛД дуртай/хуваалцах icon нь гарчигийн БАРУУН талд
              (өөрийн зайд л багтана). Өмнө нь товчнуудын доор тусдаа мөр
              эзэлж, дэлгэцийн зай дэмий алдагддаг байв.
              ДЕСКТОПТ хуучнаар товчнуудын хажууд үлдэнэ.
            */}
            <div className="flex items-start gap-3">
              <h1 className="min-w-0 flex-1 text-2xl font-black text-foreground md:text-4xl">
                {data.title}
              </h1>
              <div className="flex shrink-0 items-center gap-2 md:hidden">
                <IconAction
                  onClick={toggleMyList}
                  disabled={myListPending}
                  pressed={inList}
                  label={inList ? 'Дуртайгаас хасах' : 'Дуртай кинонд нэмэх'}
                >
                  <Heart size={17} className={inList ? 'fill-current' : ''} />
                </IconAction>
                <ShareButton title={data.title} slug={data.slug} compact />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-foreground/70">
              {data.year && <span>{data.year}</span>}
              {data.ageRating && (
                <span className="rounded border border-foreground/30 px-1.5 py-0.5 text-xs font-semibold">
                  {data.ageRating}
                </span>
              )}
              {/*
                ⚠️ Үнэлгээ 0 бол ХАРУУЛАХГҮЙ. Өмнө нь `!= null` шалгадаг
                байсан тул үнэлгээ оруулаагүй кинонд "★ 0.0" гэж гарч,
                муу үнэлгээтэй мэт харагддаг байв.
              */}
              {(() => {
                const score =
                  data.reviewStats.count > 0 ? data.reviewStats.average : data.rating;
                if (!score || score <= 0) return null;
                return (
                  <span className="flex items-center gap-1">
                    <Star size={14} className="fill-premium text-premium" />
                    {score.toFixed(1)}
                    {data.reviewStats.count > 0 && (
                      <span className="text-foreground/40">({data.reviewStats.count})</span>
                    )}
                  </span>
                );
              })()}
              {data.director && <span>Найруулагч: {data.director}</span>}
              {/*
                ⚠️⚠️ ЖАНР = ДАРЖ БОЛОХ ХОЛБООС (админы хүсэлт).
                Өмнө нь `<span>` байсан тул хэрэглэгч «Шилдэг кино» гэж
                харах ч дарж чадахгүй — ижил жанрын бусад киног олохын
                тулд Кино хуудас руу орж, шүүлтээс дахин сонгох ёстой
                байв. Жанрын нэр дарагдахад хүлээлт нь ҮРГЭЛЖ «энэ
                ангилал руу очно» гэсэн байдаг.
              */}
              {data.genres?.map((g) => (
                <Link
                  key={g.id}
                  href={`/movies?genre=${encodeURIComponent(g.slug)}`}
                  className="rounded bg-foreground/10 px-2 py-0.5 transition-colors hover:bg-primary/20 hover:text-primary"
                >
                  {g.name}
                </Link>
              ))}
            </div>

            {/* ⚠️ Тайлбар хоосон бол хоосон зай үлдээхгүй */}
            {data.description?.trim() && (
              <p className="mt-4 max-w-2xl text-sm text-foreground/80 md:text-base">
                {data.description}
              </p>
            )}

            {/*
              ⚠️ ЯГ 2 үндсэн товч — "Түрээслэх" ба "Багц авах". Дуртай/Хуваалцах
              нь ЗӨВХӨН icon (текстгүй) — эс бөгөөс товч олширч хэрэглэгчийн
              нүд эргэдэг. Мобайлд үндсэн товч бүтэн өргөн, icon-ууд доор.
            */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {/* ⚠️ МОБАЙЛД НУУНА — эдгээр товч постерын хажууд аль хэдийн
                  гарсан (дээр). Хоёр газар харуулбал давхардана. */}
              <div className="hidden flex-col gap-2.5 sm:flex-row md:flex">
                {locked ? (
                  <>
                    {/* ⚠️ ҮНЭГҮЙ АНГИ — ХАМГИЙН ЭХЭНД, хамгийн тод товчоор.
                         Эрхгүй хүн ч үзэж чадна (дээрх тайлбарыг үз). */}
                    {freePreviewEpisode && (
                      <Link
                        href={`/watch/${data.slug}?ep=${freePreviewEpisode.id}`}
                        className="flex items-center justify-center gap-2 rounded-lg bg-foreground px-8 py-3 font-semibold text-background shadow-lg transition-all hover:opacity-90 active:scale-[0.98] sm:py-2.5"
                      >
                        <Play size={18} fill="currentColor" />
                        {freePreviewEpisode.number}-р анги үнэгүй үзэх
                      </Link>
                    )}
                    {/* Ширхэгээр түрээслэх — багц авахгүйгээр яг энэ киног үзнэ */}
                    {data.rental?.available && (
                      <button
                        onClick={() => setRentOpen(true)}
                        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] sm:py-2.5"
                      >
                        <Ticket size={17} />
                        {formatPrice(data.rental.price)} · {formatRentDurationShort(data.rental.hours)} түрээслэх
                      </button>
                    )}
                    {/*
                      ⚠️ Буцах замыг ХАДГАЛНА — төлбөр төлж эрх нээгдмэгц
                      хэрэглэгч ЭНЭ КИНО руугаа буцна. Өмнө нь /pricing дээр
                      үлдээд өөрөө буцаж хайх шаардлагатай байв.
                    */}
                    <Link
                      href="/pricing"
                      onClick={() => savePostPurchaseReturn()}
                      className="flex items-center justify-center gap-2 rounded-lg bg-premium-solid px-6 py-3 font-semibold text-premium-foreground transition-all hover:brightness-105 active:scale-[0.98] sm:py-2.5"
                    >
                      <Lock size={17} />
                      Багц авах
                    </Link>
                  </>
                ) : watchHref ? (
                  <Link
                    href={watchHref}
                    className="flex items-center justify-center gap-2 rounded-lg bg-foreground px-8 py-3 font-semibold text-background shadow-lg transition-all hover:opacity-90 active:scale-[0.98] sm:py-2.5"
                  >
                    {/* ⚠️ `fill="black"` БАЙВ — товч нь `bg-foreground
                        text-background` тул light горимд ХАР дэвсгэр дээр
                        ХАР гурвалжин болж, тоглуулах дүрс АЛГА болдог байв */}
                    <Play size={18} fill="currentColor" /> Үзэх
                  </Link>
                ) : (
                  <span className="flex items-center justify-center gap-2 rounded-lg bg-foreground/10 px-6 py-3 font-semibold text-foreground/40 sm:py-2.5">
                    Удахгүй гарна
                  </span>
                )}
              </div>

              {/*
                Трейлер / Дуртай / Хуваалцах — ЗӨВХӨН icon.
                ⚠️ САВЫГ ӨӨРИЙГ НЬ нуув: доторх 3 товч бүгд `md:` тул
                мобайлд сав ХООСОН үлдэж, эцгийн `gap-3` дэмий зай эзэлнэ.
              */}
              <div className="hidden items-center gap-2.5 md:flex">
                {/* ⚠️ Трейлер нь баннерын буланд НУУГДМАЛ байсан — үйлдлийн
                    мөрөнд гаргаж ил болгов.
                    ⚠️ ЗӨВХӨН ДЕСКТОПТ (`hidden md:flex`) — мобайлд "Үзэх"
                    товчны яг доор аль хэдийн гарсан (дээрээс харна уу).
                    Хоёр газар харуулбал ДАВХАРДАНА. */}
                {data.trailerAvailable && (
                  <button
                    onClick={() => setTrailerOpen(true)}
                    title="Трейлер үзэх"
                    aria-label="Трейлер үзэх"
                    className="hidden h-11 items-center justify-center gap-1.5 rounded-full bg-foreground/10 px-4 text-sm font-medium text-foreground transition-all hover:bg-foreground/20 active:scale-95 md:flex"
                  >
                    <Film size={16} /> Трейлер
                  </button>
                )}

                {/* ⚠️ Мобайлд эдгээр нь ГАРЧИГИЙН хажууд зөөгдсөн (дээрээс
                    харна уу) тул энд зөвхөн десктоп дээр харагдана. */}
                <button
                  onClick={toggleMyList}
                  disabled={myListPending}
                  aria-pressed={inList}
                  title={inList ? 'Дуртайгаас хасах' : 'Дуртай кинонд нэмэх'}
                  aria-label={inList ? 'Дуртайгаас хасах' : 'Дуртай кинонд нэмэх'}
                  className={cn(
                    'hidden h-11 w-11 items-center justify-center rounded-full text-foreground transition-all active:scale-95 disabled:opacity-50 md:flex',
                    inList ? 'bg-primary hover:brightness-110' : 'bg-foreground/10 hover:bg-foreground/20',
                  )}
                >
                  <Heart size={19} className={inList ? 'fill-current' : ''} />
                </button>

                <span className="hidden md:contents">
                  <ShareButton title={data.title} slug={data.slug} />
                </span>
              </div>
            </div>

            {/* Идэвхтэй түрээс — ДЕСКТОПТ (мобайлд Үзэх товчны доор) */}
            {data.rental?.active && (
              <div className="mt-4 hidden max-w-2xl items-center gap-2 rounded-xl border border-success/25 bg-success/10 px-4 py-2.5 text-sm text-success md:flex">
                <Clock size={15} />
                Түрээсэлсэн — {formatRentLeft(data.rental.active.expiresAt)} үлдлээ
              </div>
            )}

          </div>
        </div>

        <div className="mt-12 space-y-12">
          {data.castMembers.length > 0 && <CastRow cast={data.castMembers} />}

          {seasons.length > 0 && (
            <section aria-labelledby="episodes-heading">
              <h2 id="episodes-heading" className="sr-only">
                Ангиуд
              </h2>
              {/*
                ⚠️ ТАБ НЬ БЛОК ДОТОР — сонгогдсон нь «дэвсгэрээс дээш
                гарсан» мэт харагдана (segmented control). Өмнө нь
                зүгээр 2 өнгөт товч зэрэгцэж, аль нь идэвхтэйг
                харахад тодорхойгүй, тусдаа элемент мэт байв.

                ⚠️ `overflow-x-auto` — 5+ улиралтай цувралд гар утсан
                дээр таслагдахгүй, хажуу тийш гүйлгэнэ.
              */}
              {seasons.length > 1 && (
                <div
                  role="tablist"
                  aria-label="Улирал сонгох"
                  className="mb-4 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-foreground/10 bg-foreground/5 p-1"
                >
                  {seasons.map((s, i) => (
                    <button
                      key={s.id}
                      role="tab"
                      aria-selected={activeSeason === i}
                      onClick={() => setActiveSeason(i)}
                      className={cn(
                        'shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-all',
                        activeSeason === i
                          ? /* ⚠️ Сүүдэр + цайвар дэвсгэр = «дээш гарсан» мэдрэмж */
                            'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                          : 'text-foreground/55 hover:bg-foreground/8 hover:text-foreground/85',
                      )}
                    >
                      {s.name ?? `${s.number}-р улирал`}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {seasons[activeSeason]?.episodes.map((ep) => {
                  const epLocked = locked && !ep.isFreePreview;
                  return (
                    <Link
                      key={ep.id}
                      href={epLocked ? '/pricing' : ep.playable ? `/watch/${data.slug}?ep=${ep.id}` : '#'}
                      aria-disabled={!ep.playable && !epLocked}
                      className={cn(
                        'flex items-center gap-4 rounded-md bg-foreground/5 p-3 hover:bg-foreground/10',
                        !ep.playable && !epLocked && 'pointer-events-none opacity-50',
                      )}
                    >
                      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded bg-foreground/10">
                        {ep.posterUrl && (
                          <Image
                            src={ep.posterUrl}
                            alt={`${ep.number}-р анги`}
                            fill
                            sizes="112px"
                            /* ⚠️ `brightness-75` — өмнө нь `50` байсан дээр
                               `bg-black/40` давхарлагдаж НИЙЛБЭР нь хэт
                               бараан болж зураг мэдэгдэхгүй байв (админ
                               анзаарсан). Түгжээ мэдэгдэх ч зураг
                               ТАНИГДАХ ёстой — аль анги болохыг постероор
                               нь сонгодог. */
                            className={cn('object-cover', epLocked && 'brightness-75')}
                          />
                        )}
                        {/*
                          ⚠️⚠️ ТҮГЖЭЭНИЙ ТЭМДЭГ — эрхгүй хэрэглэгч аль анги
                          нээлттэй, аль нь хаалттайг НЭГ ХАРЦААР мэдэх ёстой.
                          Өмнө нь зөвхөн «Үнэгүй үзэх» гэсэн жижиг текст
                          байсан тул түгжээтэй ангиуд ялгарахгүй, хэрэглэгч
                          дарж үзээд л /pricing руу шидэгдэнэ.
                        */}
                        {epLocked && (
                          /* ⚠️ Дэвсгэрийг `/40` → `/25` болгож ГЭРЭЛТҮҮЛЭВ.
                             Түгжээний дүрс өөрөө уншигдахын тулд ард нь
                             ЖИЖИГ бүдгэрсэн дугуй тавьсан — бүтэн зургийг
                             харанхуйлах шаардлагагүй. */
                          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                            <span className="grid size-7 place-items-center rounded-full bg-black/55 backdrop-blur-[2px]">
                              <Lock size={15} className="text-white" />
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {/*
                          ⚠️ «ҮНЭГҮЙ» шошго ГАРЧГИЙН ХАЖУУД — өмнө нь мөрийн
                          баруун захад байсан тул өргөн дэлгэц дээр гарчгаас
                          хэт хол унаж, хэрэглэгч анзаардаггүй байв.
                          Зөвхөн эрхгүй хэрэглэгчид утгатай (эрхтэй бол бүгд нээлттэй).
                        */}
                        <p className="flex items-center gap-2 font-medium text-foreground">
                          <span className="truncate">{episodeLabel(ep.number, ep.name)}</span>
                          {ep.isFreePreview && locked && (
                            <span className="shrink-0 rounded bg-success/15 px-1.5 py-0.5 text-[11px] font-bold text-success">
                              ҮНЭГҮЙ
                            </span>
                          )}
                        </p>
                        {ep.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-foreground/50">{ep.description}</p>
                        )}
                      </div>
                      {!ep.playable && <span className="shrink-0 text-xs text-foreground/40">Удахгүй</span>}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {data.galleryUrls.length > 0 && <GalleryRow images={data.galleryUrls} />}

          {/*
            ⚠️ СЭТГЭГДЭЛ ТҮР ХААЛТТАЙ — хэрэглэгчид ОГТ харагдахгүй.
            Дахин нээхдээ ЭНЭ ТОГТМОЛЫГ `true` болгоно (файлын дээд талд).
            Дата устаагүй — админ талд хэвээр, зөвхөн нийтэд харуулахгүй.
          */}
          {REVIEWS_ENABLED && (
            <ReviewsSection titleId={data.id} reviewStats={data.reviewStats} />
          )}

          {data.related?.length > 0 && <TitleRow title="Ижил төстэй контент" items={data.related} />}
        </div>
      </div>

      {trailerOpen && (
        <TrailerModal
          titleId={data.id}
          /* ⚠️ Манай HLS байхгүй үед л backend утга илгээнэ (эс бөгөөс null) */
          youtubeKey={data.trailerYoutubeKey}
          onClose={() => setTrailerOpen(false)}
        />
      )}

      {data.rental?.available && (
        <RentDialog
          open={rentOpen}
          onClose={() => setRentOpen(false)}
          titleId={data.id}
          titleName={data.title}
          price={data.rental.price}
          hours={data.rental.hours}
          onRented={() => {
            void refetch();
            qc.invalidateQueries({ queryKey: ['wallet'] });
            qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
          }}
        />
      )}
    </main>
  );
}

/**
 * Мобайлын жижиг дугуй товч (гарчигийн хажууд).
 * ⚠️ h-9 — дэлгэцийн зай хэмнэнэ, гэхдээ хүрэлцэх талбай (36px) хангалттай.
 */
function IconAction({
  children,
  onClick,
  disabled,
  pressed,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-all active:scale-95 disabled:opacity-50',
        pressed ? 'bg-primary hover:brightness-110' : 'bg-foreground/10 hover:bg-foreground/20',
      )}
    >
      {children}
    </button>
  );
}
