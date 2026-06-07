'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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
  MessageCircleQuestion,
  NotebookPen,
  Paperclip,
  Save,
  StickyNote,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@digitalger/shared/ui';
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
      className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#ffbe00]/15 text-[#ffbe00]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">{res.fileName}</span>
        {size && <span className="mt-0.5 block text-[11px] text-white/40">{size}</span>}
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/60 transition-colors group-hover:bg-[#ffbe00] group-hover:text-[#022179]">
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
        <p className="text-xs text-white/50">Энэ хичээлд хувийн тэмдэглэлээ бичээрэй (зөвхөн та харна).</p>
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
        className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#ffbe00]/50 focus:bg-white/[0.05]"
      />
    </div>
  );
}

// ─── Хоосон төлөв ─────────────────────────────────────────────────────────────
function EmptyTab({ icon: Icon, text }: { icon: typeof FileText; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 px-6 py-10 text-center">
      <Icon className="h-7 w-7 text-white/25" />
      <p className="text-sm text-white/40">{text}</p>
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
}: {
  lesson: CourseLesson;
  content?: string | null;
  resources?: LessonResource[];
  productSlug: string;
  token?: string;
  /** Хувийн тэмдэглэлийн localStorage key prefix (userId эсвэл 'guest') */
  userKey: string;
}) {
  const showContent = hasRichContent(content);
  const resourceList = resources ?? [];
  const noteKey = `digitalger:note:${userKey}:${lesson.id}`;

  // Default tab — content байвал тэмдэглэл, үгүй бол материал, үгүй бол хувийн тэмдэглэл
  const defaultTab = useMemo(() => {
    if (showContent) return 'notes';
    if (resourceList.length > 0) return 'resources';
    return 'mynotes';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  return (
    <motion.div
      key={lesson.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="border-b border-white/10 bg-[#0b1020] px-4 py-5"
    >
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-white/[0.04] p-1">
          <TabsTrigger
            value="notes"
            className="gap-1.5 text-white/60 data-[state=active]:bg-[#ffbe00] data-[state=active]:text-[#022179]"
          >
            <StickyNote className="h-3.5 w-3.5" />
            Тэмдэглэл
          </TabsTrigger>
          <TabsTrigger
            value="resources"
            className="gap-1.5 text-white/60 data-[state=active]:bg-[#ffbe00] data-[state=active]:text-[#022179]"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Материал
            {resourceList.length > 0 && (
              <span className="ml-1 rounded-full bg-white/15 px-1.5 text-[10px] font-bold tabular-nums">
                {resourceList.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="qa"
            className="gap-1.5 text-white/60 data-[state=active]:bg-[#ffbe00] data-[state=active]:text-[#022179]"
          >
            <MessageCircleQuestion className="h-3.5 w-3.5" />
            Асуулт хариулт
          </TabsTrigger>
          <TabsTrigger
            value="quiz"
            className="gap-1.5 text-white/60 data-[state=active]:bg-[#ffbe00] data-[state=active]:text-[#022179]"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            Шалгалт
          </TabsTrigger>
          <TabsTrigger
            value="mynotes"
            className="gap-1.5 text-white/60 data-[state=active]:bg-[#ffbe00] data-[state=active]:text-[#022179]"
          >
            <NotebookPen className="h-3.5 w-3.5" />
            Миний тэмдэглэл
          </TabsTrigger>
        </TabsList>

        {/* Тэмдэглэл (rich content) */}
        <TabsContent value="notes" className="mt-4">
          {showContent ? (
            <div
              className="prose prose-sm prose-invert max-w-none leading-relaxed
                prose-headings:text-white prose-p:text-white/80 prose-li:text-white/80
                prose-strong:text-white prose-a:text-[#ffbe00]
                prose-code:rounded prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[#ffbe00] prose-code:before:content-[''] prose-code:after:content-['']
                prose-pre:rounded-xl prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/50
                prose-img:rounded-xl prose-img:border prose-img:border-white/10
                prose-blockquote:border-l-[#ffbe00] prose-blockquote:text-white/70"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content!) }}
            />
          ) : (
            <EmptyTab icon={StickyNote} text="Энэ хичээлд тэмдэглэл одоогоор алга." />
          )}
        </TabsContent>

        {/* Татах материал */}
        <TabsContent value="resources" className="mt-4">
          {resourceList.length > 0 ? (
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
          <LessonQA productSlug={productSlug} lessonId={lesson.id} token={token} />
        </TabsContent>

        {/* Шалгалт (quiz) */}
        <TabsContent value="quiz" className="mt-4">
          <LessonQuiz productSlug={productSlug} lessonId={lesson.id} token={token} />
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
