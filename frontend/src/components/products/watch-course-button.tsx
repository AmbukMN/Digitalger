'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { PlayCircle } from 'lucide-react';
import { coursesApi, downloadsApi } from '@/lib/api';
import type { CourseLesson } from '@/types/api';

interface WatchCourseButtonProps {
  productId: string;
  productSlug: string;
  modules: { lessons: CourseLesson[] }[];
  lessons: CourseLesson[];
}

/**
 * Product page доорх "Хичээл үзэх / Үргэлжлүүлэн үзэх" товч.
 * - Худалдаж авсан хэрэглэгч: progress байвал "Үргэлжлүүлэн үзэх", үгүй бол "Хичээл үзэх".
 * - ⚠️ Худалдаагүй (preview-only) хэрэглэгчид ТУСДАА "Үнэгүй preview үзэх" товч ХАРУУЛАХГҮЙ:
 *   хичээл бүрийн ард байгаа "Preview / Үзэх" товч дээр дарж шууд тоглуулна (доорх curriculum).
 * Дарвал /learn/[slug] руу (continue watching хичээлийн ?lesson=-тэй).
 */
export function WatchCourseButton({ productId, productSlug, modules, lessons }: WatchCourseButtonProps) {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const { data: library = [] } = useQuery({
    queryKey: ['downloads', 'history'],
    queryFn: () => downloadsApi.history(token!),
    enabled: !!token,
    staleTime: 60_000,
  });
  const purchased = library.some((item) => item.product.id === productId);

  const { data: progressList = [] } = useQuery({
    queryKey: ['course-progress', productSlug],
    queryFn: () => coursesApi.getProgress(token!, productSlug),
    enabled: !!token && purchased,
    staleTime: 30_000,
  });

  const orderedLessons = [...modules.flatMap((m) => m.lessons), ...lessons];

  // ⚠️ Худалдаагүй бол ТУСДАА товч ХАРУУЛАХГҮЙ — preview-г хичээл бүрийн "Үзэх" товчоор
  //    тоглуулна (доорх CourseCurriculum). Зөвхөн худалдсан хэрэглэгчид энэ товч гарна.
  if (!purchased) return null;

  // Continue watching хичээл (completed биш, watched>0 — хамгийн сүүлийнх)
  let resumeId: string | null = null;
  const map = new Map(progressList.map((p) => [p.lessonId, p]));
  for (const l of orderedLessons) {
    const p = map.get(l.id);
    if (p && !p.completed && p.watchedSeconds > 0) resumeId = l.id;
  }

  const href = resumeId ? `/learn/${productSlug}?lesson=${resumeId}` : `/learn/${productSlug}`;
  const label = resumeId ? 'Үргэлжлүүлэн үзэх' : 'Хичээл үзэх';

  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary"
    >
      <PlayCircle className="h-4 w-4" />
      {label}
    </Link>
  );
}
