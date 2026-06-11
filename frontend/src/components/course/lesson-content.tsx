'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Download,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Loader2,
  Lock,
  MessageCircleQuestion,
  NotebookPen,
  Paperclip,
  Save,
  StickyNote,
} from 'lucide-react';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@digitalger/shared/ui';
import { cn } from '@digitalger/shared';
import { coursesApi } from '@/lib/api';
import type { LessonResource } from '@/lib/api';
import type { CourseLesson } from '@/types/api';
import { sanitizeHtml } from '@/lib/safe-html';
import { LessonQA } from '@/components/course/lesson-qa';
import { LessonQuiz } from '@/components/course/lesson-quiz';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Файлын төрлөөр icon сонгох
function resourceIcon(res: LessonResource) {
  const name = res.fileName.toLowerCase();
  const mime = (res.mimeType ?? '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(name)) return FileImage;
  if (mime.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/.test(name)) return FileVideo;
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/.test(name)) return FileAudio;
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) return FileArchive;
  if (/\.(xls|xlsx|csv|numbers)$/.test(name)) return FileSpreadsheet;
  if (/\.(js|ts|tsx|jsx|json|html|css|py|java|c|cpp|go|rs|php|rb|sql)$/.test(name)) return FileCode2;
  return FileText;
}

function hasRichContent(html: string | null | undefined): boolean {
  if (!html) return false;
  return html.replace(/<[^>]*>/g, '').trim().length > 0;
}

