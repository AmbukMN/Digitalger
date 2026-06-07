'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Check, ChevronDown, Clock, FolderOpen, Lock, Loader2, Play, X } from 'lucide-react';
import { coursesApi, downloadsApi } from '@/lib/api';
import type { LessonProgress, LessonVideoResult } from '@/lib/api';
import { sanitizeHtml } from '@/lib/safe-html';
import type { CourseLesson } from '@/types/api';

interface CourseModule {
  id: string;
  title: string;
  sortOrder: number;
  lessons: CourseLesson[];
}

function formatDuration(sec: number | null): string {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTotalDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h} цаг ${m > 0 ? m + ' минут' : ''}`.trim();
  return `${m} минут`;
}

function getEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s?]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`;
  return null;
}

// Progress хадгалах функцийн төрөл (continue watching, completed тэмдэглэх)
type ProgressSaver = (body: { watchedSeconds: number; durationSec?: number; completed?: boolean }) => void;

function VideoModal({
  lesson,
  video,
  resumeFrom,
  onSaveProgress,
  onClose,
}: {
  lesson: CourseLesson;
  video: LessonVideoResult;
  // Continue watching — өмнө үзэж байсан секунд (R2/external <video>-д seek хийнэ)
  resumeFrom: number;
  // Тоглуулж байх үед progress хадгалах (throttle хийгдсэн)
  onSaveProgress?: ProgressSaver;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedRef = useRef(0);

  // External (YouTube/Vimeo) embed эсэх
  const externalEmbed =
    video.type === 'external' && video.url ? getEmbedUrl(video.url) : null;
  // <video> tag ашиглах эх сурвалж (R2 эсвэл шууд external mp4)
  const directUrl =
    video.type === 'r2' || (video.type === 'external' && !externalEmbed)
      ? video.url ?? null
      : null;
  // Cloudflare Stream iframe
  const isStream = video.type === 'stream' && !!video.iframeUrl;

  // ── R2/external <video>: continue watching seek + throttled progress ──
  useEffect(() => {
    if (!directUrl) return;
    const el = videoRef.current;
    if (!el) return;

    const handleLoaded = () => {
      // Continue watching — өмнө үзсэн газраас үргэлжлүүлэх
      if (resumeFrom > 0 && resumeFrom < (el.duration || Infinity) - 2) {
        el.currentTime = resumeFrom;
      }
    };
    const handleTimeUpdate = () => {
      const now = el.currentTime;
      // 15 секунд тутамд л хадгална (throttle)
      if (now - lastSavedRef.current >= 15) {
        lastSavedRef.current = now;
        onSaveProgress?.({
          watchedSeconds: Math.floor(now),
          durationSec: Number.isFinite(el.duration) ? Math.floor(el.duration) : undefined,
        });
      }
    };
    const handleEnded = () => {
      onSaveProgress?.({
        watchedSeconds: Math.floor(el.duration || el.currentTime),
        durationSec: Number.isFinite(el.duration) ? Math.floor(el.duration) : undefined,
        completed: true,
      });
    };

    el.addEventListener('loadedmetadata', handleLoaded);
    el.addEventListener('timeupdate', handleTimeUpdate);
    el.addEventListener('ended', handleEnded);
    return () => {
      el.removeEventListener('loadedmetadata', handleLoaded);
      el.removeEventListener('timeupdate', handleTimeUpdate);
      el.removeEventListener('ended', handleEnded);
      // Модал хаагдахад сүүлийн байрлалыг хадгална
      if (el.currentTime > 0) {
        onSaveProgress?.({
          watchedSeconds: Math.floor(el.currentTime),
          durationSec: Number.isFinite(el.duration) ? Math.floor(el.duration) : undefined,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directUrl, resumeFrom]);

  // ── Cloudflare Stream iframe: currentTime авах боломжгүй тул энгийн логик ──
  // Нээгдэхэд "үзэж эхэлсэн", хаагдахад "үзсэн" тэмдэглэнэ.
  useEffect(() => {
    if (!isStream) return;
    onSaveProgress?.({ watchedSeconds: Math.max(1, resumeFrom) });
    return () => {
      onSaveProgress?.({
        watchedSeconds: lesson.durationSec ?? Math.max(1, resumeFrom),
        durationSec: lesson.durationSec ?? undefined,
        completed: true,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStream]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-4xl rounded-2xl overflow-hidden bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900">
          <p className="text-sm font-medium text-white truncate pr-4">{lesson.title}</p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
        {/* 16:9 responsive container */}
        <div className="relative aspect-video bg-black">
          {isStream ? (
            // Cloudflare Stream — signed token iframe дотор, найдвартай player
            <iframe
              src={video.iframeUrl}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;"
              allowFullScreen
              title={lesson.title}
            />
          ) : externalEmbed ? (
            <iframe
              src={externalEmbed}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={lesson.title}
            />
          ) : directUrl ? (
            <video
              ref={videoRef}
              src={directUrl}
              className="absolute inset-0 h-full w-full"
              controls
              autoPlay
            />
          ) : null}
        </div>
        {lesson.description && (
          <div className="px-4 py-3 bg-zinc-900 max-h-32 overflow-y-auto">
            {lesson.description.startsWith('<') ? (
              <div
                className="prose prose-sm prose-invert max-w-none text-zinc-300 text-sm"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(lesson.description) }}
              />
            ) : (
              <p className="text-sm text-zinc-300 leading-relaxed">{lesson.description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Single lesson row ────────────────────────────────────────────────────────
function LessonRow({
  lesson,
  index,
  purchased,
  sessionLoading,
  loadingLessonId,
  expandedId,
  progress,
  onRowClick,
  onPlayClick,
}: {
  lesson: CourseLesson;
  index: number;
  purchased: boolean;
  sessionLoading: boolean;
  loadingLessonId: string | null;
  expandedId: string | null;
  progress?: LessonProgress;
  onRowClick: (lesson: CourseLesson) => void;
  onPlayClick: (e: React.MouseEvent, lesson: CourseLesson) => void;
}) {
  const locked = !sessionLoading && !lesson.isFreePreview && !purchased;
  const dur = formatDuration(lesson.durationSec);
  const descText = lesson.description?.replace(/<[^>]*>/g, '').trim() ?? '';
  const hasDesc = descText.length > 0;
  const isExpanded = expandedId === lesson.id;
  const isLoadingThis = loadingLessonId === lesson.id;

  // Progress тооцоо (continue watching UI)
  const completed = !!progress?.completed;
  const watched = progress?.watchedSeconds ?? 0;
  const total = progress?.durationSec ?? lesson.durationSec ?? 0;
  const pct = !completed && watched > 0 && total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0;
  const inProgress = pct > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-3 px-4 py-3 transition-colors
          ${hasDesc ? 'cursor-pointer hover:bg-muted/40' : ''}
          ${isExpanded ? 'bg-muted/30' : ''}`}
        onClick={() => hasDesc && onRowClick(lesson)}
      >
        {/* Play / lock / completed icon */}
        <div
          className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-full border
            ${completed ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'}`}
        >
          {completed ? (
            <Check className="h-3.5 w-3.5" />
          ) : locked ? (
            <Lock className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Play className="h-3 w-3 text-muted-foreground fill-muted-foreground" />
          )}
        </div>

        {/* Title + progress bar */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${locked ? 'text-muted-foreground' : 'text-foreground'}`}>
            {lesson.title}
          </p>
          {inProgress && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 max-w-40 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{pct}%</span>
            </div>
          )}
        </div>

        {/* Right: action → duration → chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {lesson.isFreePreview && lesson.videoUrl ? (
            <button
              type="button"
              onClick={(e) => onPlayClick(e, lesson)}
              className="flex items-center gap-1 rounded border border-primary/40 bg-primary/5 hover:bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary transition-colors"
            >
              <Play className="h-2.5 w-2.5 fill-primary" />
              Preview
            </button>
          ) : lesson.isFreePreview && !lesson.videoUrl ? (
            <span className="flex items-center gap-1 rounded border border-muted bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
              <Play className="h-2.5 w-2.5" />
              Preview
            </span>
          ) : purchased ? (
            <button
              type="button"
              onClick={(e) => onPlayClick(e, lesson)}
              disabled={isLoadingThis}
              className="flex items-center gap-1 rounded bg-primary/10 hover:bg-primary/20 disabled:opacity-60 px-2 py-0.5 text-xs font-semibold text-primary transition-colors"
            >
              {isLoadingThis ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <Play className="h-2.5 w-2.5 fill-primary" />
              )}
              Үзэх
            </button>
          ) : locked ? (
            <span className="flex h-6 w-6 items-center justify-center text-muted-foreground/60">
              <Lock className="h-3 w-3" />
            </span>
          ) : null}
          {dur && <span className="text-xs text-muted-foreground tabular-nums">{dur}</span>}
          {hasDesc ? (
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          ) : (
            <div className="h-4 w-4" />
          )}
        </div>
      </div>

      {/* Expandable description */}
      {isExpanded && hasDesc && (
        <div className="px-4 pb-4 pt-2 bg-muted/20 border-t border-border/50 pl-16">
          {lesson.description!.startsWith('<') ? (
            <div
              className="prose prose-sm max-w-none text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(lesson.description!) }}
            />
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">{lesson.description}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Module accordion section ─────────────────────────────────────────────────
function ModuleSection({
  mod,
  lessonOffset,
  isOpen,
  onToggle,
  purchased,
  sessionLoading,
  loadingLessonId,
  expandedId,
  progressMap,
  onRowClick,
  onPlayClick,
}: {
  mod: CourseModule;
  lessonOffset: number;
  isOpen: boolean;
  onToggle: () => void;
  purchased: boolean;
  sessionLoading: boolean;
  loadingLessonId: string | null;
  expandedId: string | null;
  progressMap: Record<string, LessonProgress>;
  onRowClick: (lesson: CourseLesson) => void;
  onPlayClick: (e: React.MouseEvent, lesson: CourseLesson) => void;
}) {
  const totalSec = mod.lessons.reduce((s, l) => s + (l.durationSec ?? 0), 0);
  const previewCount = mod.lessons.filter((l) => l.isFreePreview).length;

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Module header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{mod.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <span>{mod.lessons.length} хичээл</span>
            {totalSec > 0 && <span>· {formatTotalDuration(totalSec)}</span>}
            {previewCount > 0 && <span>· {previewCount} үнэгүй preview</span>}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Lessons inside module */}
      {isOpen && (
        <div className="divide-y divide-border/60 bg-background">
          {mod.lessons.map((lesson, i) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              index={lessonOffset + i}
              purchased={purchased}
              sessionLoading={sessionLoading}
              loadingLessonId={loadingLessonId}
              expandedId={expandedId}
              progress={progressMap[lesson.id]}
              onRowClick={onRowClick}
              onPlayClick={onPlayClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main curriculum component ────────────────────────────────────────────────
export function CourseCurriculum({
  modules,
  lessons,
  productId,
  productSlug,
}: {
  modules: CourseModule[];
  lessons: CourseLesson[];
  productId: string;
  productSlug: string;
}) {
  const { data: session, status } = useSession();
  const [activeLesson, setActiveLesson] = useState<CourseLesson | null>(null);
  const [activeVideo, setActiveVideo] = useState<LessonVideoResult | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingLessonId, setLoadingLessonId] = useState<string | null>(null);

  // First module open by default, rest collapsed
  const [openModules, setOpenModules] = useState<Set<string>>(() => new Set(modules.length > 0 ? [modules[0].id] : []));
  const allOpen = openModules.size === modules.length;
  const toggleModule = (id: string) =>
    setOpenModules((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const expandAll = () => setOpenModules(new Set(modules.map((m) => m.id)));
  const collapseAll = () => setOpenModules(new Set());

  const { data: library = [] } = useQuery({
    queryKey: ['downloads', 'history'],
    queryFn: () => downloadsApi.history(session!.accessToken!),
    enabled: !!session?.accessToken,
    staleTime: 60_000,
  });

  const sessionLoading = status === 'loading';
  const purchased = library.some((item) => item.product.id === productId);

  // Watch progress — зөвхөн худалдаж авсан хэрэглэгчдэд
  const { data: progressList = [], refetch: refetchProgress } = useQuery({
    queryKey: ['course-progress', productSlug],
    queryFn: () => coursesApi.getProgress(session!.accessToken!, productSlug),
    enabled: !!session?.accessToken && purchased,
    staleTime: 30_000,
  });

  // lessonId → progress map (хайлт хурдан)
  const progressMap: Record<string, LessonProgress> = {};
  for (const p of progressList) progressMap[p.lessonId] = p;

  // All lessons flat for stats
  const allLessons = [...lessons, ...modules.flatMap((m) => m.lessons)];
  const totalSec = allLessons.reduce((s, l) => s + (l.durationSec ?? 0), 0);
  const totalModules = modules.length;
  const completedCount = allLessons.filter((l) => progressMap[l.id]?.completed).length;

  // Continue watching — хамгийн сүүлд үзэж байсан (completed биш, watchedSeconds>0) хичээл.
  // Бичигдсэн дарааллаар модулиуд → flat lessons.
  const orderedLessons = [...modules.flatMap((m) => m.lessons), ...lessons];
  let resumeLesson: CourseLesson | null = null;
  for (const l of orderedLessons) {
    const p = progressMap[l.id];
    if (p && !p.completed && p.watchedSeconds > 0) resumeLesson = l;
  }

  function handleRowClick(lesson: CourseLesson) {
    if (!lesson.description) return;
    setExpandedId(expandedId === lesson.id ? null : lesson.id);
  }

  // Progress хадгалах — saveProgress дуудаад дараа нь жагсаалт сэргээнэ
  const saveProgress = useCallback(
    (lessonId: string, body: { watchedSeconds: number; durationSec?: number; completed?: boolean }) => {
      if (!session?.accessToken || !purchased) return;
      coursesApi
        .saveProgress(session.accessToken, productSlug, lessonId, body)
        .then(() => refetchProgress())
        .catch(() => {
          /* progress хадгалалт амжилтгүй — чимээгүй өнгөрөөнө */
        });
    },
    [session?.accessToken, purchased, productSlug, refetchProgress],
  );

  async function openLesson(lesson: CourseLesson) {
    // Үнэгүй preview — getLessonVideoUrl дуудалгүй шууд external/url ашиглана
    if (lesson.isFreePreview && lesson.videoUrl && !purchased) {
      setActiveLesson(lesson);
      setActiveVideo({ lessonId: lesson.id, type: 'external', url: lesson.videoUrl });
      return;
    }
    if (purchased && session?.accessToken) {
      setLoadingLessonId(lesson.id);
      try {
        const res = await coursesApi.getLessonVideoUrl(session.accessToken, productSlug, lesson.id);
        setActiveLesson(lesson);
        setActiveVideo(res);
      } catch {
        // silently ignore
      } finally {
        setLoadingLessonId(null);
      }
    }
  }

  async function handlePlayClick(e: React.MouseEvent, lesson: CourseLesson) {
    e.stopPropagation();
    await openLesson(lesson);
  }

  const sharedProps = {
    purchased,
    sessionLoading,
    loadingLessonId,
    expandedId,
    progressMap,
    onRowClick: handleRowClick,
    onPlayClick: handlePlayClick,
  };

  return (
    <>
      {/* Stats bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 mb-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">{allLessons.length}</span> хичээл
          </span>
          {totalModules > 0 && (
            <span className="flex items-center gap-1.5">
              <FolderOpen className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">{totalModules}</span> бүлэг
            </span>
          )}
          {totalSec > 0 && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">{formatTotalDuration(totalSec)}</span> нийт
            </span>
          )}
          {purchased && completedCount > 0 && (
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">
                {completedCount}/{allLessons.length}
              </span>{' '}
              үзсэн
            </span>
          )}
        </div>
        {totalModules > 0 && (
          <button
            type="button"
            onClick={allOpen ? collapseAll : expandAll}
            className="text-xs font-medium text-primary hover:underline shrink-0"
          >
            {allOpen ? 'Бүгдийг хаах' : 'Бүгдийг нээх'}
          </button>
        )}
      </div>

      {/* Continue watching — хамгийн сүүлд үзэж байсан хичээлээс үргэлжлүүлэх */}
      {purchased && resumeLesson && (
        <button
          type="button"
          onClick={() => openLesson(resumeLesson!)}
          disabled={loadingLessonId === resumeLesson.id}
          className="mb-4 flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10 disabled:opacity-60"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {loadingLessonId === resumeLesson.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-primary">Үргэлжлүүлэн үзэх</p>
            <p className="truncate text-sm font-semibold text-foreground">{resumeLesson.title}</p>
          </div>
        </button>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        {/* Modules (accordion) */}
        {modules.map((mod, mi) => {
          const offset = modules.slice(0, mi).reduce((s, m) => s + m.lessons.length, 0);
          return (
            <ModuleSection
              key={mod.id}
              mod={mod}
              lessonOffset={offset}
              isOpen={openModules.has(mod.id)}
              onToggle={() => toggleModule(mod.id)}
              {...sharedProps}
            />
          );
        })}

        {/* Ungrouped lessons (flat list, after modules) */}
        {lessons.length > 0 && (
          <div className={`divide-y divide-border/60 ${modules.length > 0 ? 'border-t border-border' : ''}`}>
            {lessons.map((lesson, i) => {
              const { progressMap: pm, ...rowProps } = sharedProps;
              return (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  index={allLessons.length - lessons.length + i}
                  progress={pm[lesson.id]}
                  {...rowProps}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Video modal */}
      {activeLesson && activeVideo && (
        <VideoModal
          lesson={activeLesson}
          video={activeVideo}
          resumeFrom={
            purchased && !progressMap[activeLesson.id]?.completed
              ? progressMap[activeLesson.id]?.watchedSeconds ?? 0
              : 0
          }
          onSaveProgress={purchased ? (body) => saveProgress(activeLesson.id, body) : undefined}
          onClose={() => {
            setActiveLesson(null);
            setActiveVideo(null);
          }}
        />
      )}
    </>
  );
}
