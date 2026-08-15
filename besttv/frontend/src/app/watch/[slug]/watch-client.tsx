'use client';

import { useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronRight, Lock, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { cn, episodeLabel } from '@besttv/shared';
import { ErrorState } from '@besttv/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { useTitleDetail } from '@/lib/queries';
import { useAuth } from '@/lib/auth-store';
import { loginUrl } from '@/lib/auth-intent';
import { api } from '@/lib/api';
import { trackTitle } from '@/lib/track';
import { VideoPlayer } from '@/components/video-player';

/**
 * Бүтэн дэлгэцийн төлөв бүрд БУЦАХ зам.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: `/watch` нь navbar-гүй бүтэн дэлгэц.
 * Түгжээ / алдаа / «видео бэлэн биш» гурван төлөвт хэрэглэгч ГАЦНА —
 * ялангуяа хуваалцсан холбоосоор шууд орсон хүнд гарах зам огт
 * байхгүй (бодит гомдол).
 *
 * ⚠️ `router.back()` нь түүхгүй үед (шинэ таб, гадны холбоос) юу ч
 * хийхгүй тул нүүр рүү унана.
 */
function BackLink() {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push('/');
      }}
      className="mt-1 flex items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-white/80"
    >
      <ArrowLeft size={15} /> Буцах
    </button>
  );
}

