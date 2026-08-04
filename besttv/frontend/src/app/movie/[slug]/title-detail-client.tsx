'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Heart, Film, Lock, Play, Star, Ticket, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatPrice } from '@besttv/shared';
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

export function TitleDetailClient({ slug }: { slug: string }) {
  const { data, isLoading, isError, refetch } = useTitleDetail(slug);
  const qc = useQueryClient();
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

  // ⚠️ Эрх нь багц ↔ жанраар тодорхойлогдоно (backend hasAccess буцаана).
  // Хуучин "premium эсэх" ганц шалгуур ХАНГАЛТГҮЙ.
  const locked = data.isPremium && !data.hasAccess;
  const cheapestPlan = data.requiredPlans?.length
    ? [...data.requiredPlans].sort((a, b) => a.price - b.price)[0]
    : null;
  const seasons = data.seasons ?? [];
  const firstPlayableEpisode = seasons.flatMap((s) => s.episodes).find((e) => e.playable);

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

  const watchHref = locked
    ? '/pricing'
    : data.type === 'MOVIE'
      ? `/watch/${data.slug}`
      : firstPlayableEpisode
        ? `/watch/${data.slug}?ep=${firstPlayableEpisode.id}`
        : undefined;

  return (
    <main className="min-h-screen bg-background pb-16">
      <section className="relative h-[46vw] max-h-[520px] min-h-[300px] w-full">
        {data.backdropUrl ? (
          <Image
            src={data.backdropUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#141414] text-white/10">
            <Film size={64} />
          </div>
        )}
        <div className="hero-gradient absolute inset-0" />

      </section>

      <div className="relative -mt-24 px-4 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="relative aspect-2/3 w-40 shrink-0 overflow-hidden rounded-lg bg-white/5 shadow-2xl md:w-56">
            {data.posterUrl ? (
              <Image src={data.posterUrl} alt={data.title} fill sizes="220px" className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-white/20">
                <Film size={40} />
              </div>
            )}
          </div>

          <div className="flex-1 pt-2">
            <h1 className="text-2xl font-black text-white md:text-4xl">{data.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/70">
              {data.year && <span>{data.year}</span>}
              {data.ageRating && (
                <span className="rounded border border-white/30 px-1.5 py-0.5 text-xs font-semibold">
                  {data.ageRating}
                </span>
              )}
              {(data.reviewStats.average ?? data.rating) != null && (
                <span className="flex items-center gap-1">
                  <Star size={14} className="fill-premium text-premium" />
                  {(data.reviewStats.count > 0 ? data.reviewStats.average! : data.rating!).toFixed(1)}
                  {data.reviewStats.count > 0 && (
                    <span className="text-white/40">({data.reviewStats.count})</span>
                  )}
                </span>
              )}
              {data.director && <span>Найруулагч: {data.director}</span>}
              {data.genres?.map((g) => (
                <span key={g.id} className="rounded bg-white/10 px-2 py-0.5">
                  {g.name}
                </span>
              ))}
            </div>

            <p className="mt-4 max-w-2xl text-sm text-white/80 md:text-base">{data.description}</p>

            {/*
              ⚠️ ЯГ 2 үндсэн товч — "Түрээслэх" ба "Багц авах". Дуртай/Хуваалцах
              нь ЗӨВХӨН icon (текстгүй) — эс бөгөөс товч олширч хэрэглэгчийн
              нүд эргэдэг. Мобайлд үндсэн товч бүтэн өргөн, icon-ууд доор.
            */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex flex-col gap-2.5 sm:flex-row">
                {locked ? (
                  <>
                    {/* Ширхэгээр түрээслэх — багц авахгүйгээр яг энэ киног үзнэ */}
                    {data.rental?.available && (
                      <button
                        onClick={() => setRentOpen(true)}
                        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] sm:py-2.5"
                      >
                        <Ticket size={17} />
                        {formatPrice(data.rental.price)} · {data.rental.hours}ц түрээслэх
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
                      className="flex items-center justify-center gap-2 rounded-lg bg-premium px-6 py-3 font-semibold text-premium-foreground transition-all hover:brightness-105 active:scale-[0.98] sm:py-2.5"
                    >
                      <Lock size={17} />
                      Багц авах
                    </Link>
                  </>
                ) : watchHref ? (
                  <Link
                    href={watchHref}
                    className="flex items-center justify-center gap-2 rounded-lg bg-white px-8 py-3 font-semibold text-black transition-all hover:bg-white/85 active:scale-[0.98] sm:py-2.5"
                  >
                    <Play size={18} fill="black" /> Үзэх
                  </Link>
                ) : (
                  <span className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-6 py-3 font-semibold text-white/40 sm:py-2.5">
                    Удахгүй гарна
                  </span>
                )}
              </div>

              {/* Трейлер / Дуртай / Хуваалцах — ЗӨВХӨН icon */}
              <div className="flex items-center gap-2.5">
                {/* ⚠️ Трейлер нь баннерын буланд НУУГДМАЛ байсан — үйлдлийн
                    мөрөнд гаргаж ил болгов */}
                {data.trailerAvailable && (
                  <button
                    onClick={() => setTrailerOpen(true)}
                    title="Трейлер үзэх"
                    aria-label="Трейлер үзэх"
                    className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-medium text-white transition-all hover:bg-white/20 active:scale-95"
                  >
                    <Film size={16} /> Трейлер
                  </button>
                )}

                <button
                  onClick={toggleMyList}
                  disabled={myListPending}
                  aria-pressed={inList}
                  title={inList ? 'Дуртайгаас хасах' : 'Дуртай кинонд нэмэх'}
                  aria-label={inList ? 'Дуртайгаас хасах' : 'Дуртай кинонд нэмэх'}
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-full text-white transition-all active:scale-95 disabled:opacity-50',
                    inList ? 'bg-primary hover:brightness-110' : 'bg-white/10 hover:bg-white/20',
                  )}
                >
                  <Heart size={19} className={inList ? 'fill-current' : ''} />
                </button>

                <ShareButton title={data.title} slug={data.slug} />
              </div>
            </div>

            {/* Идэвхтэй түрээс — хэдэн цаг үлдснийг харуулна */}
            {data.rental?.active && (
              <div className="mt-4 flex max-w-2xl items-center gap-2 rounded-xl border border-success/25 bg-success/10 px-4 py-2.5 text-sm text-success">
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
              {seasons.length > 1 && (
                <div className="mb-4 flex gap-2" role="tablist" aria-label="Улирал сонгох">
                  {seasons.map((s, i) => (
                    <button
                      key={s.id}
                      role="tab"
                      aria-selected={activeSeason === i}
                      onClick={() => setActiveSeason(i)}
                      className={cn(
                        'rounded-md px-4 py-2 text-sm font-medium',
                        activeSeason === i ? 'bg-primary text-white' : 'bg-white/10 text-white/70',
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
                        'flex items-center gap-4 rounded-md bg-white/5 p-3 hover:bg-white/10',
                        !ep.playable && !epLocked && 'pointer-events-none opacity-50',
                      )}
                    >
                      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded bg-white/10">
                        {ep.posterUrl && (
                          <Image src={ep.posterUrl} alt="" fill sizes="112px" className="object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">
                          {ep.number}. {ep.name ?? `Анги ${ep.number}`}
                        </p>
                        {ep.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-white/50">{ep.description}</p>
                        )}
                        {ep.isFreePreview && <span className="text-xs text-success">Үнэгүй үзэх</span>}
                      </div>
                      {!ep.playable && <span className="shrink-0 text-xs text-white/40">Удахгүй</span>}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {data.galleryUrls.length > 0 && <GalleryRow images={data.galleryUrls} />}

          <ReviewsSection titleId={data.id} reviewStats={data.reviewStats} />

          {data.related?.length > 0 && <TitleRow title="Ижил төстэй контент" items={data.related} />}
        </div>
      </div>

      {trailerOpen && <TrailerModal titleId={data.id} onClose={() => setTrailerOpen(false)} />}

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

/** Түрээс дуусах хүртэлх хугацаа — "12 цаг 30 мин" хэлбэрээр */
function formatRentLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return '0 мин';
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `${h} цаг ${m} мин` : `${m} мин`;
}
