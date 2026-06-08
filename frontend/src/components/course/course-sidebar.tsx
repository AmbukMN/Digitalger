'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Clock, Lock, Play, FolderOpen } from 'lucide-react';
import { cn } from '@digitalger/shared';
import type { LessonProgress } from '@/lib/api';
import type { CourseLesson } from '@/types/api';

export interface CourseSidebarModule {
  id: string;
  title: string;
  sortOrder: number;
  lessons: CourseLesson[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  if (h > 0) return `${h} цаг ${m > 0 ? m + ' мин' : ''}`.trim();
  return `${m} мин`;
}

// Хичээлийн төлөв (locked/completed/progress) тооцоо — sidebar + watch page хуваалцана
export function computeLessonState(
  lesson: CourseLesson,
  purchased: boolean,
  progress?: LessonProgress,
) {
  const locked = !lesson.isFreePreview && !purchased;
  const completed = !!progress?.completed;
  const watched = progress?.watchedSeconds ?? 0;
  const total = progress?.durationSec ?? lesson.durationSec ?? 0;
  const pct = !completed && watched > 0 && total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0;
  return { locked, completed, pct };
}

/**
 * Курсын БОДИТ үзсэн хувь — нийт үзсэн хугацаа / нийт хугацаа.
 * Хичээлийн тоогоор биш (1/69=1%), бодит секундээр тооцох тул нэг видео
 * 90% үзэхэд явц бодитоор нэмэгдэнэ. Дууссан хичээлийг бүрэн (100%) гэж тооцно.
 * + дууссан хичээлийн тоо (completedCount / total).
 */
export function computeCourseProgress(
  allLessons: CourseLesson[],
  progressMap: Record<string, LessonProgress>,
) {
  let watchedSum = 0;
  let durationSum = 0;
  let completedCount = 0;

  for (const l of allLessons) {
    const p = progressMap[l.id];
    const dur = p?.durationSec ?? l.durationSec ?? 0;
    durationSum += dur;
    if (p?.completed) {
      completedCount += 1;
      // Дууссан хичээл = бүрэн үзсэн (watchedSeconds бага байсан ч).
      watchedSum += dur;
    } else if (p?.watchedSeconds && dur > 0) {
      watchedSum += Math.min(p.watchedSeconds, dur);
    }
  }

  const watchedPct = durationSum > 0 ? Math.min(100, Math.round((watchedSum / durationSum) * 100)) : 0;

  return {
    total: allLessons.length,
    completedCount,
    // Бодит үзсэн хувь (хугацаагаар). Хугацаа мэдэгдэхгүй (бүх durationSec=0)
    // тохиолдолд дууссан хичээлийн хувь руу шилжинэ (fallback).
    watchedPct:
      durationSum > 0
        ? watchedPct
        : allLessons.length > 0
          ? Math.round((completedCount / allLessons.length) * 100)
          : 0,
  };
}

// ─── Single lesson item ───────────────────────────────────────────────────────
function LessonItem({
  lesson,
  index,
  purchased,
  isCurrent,
  progress,
  onSelect,
}: {
  lesson: CourseLesson;
  index: number;
  purchased: boolean;
  isCurrent: boolean;
  progress?: LessonProgress;
  onSelect: (lesson: CourseLesson) => void;
}) {
  const { locked, completed, pct } = computeLessonState(lesson, purchased, progress);
  const dur = formatDuration(lesson.durationSec);
  const ref = useRef<HTMLButtonElement>(null);

  // Идэвхтэй хичээл → sidebar дотор автоматаар харагдахуйц scroll
  useEffect(() => {
    if (isCurrent && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isCurrent]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => !locked && onSelect(lesson)}
      disabled={locked}
      aria-current={isCurrent ? 'true' : undefined}
      className={cn(
        'group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
        locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-muted',
        isCurrent && 'bg-[#ffbe00]/10',
      )}
    >
      {/* Идэвхтэй (current) хичээлийн зүүн талын gold заагч */}
      {isCurrent && <span className="absolute left-0 top-0 h-full w-1 bg-[#ffbe00]" />}

      {/* Status icon */}
      <span
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
          completed
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : isCurrent
              ? 'border-[#ffbe00] bg-[#ffbe00]/20 text-[#ffbe00]'
              : 'border-border text-muted-foreground',
        )}
      >
        {completed ? (
          <Check className="h-3.5 w-3.5" />
        ) : locked ? (
          <Lock className="h-3 w-3" />
        ) : isCurrent ? (
          <Play className="h-3 w-3 fill-current" />
        ) : (
          index + 1
        )}
      </span>

      {/* Title + meta + progress */}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm leading-snug',
            isCurrent
              ? 'font-semibold text-[#ffbe00]'
              : completed
                ? 'text-muted-foreground'
                : 'text-foreground',
          )}
        >
          {lesson.title}
        </span>
        <span className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          {dur && (
            <span className="flex items-center gap-1 tabular-nums">
              <Clock className="h-3 w-3" />
              {dur}
            </span>
          )}
          {lesson.isFreePreview && !purchased && (
            <span className="rounded bg-[#ffbe00]/15 px-1.5 py-0.5 font-semibold text-[#ffbe00]">Preview</span>
          )}
        </span>
        {/* Хагас үзсэн progress bar */}
        {pct > 0 && (
          <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-[#ffbe00] transition-all" style={{ width: `${pct}%` }} />
          </span>
        )}
      </span>
    </button>
  );
}

