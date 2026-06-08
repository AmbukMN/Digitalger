'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Lock,
  Menu,
  PartyPopper,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, Skeleton } from '@digitalger/shared/ui';
import { cn } from '@digitalger/shared';
import { coursesApi, downloadsApi } from '@/lib/api';
import type { LessonProgress, LessonVideoResult } from '@/lib/api';
import type { CourseLesson, ProductDetail } from '@/types/api';
import { PremiumVideoPlayer } from '@/components/course/premium-video-player';
import {
  CourseSidebar,
  type CourseSidebarModule,
  computeLessonState,
  computeCourseProgress,
} from '@/components/course/course-sidebar';
import { LessonContent } from '@/components/course/lesson-content';

// Хичээлийн үргэлжлэх хугацааг "12:30" / "1:02:05" болгох
function formatLessonDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const AUTOPLAY_KEY = 'digitalger:course-autoplay-next';

interface LearnClientProps {
  product: ProductDetail;
}

export function LearnClient({ product }: LearnClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const sessionLoading = status === 'loading';

  const modules: CourseSidebarModule[] = useMemo(() => product.course?.modules ?? [], [product.course]);
  const flatLessons = useMemo(() => product.course?.lessons ?? [], [product.course]);

  // Бичигдсэн дарааллаар бүх хичээл (модулиуд → бүлэггүй) — next/prev, continue-д ашиглана
  const orderedLessons = useMemo(
    () => [...modules.flatMap((m) => m.lessons), ...flatLessons],
    [modules, flatLessons],
  );

  // ── Худалдан авсан эсэх ──
  const { data: library = [], isLoading: libraryLoading } = useQuery({
    queryKey: ['downloads', 'history'],
    queryFn: () => downloadsApi.history(token!),
    enabled: !!token,
    staleTime: 60_000,
  });
  // ⚠️ Хугацаа дууссан (isExpired) худалдан авалтыг "эзэмшээгүй" гэж үзнэ —
  // expired бол бүх хичээл дахин түгжигдэж, "Худалдан авах" статус руу шилжинэ.
  const purchased = library.some(
    (item) => item.product.id === product.id && item.isExpired !== true,
  );

  // ── Progress ──
  const { data: progressList = [], refetch: refetchProgress } = useQuery({
    queryKey: ['course-progress', product.slug],
    queryFn: () => coursesApi.getProgress(token!, product.slug),
    enabled: !!token && purchased,
    staleTime: 30_000,
  });

  // Optimistic progress overlay (saveProgress дуудахад шууд UI шинэчлэх)
  const [optimistic, setOptimistic] = useState<Record<string, LessonProgress>>({});
  const progressMap: Record<string, LessonProgress> = useMemo(() => {
    const map: Record<string, LessonProgress> = {};
    for (const p of progressList) map[p.lessonId] = p;
    for (const [id, p] of Object.entries(optimistic)) map[id] = { ...map[id], ...p };
    return map;
  }, [progressList, optimistic]);

  // ── Идэвхтэй хичээл ──
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);

  // URL ?lesson / continue watching / эхний хичээлээс эхлэх анхны сонголт
  useEffect(() => {
    if (currentLessonId || orderedLessons.length === 0) return;
    const requested = searchParams.get('lesson');
    if (requested && orderedLessons.some((l) => l.id === requested)) {
      setCurrentLessonId(requested);
      return;
    }
    // Continue watching — сүүлд үзэж байсан (completed биш, watched>0) хичээл
    let resume: CourseLesson | null = null;
    for (const l of orderedLessons) {
      const p = progressMap[l.id];
      if (p && !p.completed && p.watchedSeconds > 0) resume = l;
    }
    setCurrentLessonId((resume ?? orderedLessons[0]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedLessons, progressMap, searchParams]);

  const currentLesson = useMemo(
    () => orderedLessons.find((l) => l.id === currentLessonId) ?? null,
    [orderedLessons, currentLessonId],
  );
  const currentIndex = useMemo(
    () => orderedLessons.findIndex((l) => l.id === currentLessonId),
    [orderedLessons, currentLessonId],
  );
  const nextLesson = currentIndex >= 0 ? orderedLessons[currentIndex + 1] ?? null : null;
  const prevLesson = currentIndex > 0 ? orderedLessons[currentIndex - 1] ?? null : null;

  // Хувийн тэмдэглэлийн localStorage key prefix (хэрэглэгчээр тусгаарлана)
  const userKey = session?.user?.id ?? 'guest';

  // ── Курсын ерөнхий явц — БОДИТ үзсэн хувь (хугацаагаар) + дууссан хичээл ──
  const { completedCount, totalLessons, watchedPct } = useMemo(() => {
    const p = computeCourseProgress(orderedLessons, progressMap);
    return { completedCount: p.completedCount, totalLessons: p.total, watchedPct: p.watchedPct };
  }, [orderedLessons, progressMap]);

  // ── Autoplay next toggle (localStorage) ──
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  useEffect(() => {
    setAutoPlayNext(localStorage.getItem(AUTOPLAY_KEY) === '1');
  }, []);
  const toggleAutoPlay = useCallback(() => {
    setAutoPlayNext((prev) => {
      const next = !prev;
      localStorage.setItem(AUTOPLAY_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  // ── Mobile sidebar drawer ──
  const [mobileOpen, setMobileOpen] = useState(false);

  // ── Сонгосон хичээлийн видео эх сурвалж ──
  const [video, setVideo] = useState<LessonVideoResult | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const currentLocked = currentLesson
    ? computeLessonState(currentLesson, purchased, progressMap[currentLesson.id]).locked
    : false;

  useEffect(() => {
    if (!currentLesson) return;
    let cancelled = false;
    setVideo(null);
    setVideoError(false);

    const lessonState = computeLessonState(currentLesson, purchased, progressMap[currentLesson.id]);
    if (lessonState.locked) return; // түгжээтэй — видео ачаалахгүй

    // Үнэгүй preview & худалдаагүй — getLessonVideoUrl дуудалгүй шууд external url
    if (currentLesson.isFreePreview && currentLesson.videoUrl && !purchased) {
      setVideo({ lessonId: currentLesson.id, type: 'external', url: currentLesson.videoUrl });
      return;
    }
    if (!token) return;

    setVideoLoading(true);
    coursesApi
      .getLessonVideoUrl(token, product.slug, currentLesson.id)
      .then((res) => {
        if (!cancelled) setVideo(res);
      })
      .catch(() => {
        if (!cancelled) setVideoError(true);
      })
      .finally(() => {
        if (!cancelled) setVideoLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLessonId, purchased, token]);

  // ── Progress хадгалах (throttle 10сек) ──
  const lastSavedRef = useRef(0);
  const saveProgress = useCallback(
    (lessonId: string, body: { watchedSeconds: number; durationSec?: number; completed?: boolean }) => {
      // Optimistic UI шинэчлэл
      setOptimistic((prev) => ({
        ...prev,
        [lessonId]: {
          lessonId,
          watchedSeconds: body.watchedSeconds,
          durationSec: body.durationSec ?? prev[lessonId]?.durationSec ?? null,
          completed: body.completed ?? prev[lessonId]?.completed ?? false,
        },
      }));
      if (!token || !purchased) return;
      coursesApi
        .saveProgress(token, product.slug, lessonId, body)
        .then(() => refetchProgress())
        .catch(() => {
          /* чимээгүй өнгөрөөнө */
        });
    },
    [token, purchased, product.slug, refetchProgress],
  );

  const handleProgress = useCallback(
    (cur: number, dur: number) => {
      if (!currentLesson) return;
      const now = Date.now();
      if (now - lastSavedRef.current < 10_000) return; // 10сек throttle
      lastSavedRef.current = now;
      saveProgress(currentLesson.id, {
        watchedSeconds: Math.floor(cur),
        durationSec: Number.isFinite(dur) && dur > 0 ? Math.floor(dur) : undefined,
      });
    },
    [currentLesson, saveProgress],
  );

  const goToLesson = useCallback(
    (lesson: CourseLesson) => {
      setCurrentLessonId(lesson.id);
      setMobileOpen(false);
      lastSavedRef.current = 0;
      // URL ?lesson= шинэчлэх (хуудас reload хийхгүй)
      const params = new URLSearchParams(searchParams.toString());
      params.set('lesson', lesson.id);
      router.replace(`/learn/${product.slug}?${params.toString()}`, { scroll: false });
    },
    [router, product.slug, searchParams],
  );

  const handleEnded = useCallback(() => {
    if (!currentLesson) return;
    // 90%+ → backend completed гэж тэмдэглэнэ
    saveProgress(currentLesson.id, {
      watchedSeconds: currentLesson.durationSec ?? 0,
      durationSec: currentLesson.durationSec ?? undefined,
      completed: true,
    });
    if (autoPlayNext && nextLesson) {
      goToLesson(nextLesson);
    }
  }, [currentLesson, nextLesson, autoPlayNext, saveProgress, goToLesson]);

  const handleNext = useCallback(() => {
    if (nextLesson) goToLesson(nextLesson);
  }, [nextLesson, goToLesson]);

  const handlePrev = useCallback(() => {
    if (prevLesson) goToLesson(prevLesson);
  }, [prevLesson, goToLesson]);

  // resumeFrom — тухайн хичээлийн өмнө үзсэн секунд
  const resumeFrom = useMemo(() => {
    if (!currentLesson) return 0;
    const p = progressMap[currentLesson.id];
    if (!p || p.completed) return 0;
    return p.watchedSeconds ?? 0;
    // optimistic-аас seek давтахгүйн тулд зөвхөн lessonId-ээр шинэчлэнэ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLessonId, progressList]);

  // Курс бүхэлдээ дууссан эсэх (overallPct === 100)
  const allDone = useMemo(
    () => orderedLessons.length > 0 && orderedLessons.every((l) => progressMap[l.id]?.completed),
    [orderedLessons, progressMap],
  );

  // ── Сертификат (курс 100% дуусахад) ──
  const [issuingCert, setIssuingCert] = useState(false);

  // Аль хэдийн гаргасан сертификат байгаа эсэхийг (курс дууссан үед) шалгах
  const { data: certificate } = useQuery({
    queryKey: ['course-certificate', product.slug],
    queryFn: () => coursesApi.certificate.get(token!, product.slug),
    enabled: !!token && purchased && allDone,
    staleTime: 60_000,
  });

  const handleCertificate = useCallback(async () => {
    if (!token || issuingCert) return;
    // Аль хэдийн байгаа бол шууд нээх
    if (certificate?.certNo) {
      window.open(coursesApi.certificate.viewUrl(certificate.certNo), '_blank', 'noopener,noreferrer');
      return;
    }
    setIssuingCert(true);
    try {
      const cert = await coursesApi.certificate.issue(token, product.slug);
      window.open(coursesApi.certificate.viewUrl(cert.certNo), '_blank', 'noopener,noreferrer');
      toast.success('Сертификат бэлэн боллоо!');
    } catch {
      toast.error('Сертификат гаргаж чадсангүй. Дахин оролдоно уу.');
    } finally {
      setIssuingCert(false);
    }
  }, [token, issuingCert, certificate, product.slug]);

  // ─── Эрхийн шалгалт ──────────────────────────────────────────────────────────
  const accessLoading = sessionLoading || (!!token && libraryLoading);
  const canViewAny = purchased || orderedLessons.some((l) => l.isFreePreview);

  // Худалдаагүй + preview-гүй → product page руу буцаах мессеж
  if (!accessLoading && !canViewAny) {
    return <NoAccess product={product} />;
  }

  // ─── Player талбар ───────────────────────────────────────────────────────────
  function renderPlayer() {
    if (accessLoading || (videoLoading && !video)) {
      return <Skeleton className="absolute inset-0 h-full w-full rounded-none bg-white/5" />;
    }
    if (!currentLesson) {
      return <PlayerMessage text="Хичээл сонгоно уу" />;
    }
    if (currentLocked) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <Lock className="h-7 w-7 text-white/70" />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">Энэ хичээл түгжээтэй байна</p>
            <p className="mt-1 text-sm text-white/60">Сургалтыг худалдан авч бүх хичээлийг үзээрэй.</p>
          </div>
          <Button asChild className="bg-[#ffbe00] text-[#022179] hover:bg-[#ffbe00]/90">
            <Link href={`/products/${product.slug}`}>Худалдан авах</Link>
          </Button>
        </div>
      );
    }
    if (videoError) {
      return <PlayerMessage text="Видео ачаалахад алдаа гарлаа. Дахин оролдоно уу." />;
    }
    if (!video) {
      return <PlayerMessage text="Энэ хичээлд видео байхгүй байна." />;
    }
    return (
      <PremiumVideoPlayer
        key={currentLesson.id}
        source={{ type: video.type, url: video.url, hlsUrl: video.hlsUrl, iframeUrl: video.iframeUrl }}
        poster={product.thumbnailUrl ?? undefined}
        resumeFrom={resumeFrom}
        title={currentLesson.title}
        onProgress={handleProgress}
        onEnded={handleEnded}
        onNext={nextLesson ? handleNext : undefined}
        autoPlayNext={autoPlayNext}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground lg:h-dvh lg:overflow-hidden">
      {/* ─── Дээд бар (бүх өргөн) ─── */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <Link
          href={`/products/${product.slug}`}
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Бүтээгдэхүүн рүү буцах</span>
          <span className="sm:hidden">Буцах</span>
        </Link>
        <p className="hidden min-w-0 flex-1 truncate text-center text-sm font-semibold text-foreground md:block">
          {product.title}
        </p>
        {/* Mobile: sidebar нээх */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted lg:hidden"
        >
          <Menu className="h-4 w-4" />
          Хичээлүүд
        </button>
      </header>

      {/* ─── YouTube watch layout: зүүн (player + tabs) | баруун (sidebar) ─── */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
        {/* Гол хэсэг (player + доорх мэдээлэл) — өргөний ~65% */}
        <div className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto">
          {/* Player — YouTube шиг дэлгэц дүүргэхгүй: дунд зэрэг хэмжээ (өндрийг viewport-ийн
              ~60%-аар хязгаарлаж, 16:9-ийн дагуу өргөнийг тааруулна → max-w-[106.66vh]).
              Видео контент black хэвээр. */}
          <div className="bg-background px-0 lg:px-4 lg:pt-4">
            <div className="relative mx-auto aspect-video w-full max-h-[60vh] max-w-full shrink-0 overflow-hidden bg-black lg:max-w-[calc(60vh*16/9)] lg:rounded-xl">
              {renderPlayer()}
            </div>
          </div>

          {/* Player доорх удирдлага */}
          <div className="border-b border-border bg-card px-4 py-4 lg:mx-4 lg:mt-4 lg:rounded-xl lg:border">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-foreground sm:text-lg">
                {currentLesson?.title ?? product.title}
              </h1>
              {/* Хичээлийн дугаар + хугацаа + явц */}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {currentIndex >= 0 && totalLessons > 0 && (
                  <span className="tabular-nums">
                    Хичээл {currentIndex + 1} / {totalLessons}
                  </span>
                )}
                {currentLesson?.durationSec ? (
                  <span className="flex items-center gap-1 tabular-nums">
                    <Clock className="h-3 w-3" />
                    {formatLessonDuration(currentLesson.durationSec)}
                  </span>
                ) : null}
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-[#ffbe00]" />
                  Үзсэн {watchedPct}% · {completedCount}/{totalLessons} дууссан
                </span>
              </div>
            </div>

            {/* Autoplay toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={autoPlayNext}
              onClick={toggleAutoPlay}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <span>Дараагийнхыг автоматаар</span>
              <span
                className={cn(
                  'relative h-5 w-9 rounded-full transition-colors',
                  autoPlayNext ? 'bg-[#ffbe00]' : 'bg-muted-foreground/30',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
                    autoPlayNext ? 'left-[1.125rem]' : 'left-0.5',
                  )}
                />
              </span>
            </button>
          </div>

          {/* Курс дууссан баяр + Сертификат */}
          {allDone && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <PartyPopper className="h-5 w-5 shrink-0 text-emerald-500" />
                <p className="text-sm font-semibold text-foreground">
                  Баяр хүргэе, та сургалтыг бүрэн үзэж дууслаа! 🎉
                </p>
              </div>
              {purchased && (
                <button
                  type="button"
                  onClick={handleCertificate}
                  disabled={issuingCert}
                  className="flex shrink-0 items-center gap-2 rounded-lg bg-[#ffbe00] px-4 py-2 text-sm font-semibold text-[#022179] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {issuingCert ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
                  🎓 {certificate ? 'Сертификат харах' : 'Сертификат авах'}
                </button>
              )}
            </motion.div>
          )}

          {/* ← Өмнөх | Дараагийн → навигаци */}
          {(prevLesson || nextLesson) && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {/* Өмнөх */}
              {prevLesson ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted"
                >
                  <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-medium text-muted-foreground">Өмнөх хичээл</span>
                    <span className="block truncate text-sm font-semibold text-foreground">{prevLesson.title}</span>
                  </span>
                </button>
              ) : (
                <span />
              )}

              {/* Дараагийн */}
              {nextLesson ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="group flex items-center justify-end gap-3 rounded-xl border border-[#ffbe00]/30 bg-[#ffbe00]/10 px-4 py-3 text-right transition-colors hover:bg-[#ffbe00]/15"
                >
                  <span className="min-w-0">
                    <span className="block text-[11px] font-medium text-[#ffbe00]/80">Дараагийн хичээл</span>
                    <span className="block truncate text-sm font-semibold text-foreground">{nextLesson.title}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[#ffbe00] transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : (
                <span />
              )}
            </div>
          )}

          {/* Preview-only анхааруулга (худалдаагүй хэрэглэгч) */}
          {!purchased && !accessLoading && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ffbe00]/30 bg-[#ffbe00]/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#ffbe00]" />
                <p className="text-sm text-foreground/80">
                  Та зөвхөн үнэгүй preview хичээлүүдийг үзэж байна.
                </p>
              </div>
              <Button asChild size="sm" className="bg-[#ffbe00] text-[#022179] hover:bg-[#ffbe00]/90">
                <Link href={`/products/${product.slug}`}>Бүх хичээлийг нээх</Link>
              </Button>
            </div>
          )}
        </div>

        {/* ─── Хичээлийн агуулга (тэмдэглэл / материал / Q&A / шалгалт / миний тэмдэглэл) ───
            YouTube шиг: түгжээтэй хичээлд ч БҮТЭЦ харагдана (tab-ууд), контентийн оронд
            upsell. Preview/худалдсан үед бүрэн харагдана. */}
        {currentLesson && (
          <AnimatePresence mode="wait">
            <LessonContent
              key={currentLesson.id}
              lesson={currentLesson}
              content={video?.content}
              resources={video?.resources}
              productSlug={product.slug}
              token={token}
              userKey={userKey}
              locked={currentLocked}
            />
          </AnimatePresence>
        )}

          {/* Mobile sticky "Дараагийн хичээл" товч (доод) */}
          {nextLesson && (
            <div className="sticky bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
              <button
                type="button"
                onClick={handleNext}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffbe00] px-4 py-3 text-sm font-semibold text-[#022179] transition-transform active:scale-[0.98]"
              >
                Дараагийн хичээл
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {/* ─── Desktop sidebar (баруун багана — sticky, scroll) ─── */}
        <aside className="hidden w-[340px] shrink-0 border-l border-border bg-card lg:block lg:overflow-y-auto xl:w-[380px]">
          <CourseSidebar
            modules={modules}
            lessons={flatLessons}
            purchased={purchased}
            currentLessonId={currentLessonId}
            progressMap={progressMap}
            onSelect={goToLesson}
          />
        </aside>
      </div>

      {/* ─── Mobile sidebar drawer ─── */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col bg-card shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Хичээлийн хөтөлбөр</p>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/70"
                >
                  <X className="h-4 w-4 text-foreground" />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <CourseSidebar
                  modules={modules}
                  lessons={flatLessons}
                  purchased={purchased}
                  currentLessonId={currentLessonId}
                  progressMap={progressMap}
                  onSelect={goToLesson}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Туслах UI ──────────────────────────────────────────────────────────────
function PlayerMessage({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
      <p className="text-sm text-white/60">{text}</p>
    </div>
  );
}

function NoAccess({ product }: { product: ProductDetail }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Lock className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-foreground">Энэ хичээлийг үзэх эрх танд алга</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Энэ хичээлийг үзэхийн тулд эхлээд худалдан авна уу. Худалдаж авсны дараа бүх хичээл нээгдэнэ.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="bg-[#ffbe00] text-[#022179] hover:bg-[#ffbe00]/90">
          <Link href={`/products/${product.slug}`}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Худалдан авах
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/products">Бусад бүтээгдэхүүн</Link>
        </Button>
      </div>
    </div>
  );
}