// ─── Татах материалын мөр ───────────────────────────────────────────────────
function ResourceRow({
  res,
  productSlug,
  token,
}: {
  res: LessonResource;
  productSlug: string;
  token?: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const Icon = resourceIcon(res);
  const size = formatBytes(res.sizeBytes);

  const handleDownload = useCallback(async () => {
    if (!token || downloading) return;
    setDownloading(true);
    try {
      const { url } = await coursesApi.getResourceDownload(token, productSlug, res.id);
      // Шинэ tab-аар нээж татах (signed url)
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener noreferrer';
      a.target = '_blank';
      a.download = res.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* татах амжилтгүй — чимээгүй өнгөрөөнө */
    } finally {
      setDownloading(false);
    }
  }, [token, downloading, productSlug, res.id, res.fileName]);

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={!token || downloading}
      className="group flex w-full items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#ffbe00]/15 text-[#ffbe00]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{res.fileName}</span>
        {size && <span className="mt-0.5 block text-[11px] text-muted-foreground">{size}</span>}
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors group-hover:bg-[#ffbe00] group-hover:text-[#022179]">
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </span>
    </button>
  );
}

// ─── Хувийн тэмдэглэл (localStorage) ─────────────────────────────────────────
function PersonalNote({ noteKey }: { noteKey: string }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const loadedRef = useRef(false);

  // localStorage-аас ачаалах (хичээл солих бүрт)
  useEffect(() => {
    loadedRef.current = false;
    try {
      setValue(localStorage.getItem(noteKey) ?? '');
    } catch {
      setValue('');
    }
    setSaved(false);
    // дараагийн tick-д л debounce save идэвхжүүлнэ (ачаалал нь save-аар тооцогдохгүй)
    const t = setTimeout(() => {
      loadedRef.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, [noteKey]);

  // Авто-хадгалах (debounce 600мс)
  useEffect(() => {
    if (!loadedRef.current) return;
    const t = setTimeout(() => {
      try {
        if (value.trim()) localStorage.setItem(noteKey, value);
        else localStorage.removeItem(noteKey);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch {
        /* localStorage боломжгүй — өнгөрөөнө */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [value, noteKey]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Энэ хичээлд хувийн тэмдэглэлээ бичээрэй (зөвхөн та харна).</p>
        {saved && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
            <Save className="h-3 w-3" /> Хадгалагдлаа
          </span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Жишээ нь: 12:30-д хэлсэн томьёог тэмдэглэх..."
        rows={6}
        className="w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
    </div>
  );
}

// ─── Хоосон төлөв ─────────────────────────────────────────────────────────────
function EmptyTab({ icon: Icon, text }: { icon: typeof FileText; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <Icon className="h-7 w-7 text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// ─── Түгжээтэй контентын upsell (YouTube шиг — байгааг мэдэгдээд худалдаж аваарай) ──
function LockedUpsell({
  icon: Icon,
  title,
  hint,
  productSlug,
}: {
  icon: typeof FileText;
  title: string;
  hint?: string;
  productSlug: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#ffbe00]/25 bg-[#ffbe00]/5 px-6 py-10 text-center">
      <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#ffbe00]/15 text-[#ffbe00]">
        <Icon className="h-5 w-5" />
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-card ring-2 ring-[#ffbe00]/30">
          <Lock className="h-3 w-3 text-[#ffbe00]" />
        </span>
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        <p className="mt-1 text-xs text-muted-foreground">Энэ хэсгийг үзэхийн тулд сургалтыг худалдаж аваарай.</p>
      </div>
      <Button asChild size="sm" className="bg-[#ffbe00] text-[#022179] hover:bg-[#ffbe00]/90">
        <Link href={`/products/${productSlug}`}>Худалдаж авах</Link>
      </Button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function LessonContent({
  lesson,
  content,
  resources,
  productSlug,
  token,
  userKey,
  locked = false,
}: {
  lesson: CourseLesson;
  content?: string | null;
  resources?: LessonResource[];
  productSlug: string;
  token?: string;
  /** Хувийн тэмдэглэлийн localStorage key prefix (userId эсвэл 'guest') */
  userKey: string;
  /**
   * Хичээл түгжээтэй эсэх (paid + худалдаагүй). YouTube шиг — tab бүтэц харагдана,
   * харин контентын оронд "худалдаж аваарай" upsell. Preview/худалдсан үед false.
   */
  locked?: boolean;
}) {
  const showContent = hasRichContent(content);
  const resourceList = resources ?? [];
  const noteKey = `digitalger:note:${userKey}:${lesson.id}`;

  // Default tab — content байвал тэмдэглэл, үгүй бол материал, үгүй бол хувийн тэмдэглэл.
  // Түгжээтэй үед заавал "Тэмдэглэл" таб (бүтэц нэгэн зэрэг харагдана).
  const defaultTab = useMemo(() => {
    if (locked) return 'notes';
    if (showContent) return 'notes';
    if (resourceList.length > 0) return 'resources';
    return 'mynotes';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  // ── Таб badge-ийн тоонууд (хөнгөн count query — locked/token-гүй бол алгасна) ──
  // Асуулт хариулт: ХАРИУЛААГҮЙ асуултын тоо (answers хоосон) badge.
  const { data: qaList } = useQuery({
    queryKey: ['lesson-qa', productSlug, lesson.id],
    queryFn: () => coursesApi.questions.list(token!, productSlug, lesson.id),
    enabled: !!token && !locked,
    staleTime: 20_000,
  });
  const unansweredCount = useMemo(
    () => (qaList ?? []).filter((q) => (q.answers?.length ?? 0) === 0).length,
    [qaList],
  );

  // Шалгалт: хэрэглэгчийн авсан хувь (bestAttempt) badge.
  const { data: quizData } = useQuery({
    queryKey: ['lesson-quiz', productSlug, lesson.id],
    queryFn: () => coursesApi.quiz.get(token!, productSlug, lesson.id).catch(() => null),
    enabled: !!token && !locked,
    staleTime: 20_000,
  });
  const quizScore = quizData?.bestAttempt?.score ?? null;
  const quizPassed = quizData?.bestAttempt?.passed ?? false;

  // Миний тэмдэглэл: localStorage-д бичсэн мөрийн тоо (хоосон мөр тооцохгүй).
  const [noteLineCount, setNoteLineCount] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(noteKey) ?? '';
    const lines = raw.split('\n').filter((l) => l.trim().length > 0).length;
    setNoteLineCount(lines);
  }, [noteKey, lesson.id]);

  return (
    <motion.div
      key={lesson.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="border-b border-border bg-card px-4 py-5"
    >
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted p-1">
          <TabsTrigger
            value="notes"
            className="gap-1.5 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <StickyNote className="h-3.5 w-3.5" />
            Хичээлийн тухай
          </TabsTrigger>
          <TabsTrigger
            value="resources"
            className="gap-1.5 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Материал
            {resourceList.length > 0 && (
              <span className="ml-1 rounded-full bg-foreground/15 px-1.5 text-[10px] font-bold tabular-nums">
                {resourceList.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="qa"
            className="gap-1.5 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <MessageCircleQuestion className="h-3.5 w-3.5" />
            Асуулт хариулт
            {/* Хариулаагүй асуулт байвал улаан анхааруулга badge (тоотой). */}
            {unansweredCount > 0 && (
              <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold tabular-nums text-white">
                {unansweredCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="quiz"
            className="gap-1.5 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            Шалгалт
            {/* Шалгалт өгсөн бол авсан хувь — тэнцсэн ногоон, тэнцээгүй амбер. */}
            {quizScore != null && (
              <span
                className={cn(
                  'ml-1 rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                  quizPassed ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white',
                )}
              >
                {quizScore}%
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="mynotes"
            className="gap-1.5 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <NotebookPen className="h-3.5 w-3.5" />
            Миний тэмдэглэл
            {/* Тэмдэглэл бичсэн бол мөрийн тоо badge. */}
            {noteLineCount > 0 && (
              <span className="ml-1 rounded-full bg-foreground/15 px-1.5 text-[10px] font-bold tabular-nums">
                {noteLineCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Тэмдэглэл (rich content) */}
        <TabsContent value="notes" className="mt-4">
          {locked ? (
            <LockedUpsell
              icon={StickyNote}
              title="Хичээлийн тэмдэглэл"
              hint="Энэ хичээлд бичгэн тэмдэглэл, тайлбар багтсан."
              productSlug={productSlug}
            />
          ) : showContent ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none leading-relaxed
                prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground
                prose-strong:text-foreground prose-a:text-[#ffbe00]
                prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[#ffbe00] prose-code:before:content-[''] prose-code:after:content-['']
                prose-pre:rounded-xl prose-pre:border prose-pre:border-border prose-pre:bg-muted
                prose-img:rounded-xl prose-img:border prose-img:border-border
                prose-blockquote:border-l-[#ffbe00] prose-blockquote:text-foreground/90"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content!) }}
            />
          ) : (
            <EmptyTab icon={StickyNote} text="Энэ хичээлд тэмдэглэл одоогоор алга." />
          )}
        </TabsContent>

        {/* Татах материал */}
        <TabsContent value="resources" className="mt-4">
          {locked ? (
            // Түгжээтэй — материал байгааг мэдэгдэх боловч татах түгжээтэй.
            resourceList.length > 0 ? (
              <div className="space-y-2">
                {resourceList.map((res) => {
                  const Icon = resourceIcon(res);
                  return (
                    <div
                      key={res.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 opacity-70"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#ffbe00]/15 text-[#ffbe00]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {res.fileName}
                      </span>
                      <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  );
                })}
                <LockedUpsell
                  icon={Paperclip}
                  title="Татах материал түгжээтэй"
                  hint={`${resourceList.length} файл хавсаргасан.`}
                  productSlug={productSlug}
                />
              </div>
            ) : (
              <LockedUpsell
                icon={Paperclip}
                title="Татах материал"
                hint="Энэ хичээлд татаж авах файл, материал багтсан байж болзошгүй."
                productSlug={productSlug}
              />
            )
          ) : resourceList.length > 0 ? (
            <div className="space-y-2">
              {resourceList.map((res) => (
                <ResourceRow key={res.id} res={res} productSlug={productSlug} token={token} />
              ))}
            </div>
          ) : (
            <EmptyTab icon={Paperclip} text="Энэ хичээлд татах материал алга." />
          )}
        </TabsContent>

        {/* Асуулт хариулт (Q&A) */}
        <TabsContent value="qa" className="mt-4">
          {locked ? (
            <LockedUpsell
              icon={MessageCircleQuestion}
              title="Асуулт хариулт"
              hint="Багштай асуулт асууж, бусад суралцагчийн хариултыг үзэх боломжтой."
              productSlug={productSlug}
            />
          ) : (
            <LessonQA productSlug={productSlug} lessonId={lesson.id} token={token} />
          )}
        </TabsContent>

        {/* Шалгалт (quiz) */}
        <TabsContent value="quiz" className="mt-4">
          {locked ? (
            <LockedUpsell
              icon={ClipboardCheck}
              title="Шалгалт"
              hint="Хичээлийн төгсгөлд мэдлэгээ шалгах сорил байна."
              productSlug={productSlug}
            />
          ) : (
            <LessonQuiz productSlug={productSlug} lessonId={lesson.id} token={token} />
          )}
        </TabsContent>

        {/* Миний тэмдэглэл (localStorage) */}
        <TabsContent value="mynotes" className="mt-4">
          <PersonalNote noteKey={noteKey} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

export { formatBytes as formatResourceBytes };