// ─── Module accordion section ─────────────────────────────────────────────────
function ModuleSection({
  mod,
  indexOffset,
  purchased,
  currentLessonId,
  progressMap,
  onSelect,
}: {
  mod: CourseSidebarModule;
  indexOffset: number;
  purchased: boolean;
  currentLessonId: string | null;
  progressMap: Record<string, LessonProgress>;
  onSelect: (lesson: CourseLesson) => void;
}) {
  // Default: бүх section нээлттэй. Идэвхтэй хичээл доторх section заавал нээлттэй.
  const containsCurrent = mod.lessons.some((l) => l.id === currentLessonId);
  // localStorage-аас тухайн module-ийн collapse төлвийг сэргээх (anlazy init)
  const storageKey = `digitalger:course-mod:${mod.id}`;
  const [open, setOpen] = useState(true);

  // Mount дээр localStorage-аас уншиж сэргээх (SSR hydration зөрчилгүйн тулд effect-д)
  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v === '0') setOpen(false);
      else if (v === '1') setOpen(true);
    } catch {
      /* localStorage боломжгүй */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {
        /* localStorage боломжгүй */
      }
      return next;
    });
  };

  const isOpen = open || containsCurrent;

  const totalSec = mod.lessons.reduce((s, l) => s + (l.durationSec ?? 0), 0);
  const completedInMod = mod.lessons.filter((l) => progressMap[l.id]?.completed).length;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-3 bg-muted/50 px-4 py-3 text-left transition-colors hover:bg-muted"
      >
        <FolderOpen className="h-4 w-4 shrink-0 text-[#ffbe00]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{mod.title}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {completedInMod}/{mod.lessons.length} хичээл
            {totalSec > 0 && ` · ${formatTotalDuration(totalSec)}`}
          </span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div>
          {mod.lessons.map((lesson, i) => (
            <LessonItem
              key={lesson.id}
              lesson={lesson}
              index={indexOffset + i}
              purchased={purchased}
              isCurrent={lesson.id === currentLessonId}
              progress={progressMap[lesson.id]}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────
export function CourseSidebar({
  modules,
  lessons,
  purchased,
  currentLessonId,
  progressMap,
  onSelect,
}: {
  modules: CourseSidebarModule[];
  lessons: CourseLesson[];
  purchased: boolean;
  currentLessonId: string | null;
  progressMap: Record<string, LessonProgress>;
  onSelect: (lesson: CourseLesson) => void;
}) {
  // Нийт хичээл + БОДИТ үзсэн хувь (хугацаагаар) + дууссан хичээлийн тоо
  const { total, completedCount, watchedPct } = useMemo(() => {
    const all = [...modules.flatMap((m) => m.lessons), ...lessons];
    return computeCourseProgress(all, progressMap);
  }, [modules, lessons, progressMap]);

  // Дууссан хичээлийн хувь (бүтэн дугуй заагчид) — watchedPct-ээс ялгаатай
  const completedPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Дээд: курсын ерөнхий progress — БОДИТ үзсэн хувь (хугацаагаар) */}
      <div className="shrink-0 border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Сургалтын явц</span>
          <span className="text-sm font-bold text-[#ffbe00] tabular-nums">{watchedPct}%</span>
        </div>
        {/* Бодит үзсэн хувийн bar (gold) — доор нь дууссан хичээлийн bar (emerald) */}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[#ffbe00] transition-all duration-500"
            style={{ width: `${watchedPct}%` }}
          />
        </div>
        {/* Хоёр хэмжүүр: (1) бодит үзсэн хувь, (2) дууссан хичээл X/Y */}
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">Бодитоор үзсэн: {watchedPct}%</span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Check className="h-3 w-3 text-emerald-400" />
            {completedCount} / {total} хичээл дууссан
          </span>
        </div>
        {/* Дууссан хичээлийн нимгэн заагч (тусдаа хэмжүүр) */}
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${completedPct}%` }}
          />
        </div>
      </div>

      {/* Хичээлийн жагсаалт (scroll) */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {modules.map((mod, mi) => {
          const offset = modules.slice(0, mi).reduce((s, m) => s + m.lessons.length, 0);
          return (
            <ModuleSection
              key={mod.id}
              mod={mod}
              indexOffset={offset}
              purchased={purchased}
              currentLessonId={currentLessonId}
              progressMap={progressMap}
              onSelect={onSelect}
            />
          );
        })}

        {/* Бүлэггүй (flat) хичээлүүд */}
        {lessons.length > 0 && (
          <div className={cn(modules.length > 0 && 'border-t border-border')}>
            {modules.length > 0 && (
              <div className="bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Бусад хичээл
              </div>
            )}
            {lessons.map((lesson, i) => (
              <LessonItem
                key={lesson.id}
                lesson={lesson}
                index={modules.reduce((s, m) => s + m.lessons.length, 0) + i}
                purchased={purchased}
                isCurrent={lesson.id === currentLessonId}
                progress={progressMap[lesson.id]}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
