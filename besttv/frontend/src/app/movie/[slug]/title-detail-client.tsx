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

/**
 * ⚠️ СЭТГЭГДЭЛ ТҮР ХААЛТТАЙ.
 * Дахин нээхдээ ЗӨВХӨН энэ утгыг `true` болгоно — өөр юу ч засах шаардлагагүй.
 * Дата устаагүй: админ талд сэтгэгдэл хэвээр, зөвхөн нийтэд харуулахгүй.
 */
const REVIEWS_ENABLED = false;

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
                  {data.rental?.available && (
                    <button
                      onClick={() => setRentOpen(true)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground active:scale-[0.98]"
                    >
                      <Ticket size={15} />
                      {formatPrice(data.rental.price)} · {data.rental.hours}ц
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
              {data.genres?.map((g) => (
                <span key={g.id} className="rounded bg-foreground/10 px-2 py-0.5">
                  {g.name}
                </span>
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
                    {/* Ширхэгээр түрээслэх — багц авахгүйгээр яг энэ киног үзнэ */}
                    {data.rental?.available && (
                      <button
                        onClick={() => setRentOpen(true)}
                        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] sm:py-2.5"
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
                    <Play size={18} fill="black" /> Үзэх
                  </Link>
                ) : (
                  <span className="flex items-center justify-center gap-2 rounded-lg bg-foreground/10 px-6 py-3 font-semibold text-foreground/40 sm:py-2.5">
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
                    className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-foreground/10 px-4 text-sm font-medium text-foreground transition-all hover:bg-foreground/20 active:scale-95"
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
                        activeSeason === i ? 'bg-primary text-primary-foreground' : 'bg-foreground/10 text-foreground/70',
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
                          <Image src={ep.posterUrl} alt={`${ep.number}-р анги`} fill sizes="112px" className="object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {ep.number}. {ep.name ?? `Анги ${ep.number}`}
                        </p>
                        {ep.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-foreground/50">{ep.description}</p>
                        )}
                        {ep.isFreePreview && <span className="text-xs text-success">Үнэгүй үзэх</span>}
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