export function WatchClient({ slug }: { slug: string }) {
  const search = useSearchParams();
  const episodeId = search.get('ep');
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useTitleDetail(slug);
  const { user, loading: authLoading } = useAuth();
  const lastSaved = useRef(0);

  /**
   * ХАДМАЛЫН ЖАГСААЛТ — ямар хэл байгааг мэдэхэд.
   *
   * ⚠️ Энэ endpoint нь эрх ШААРДАХГҮЙ (зөвхөн жагсаалт). Агуулгыг
   * татахад л шалгагдана — player дотор токентой татна.
   * ⚠️ Анги солиход шинэ хадмал татагдах ёстой тул `episodeId` нь
   * queryKey-д ЗААВАЛ орно.
   */
  const { data: subtitles } = useQuery({
    queryKey: ['subtitles', episodeId ?? data?.id],
    queryFn: () =>
      api<{ lang: string; label: string; src: string; isDefault: boolean }[]>(
        episodeId
          ? `/subtitles/episode/${episodeId}`
          : `/subtitles/movie/${data!.id}`,
      ),
    enabled: Boolean(episodeId || data?.id),
    /* ⚠️ Хадмал ховор өөрчлөгддөг — 5 минут кэшлэнэ */
    staleTime: 5 * 60_000,
  });

  const seasons = useMemo(() => data?.seasons ?? [], [data]);

  // Улирлын хилээр давхар нэг жагсаалтад хийж, дараагийн/өмнөх ангийг олно
  const flatEpisodes = useMemo(
    () => seasons.flatMap((s) => s.episodes.map((e) => ({ ...e, seasonId: s.id }))),
    [seasons],
  );
  const currentIndex = flatEpisodes.findIndex((e) => e.id === episodeId);
  const nextEpisode = currentIndex >= 0 ? flatEpisodes[currentIndex + 1] : undefined;

  // Analytics: "эхэлсэн" нэг л удаа, "явц" 60 сек тутам (progress хадгалалт 5 сек
  // тутам — түүн бүрд event бичвэл хэт олон мөр үүснэ)
  const playTracked = useRef(false);
  const lastTracked = useRef(0);
  // Явц хадгалалтын дараалсан алдааг тоолж, нэг л удаа сануулна
  const progressFails = useRef(0);
  const progressWarned = useRef(false);

  const saveProgress = useCallback(
    (positionSec: number, durationSec: number) => {
      /**
       * ⚠️ 5 секундын алхам — сервер рүү хэт олон бичихээс сэргийлнэ.
       * Гэхдээ SEEK хийхэд байрлал ИХ ҮСЭРДЭГ тул тэр шалгуур саад
       * болохгүй (5-аас их зөрүү = үргэлж хадгална).
       */
      /**
       * ⚠️⚠️ ЗОЧИН БОЛ ОГТ ИЛГЭЭХГҮЙ.
       *
       * `/progress` нь `JwtAuthGuard`-тай тул нэвтрээгүй хүнд 401
       * буцаана. Зочин ҮНЭГҮЙ кино үзэж чаддаг тул энэ нь 5 секунд
       * тутам давтагдаж, 3 удаагийн дараа «Үзсэн явц хадгалагдахгүй
       * байна. Холболтоо шалгана уу» гэсэн ХУДАЛ алдаа гаргадаг байв
       * (холболт хэвийн, зүгээр нэвтрээгүй).
       */
      if (!user) return;
      if (!data || Math.abs(positionSec - lastSaved.current) < 5) return;
      lastSaved.current = positionSec;
      api('/progress', {
        method: 'POST',
        body: JSON.stringify({
          titleId: data.id,
          episodeId: episodeId ?? undefined,
          positionSec: Math.floor(positionSec),
          durationSec: Math.floor(durationSec),
        }),
      })
        .then(() => {
          progressFails.current = 0;
        })
        .catch(() => {
          // ⚠️ Явц хадгалагдахгүй байгааг хэрэглэгч МЭДЭХ ёстой — эс бөгөөс
          // 40 минут үзээд буцаж ирэхэд 0-ээс эхлээд шалтгааныг ойлгохгүй.
          // Дараалсан 3 алдааны дараа НЭГ л удаа сануулна (спам болгохгүй).
          progressFails.current += 1;
          if (progressFails.current === 3 && !progressWarned.current) {
            progressWarned.current = true;
            toast.error('Үзсэн явц хадгалагдахгүй байна. Холболтоо шалгана уу.');
          }
        });

      const base = {
        titleId: data.id,
        titleSlug: slug,
        titleName: data.title,
        episodeId: episodeId ?? undefined,
        positionSec: Math.floor(positionSec),
        durationSec: Math.floor(durationSec),
      };

      if (!playTracked.current) {
        playTracked.current = true;
        lastTracked.current = positionSec;
        trackTitle({ ...base, type: 'play' });
        return;
      }
      if (positionSec - lastTracked.current >= 60) {
        lastTracked.current = positionSec;
        trackTitle({ ...base, type: 'progress' });
      }
    },
    [data, episodeId, slug],
  );

  const goToEpisode = useCallback(
    (epId: string) => {
      lastSaved.current = 0;
      // Шинэ анги = шинэ "play" event
      playTracked.current = false;
      lastTracked.current = 0;
      router.push(`/watch/${slug}?ep=${epId}`);
    },
    [router, slug],
  );

  const handleEnded = useCallback(() => {
    if (data) {
      trackTitle({
        type: 'complete',
        titleId: data.id,
        titleSlug: slug,
        titleName: data.title,
        episodeId: episodeId ?? undefined,
      });
    }
    if (nextEpisode?.playable) goToEpisode(nextEpisode.id);
  }, [data, slug, episodeId, nextEpisode, goToEpisode]);

  /**
   * ⚠️⚠️ SPINNER БИШ SKELETON — төслийн дүрэм.
   *
   * Өмнө нь хар дэлгэц дээр жижиг эргэлдэх дугуй байсан тул дата
   * ирмэгц плеер + ангиудын жагсаалт ГЭНЭТ орж ирж layout БҮРЭН
   * үсэрдэг байв (CLS). Утсан дээр ангиудын хэсэг `w-full` тул
   * үсрэлт нь бүр том.
   *
   * Skeleton нь эцсийн бүтцийг (16:9 плеер + гарчиг + ангиуд)
   * урьдчилж эзэлдэг тул дата ирэхэд юу ч хөдлөхгүй.
   */
  if (isLoading) {
    return (
      <main className="min-h-screen bg-black">
        <div className="mx-auto max-w-400 px-3 py-4 md:px-6">
          <div className="skeleton-shimmer aspect-video w-full rounded-lg bg-white/5" />
          <div className="mt-4 space-y-2">
            <div className="skeleton-shimmer h-6 w-2/3 rounded bg-white/5" />
            <div className="skeleton-shimmer h-4 w-1/3 rounded bg-white/5" />
          </div>
          <div className="mt-6 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton-shimmer h-12 w-20 shrink-0 rounded bg-white/5" />
                <div className="skeleton-shimmer h-4 flex-1 rounded bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-black px-4">
        <ErrorState
          title="Видео ачаалж чадсангүй"
          message="Дахин оролдоно уу, эсвэл контент байхгүй болсон байж болзошгүй."
          onRetry={() => refetch()}
        />
        <BackLink />
      </main>
    );
  }

  /**
   * ⚠️ ЭРХИЙН ХАМГААЛАЛТ — URL-ээр шууд /watch/... руу орох замыг хаана.
   *
   * Өмнө нь ямар ч шалгалтгүй байсан тул нэвтрээгүй хэрэглэгч хоосон плеер
   * дээр гацаж, "видео байхгүй" мэт харагддаг байсан. Backend нь stream
   * endpoint дээр эрх шалгадаг ч, хэрэглэгчид ОЙЛГОМЖТОЙ мессеж, дараагийн
   * алхам (нэвтрэх / түрээслэх / багц авах) харуулах ёстой.
   */
  /**
   * ⚠️⚠️ ҮНЭГҮЙ АНГИ — `isFreePreview` шалгалт ЭНД БАЙГААГҮЙ.
   *
   * Дэлгэрэнгүй хуудсанд («Үнэгүй» шошготой) нээлттэй харагдаж,
   * дарахад ЭНЭ хуудас түгжээ харуулдаг байв — backend нь тэр ангийг
   * зөвшөөрдөг атлаа UI хаадаг. Цувралын эхний ангийг үнэгүй болгож
   * хэрэглэгч татах бүхэл маркетингийн санаа ажиллахгүй байсан.
   *
   * ⚠️ `episodeId` байхгүй (кино) бол хуучин логик хэвээр.
   */
  const currentEpisode = episodeId
    ? flatEpisodes.find((e) => e.id === episodeId)
    : undefined;
  const locked = data.isPremium && !data.hasAccess && !currentEpisode?.isFreePreview;
  if (locked) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-black px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-premium-solid/15 text-premium">
          <Lock size={28} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-white">{data.title}</h1>
          <p className="mt-1.5 max-w-sm text-sm text-white/55">
            {user
              ? 'Энэ контентыг үзэхийн тулд багц авах эсвэл ширхэгээр түрээслэнэ үү.'
              : 'Энэ контентыг үзэхийн тулд нэвтэрч, багц авах эсвэл түрээслэнэ үү.'}
          </p>
        </div>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          {!user && !authLoading && (
            <Link
              href={loginUrl(`/movie/${slug}`)}
              className="rounded-lg bg-primary px-6 py-2.5 font-semibold text-white hover:brightness-110"
            >
              Нэвтрэх
            </Link>
          )}
          <Link
            href={`/movie/${slug}`}
            className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-6 py-2.5 font-semibold text-white hover:bg-white/20"
          >
            <Ticket size={16} /> Түрээслэх / Багц авах
          </Link>
        </div>

        {/*
          ⚠️⚠️ БУЦАХ ЗАМ — өмнө нь ОГТ БАЙГААГҮЙ.

          Хэрэглэгч түгжээтэй ангийн линкээр шууд орвол (жишээ нь
          хуваалцсан холбоос) энэ дэлгэц дээр ГАЦНА — «Түрээслэх /
          Багц авах» нь худалдан авалт руу урьж байгаа мэт харагддаг
          тул зүгээр л гарах гэсэн хүн замгүй үлдэнэ (бодит гомдол).

          ⚠️ `router.back()` нь түүх байхгүй үед (шинэ таб, гадны
          холбоос) юу ч хийхгүй тул `/` рүү унана.
        */}
        <BackLink />
      </main>
    );
  }

  /** Видео бэлэн биш (кино) — хоосон плеер харуулахаас сэргийлнэ */
  if (data.type === 'MOVIE' && data.playable === false) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-4 text-center">
        <h1 className="text-xl font-bold text-white">{data.title}</h1>
        <p className="max-w-sm text-sm text-white/55">
          Видео бэлтгэгдэж байна. Түр хүлээгээд дахин оролдоно уу.
        </p>
        <Link
          href={`/movie/${slug}`}
          className="rounded-lg bg-white/10 px-6 py-2.5 font-semibold text-white hover:bg-white/20"
        >
          Дэлгэрэнгүй
        </Link>
        <BackLink />
      </main>
    );
  }

  const src = episodeId
    ? `/api/stream/episode/${episodeId}/playlist.m3u8`
    : `/api/stream/movie/${data.id}/playlist.m3u8`;

  /**
   * ⚠️⚠️ ҮРГЭЛЖЛҮҮЛЭН ҮЗЭХ — ХАДГАЛСАН БАЙРЛАЛААС эхэлнэ.
   *
   * Өмнө нь `!episodeId` нөхцөлтэй байсан тул ЗӨВХӨН нэг ангит кинонд
   * ажиллаж, ОЛОН АНГИТ киног анги дундаас нь эхлүүлдэггүй байв
   * (хэрэглэгч 30 минут үзчихээд буцаж ирэхэд 0-ээс эхэлнэ).
   *
   * Backend нь тухайн киноны СҮҮЛД үзсэн явцыг `episodeId`-тэй хамт
   * буцаадаг тул ЯГ ТЭР анги дээр байгаа эсэхийг тулгана:
   *   • нэг ангит  → progress.episodeId === null, URL-д ?ep= байхгүй
   *   • олон ангит → progress.episodeId === одоогийн episodeId
   */
  const startAt =
    (data.progress?.episodeId ?? null) === (episodeId ?? null)
      ? data.progress?.positionSec
      : undefined;

  return (
    <main className="min-h-screen bg-black">
      <div className={cn('flex flex-col', flatEpisodes.length > 0 && 'lg:flex-row')}>
        <div className="flex-1">
          <VideoPlayer
            src={src}
            poster={data.backdropUrl ?? undefined}
            onProgress={saveProgress}
            onEnded={handleEnded}
            startAt={startAt}
            subtitles={subtitles}
            /**
             * ⚠️ Гарчиг + буцах товчийг PLAYER ДОТОР харуулна.
             * Доорх холбоос нь дэлгэц дүүрэн (fullscreen) үед харагдахгүй
             * тул хэрэглэгч гарах замгүй болдог байв.
             */
            title={
              episodeId && flatEpisodes[currentIndex]
                ? `${data.title} — ${flatEpisodes[currentIndex].number}-р анги`
                : data.title
            }
            backHref={`/movie/${slug}`}
          />
          {/*
            ⚠️⚠️ МЭДЭЭЛЛИЙН МӨР — ГУРВАН зүйл БОСОО давхарлагдсан байв
            (буцах холбоос → гарчиг → товч), тус бүр өөрийн мөртэй.
            Дэлгэцийн зай дэмий үрэгдэж, «Дараагийн анги» товч доогуур
            унжсан эмх замбараагүй харагддаг байв.

            ЗӨВ БҮТЭЦ: гарчиг ЗҮҮН, үйлдэл БАРУУН — нэг мөрөнд
            (`justify-between`). Нарийн дэлгэцэд `flex-wrap` нь товчийг
            доош буулгана (шахагдахгүй).

            ⚠️ Буцах холбоос ХАСАГДСАН — player дотор аль хэдийн буцах
            товч бий (одоо удирдлагатай хамт зөв харагдана). Хоёр газар
            байх нь давхардал, зай үрэлт.
          */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 md:px-8">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-white md:text-xl">
                {data.title}
              </h1>
              {episodeId && flatEpisodes[currentIndex] && (
                <p className="mt-0.5 text-sm text-white/55">
                  {episodeLabel(
                    flatEpisodes[currentIndex].number,
                    flatEpisodes[currentIndex].name,
                  )}
                  {flatEpisodes.length > 1 && (
                    <span className="text-white/35"> · {flatEpisodes.length} ангитай</span>
                  )}
                </p>
              )}
            </div>

            {nextEpisode?.playable && (
              /* ⚠️ `shrink-0` — урт гарчиг товчийг шахахгүй.
                 ⚠️ `bg-primary` — энэ бол хуудасны ГОЛ үйлдэл, саарал
                 товч нь хэрэглэгчийн нүдэнд өртөхгүй байв. */
              <button
                onClick={() => goToEpisode(nextEpisode.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
              >
                Дараагийн анги
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>

        {flatEpisodes.length > 0 && (
          <aside className="w-full shrink-0 border-t border-white/10 bg-[#0a0a0a] lg:w-88 lg:border-l lg:border-t-0">
            {/* ⚠️ Толгой НААЛДАЦТАЙ — 10+ ангийн жагсаалт гүйлгэхэд
                «Ангиуд» гарчиг болон явц харагдсаар байна */}
            <div className="sticky top-0 z-10 flex items-baseline justify-between gap-2 border-b border-white/10 bg-[#0a0a0a]/95 px-4 py-3 backdrop-blur">
              <h2 className="text-sm font-semibold text-white/85">Ангиуд</h2>
              <span className="text-xs text-white/40">
                {flatEpisodes.filter((e) => e.playable).length}/{flatEpisodes.length}
              </span>
            </div>
            {/* ⚠️ `100dvh` — мобайл browser-ийн хаяг талбар нуугдахад
                `vh` буруу тооцоологддог (жагсаалт таслагдана) */}
            <div className="space-y-1 p-3 lg:max-h-[calc(100dvh-3.25rem)] lg:overflow-y-auto">
              {seasons.map((s) => (
                <div key={s.id}>
                  {seasons.length > 1 && (
                    <p className="mb-1.5 mt-3 text-xs font-medium uppercase text-white/40">
                      {s.name ?? `${s.number}-р улирал`}
                    </p>
                  )}
                  {s.episodes.map((ep) => {
                    const active = ep.id === episodeId;
                    return (
                      <button
                        key={ep.id}
                        onClick={() => ep.playable && goToEpisode(ep.id)}
                        disabled={!ep.playable}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors',
                          active ? 'bg-primary/20' : 'hover:bg-white/5',
                          !ep.playable && 'cursor-not-allowed opacity-40',
                        )}
                      >
                        {/*
                          ⚠️⚠️ THUMBNAIL ХООСОН ҮЕД ДУГААР ХАРУУЛНА.
                          Постерыг 1 дэх секундээс авдаг байсан тул бараг
                          үргэлж ХАР КАДР гардаг — 10 анги бүгд ижилхэн
                          хар хайрцаг болж, хэрэглэгч алийг нь ч ялгахгүй
                          байв. Дугаар нь ядаж баримжаа өгнө.
                          (`makePoster` 10%-д авдаг болсон, хуучин видеог
                          `/admin/stream/posters/backfill` засна.)
                        */}
                        <div className="relative flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-white/8">
                          {ep.posterUrl ? (
                            <Image
                              src={ep.posterUrl}
                              alt=""
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="text-base font-bold text-white/25">{ep.number}</span>
                          )}
                          {/* ⚠️ Идэвхтэй ангид тод хүрээ — жагсаалт урт үед
                              хаана байгаагаа алдахгүй */}
                          {active && (
                            <span className="pointer-events-none absolute inset-0 rounded ring-2 ring-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'truncate text-sm',
                              active ? 'font-semibold text-primary' : 'text-white/90',
                            )}
                          >
                            {episodeLabel(ep.number, ep.name)}
                          </p>
                          {active ? (
                            <span className="text-xs text-primary/70">Одоо үзэж байна</span>
                          ) : !ep.playable ? (
                            <span className="text-xs text-white/40">Удахгүй</span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
