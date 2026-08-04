'use client';

import { useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { ErrorState } from '@besttv/shared/ui';
import { useTitleDetail } from '@/lib/queries';
import { useAuth } from '@/lib/auth-store';
import { loginUrl } from '@/lib/auth-intent';
import { api } from '@/lib/api';
import { trackTitle } from '@/lib/track';
import { VideoPlayer } from '@/components/video-player';

export function WatchClient({ slug }: { slug: string }) {
  const search = useSearchParams();
  const episodeId = search.get('ep');
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useTitleDetail(slug);
  const { user, loading: authLoading } = useAuth();
  const lastSaved = useRef(0);

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

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="animate-spin text-white/50" size={40} aria-label="Ачааллаж байна" />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-4">
        <ErrorState
          title="Видео ачаалж чадсангүй"
          message="Дахин оролдоно уу, эсвэл контент байхгүй болсон байж болзошгүй."
          onRetry={() => refetch()}
        />
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
  const locked = data.isPremium && !data.hasAccess;
  if (locked) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-black px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-premium/15 text-premium">
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
      </main>
    );
  }

  const src = episodeId
    ? `/api/stream/episode/${episodeId}/playlist.m3u8`
    : `/api/stream/movie/${data.id}/playlist.m3u8`;

  const startAt =
    !episodeId && data.progress?.episodeId === null ? data.progress?.positionSec : undefined;

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
          <div className="px-4 py-4 md:px-8">
            <Link href={`/movie/${slug}`} className="text-sm text-white/60 hover:text-white">
              ← {data.title} рүү буцах
            </Link>
            <h1 className="mt-2 text-lg font-semibold text-white">
              {data.title}
              {episodeId && flatEpisodes[currentIndex] && (
                <span className="text-white/60">
                  {' '}
                  — {flatEpisodes[currentIndex].number}-р анги
                </span>
              )}
            </h1>
            {nextEpisode?.playable && (
              <button
                onClick={() => goToEpisode(nextEpisode.id)}
                className="mt-3 rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
              >
                Дараагийн анги: {nextEpisode.number}. {nextEpisode.name ?? `Анги ${nextEpisode.number}`} →
              </button>
            )}
          </div>
        </div>

        {flatEpisodes.length > 0 && (
          <aside className="w-full shrink-0 border-t border-white/10 bg-[#0a0a0a] p-4 lg:w-80 lg:border-l lg:border-t-0">
            <h2 className="mb-3 text-sm font-semibold text-white/80">Ангиуд</h2>
            <div className="space-y-1.5 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
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
                        <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded bg-white/10">
                          {ep.posterUrl && (
                            <Image src={ep.posterUrl} alt="" fill sizes="80px" className="object-cover" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn('truncate text-sm', active ? 'text-primary font-medium' : 'text-white/90')}>
                            {ep.number}. {ep.name ?? `Анги ${ep.number}`}
                          </p>
                          {!ep.playable && <span className="text-xs text-white/40">Удахгүй</span>}
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
