import { BookOpen, Clock, FolderOpen, GraduationCap, PlayCircle, Sparkles } from 'lucide-react';
import type { CourseLesson } from '@/types/api';

interface CourseModule {
  id: string;
  title: string;
  sortOrder: number;
  lessons: CourseLesson[];
}

function formatTotalDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h} цаг ${m > 0 ? m + ' мин' : ''}`.trim();
  return `${m} минут`;
}

/**
 * Course (хичээлтэй) product-ийн дээд талын тойм хэсэг.
 * Зөвхөн hasLessons үед харагдана — file/template/bundle UI-д ОГТ нөлөөлөхгүй.
 *
 * Харуулах: нийт хичээл, бүлэг, нийт хугацаа, үнэгүй preview тоо, түвшин,
 * "Энэ курст юу сурах вэ" (highlight жагсаалт — модулиудаас үүсгэнэ).
 */
export function CourseOverview({
  modules,
  lessons,
  previewCount,
}: {
  modules: CourseModule[];
  lessons: CourseLesson[];
  previewCount: number;
}) {
  const allLessons = [...modules.flatMap((m) => m.lessons), ...lessons];
  const totalSec = allLessons.reduce((s, l) => s + (l.durationSec ?? 0), 0);
  const totalLessons = allLessons.length;
  const totalModules = modules.length;

  // "Энэ курст юу сурах вэ" — модулийн гарчгуудаас (байхгүй бол эхний хичээлүүдээс)
  const learnItems =
    totalModules > 0
      ? modules.map((m) => m.title)
      : allLessons.slice(0, 6).map((l) => l.title);

  const stats: { icon: typeof BookOpen; label: string; value: string }[] = [
    { icon: PlayCircle, label: 'Нийт хичээл', value: `${totalLessons}` },
    ...(totalModules > 0
      ? [{ icon: FolderOpen, label: 'Бүлэг', value: `${totalModules}` }]
      : []),
    ...(totalSec > 0
      ? [{ icon: Clock, label: 'Нийт хугацаа', value: formatTotalDuration(totalSec) }]
      : []),
    ...(previewCount > 0
      ? [{ icon: Sparkles, label: 'Үнэгүй preview', value: `${previewCount}` }]
      : []),
  ];

  return (
    <section className="rounded-2xl border border-primary/15 bg-linear-to-br from-primary/5 via-card to-primary/3 p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Энэ сургалтын тухай</h2>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card/60 px-4 py-3 text-center"
          >
            <s.icon className="mx-auto mb-1.5 h-5 w-5 text-primary" />
            <p className="text-lg font-bold leading-none tabular-nums">{s.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Энэ курст юу сурах вэ */}
      {learnItems.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <BookOpen className="h-4 w-4 text-primary" />
            {totalModules > 0 ? 'Сургалтын бүлгүүд' : 'Энэ сургалтаас юу үзэх вэ?'}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {learnItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary tabular-nums">
                  {i + 1}
                </span>
                <span className="text-sm leading-snug text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
