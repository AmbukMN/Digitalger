'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CornerDownRight,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  MessageCircleQuestion,
  Paperclip,
  Pin,
  Send,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  coursesApi,
  isQnaMimeAllowed,
  QNA_MAX_FILE_SIZE,
} from '@/lib/api';
import type { LessonAnswer, LessonQuestion, QnaAttachment } from '@/lib/api';

// ─── Огноо форматлах (харьцангуй) ─────────────────────────────────────────────
function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'дөнгөж сая';
  if (min < 60) return `${min} мин өмнө`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} цаг өмнө`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} өдрийн өмнө`;
  return d.toLocaleDateString('mn-MN');
}

// ─── Байт → хүн уншихуйц хэмжээ ───────────────────────────────────────────────
function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function isImageMime(mime?: string): boolean {
  return !!mime && mime.startsWith('image/');
}

// ─── Хэрэглэгчийн нэрийн эхний үсэг (avatar fallback) ─────────────────────────
function initial(name?: string | null): string {
  const n = (name ?? '').trim();
  return n ? n[0].toUpperCase() : '?';
}

function Avatar({ name, image, instructor }: { name?: string | null; image?: string | null; instructor?: boolean }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name ?? ''}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      className={
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ' +
        (instructor ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')
      }
    >
      {initial(name)}
    </span>
  );
}

// ─── Жагсаалтад хавсралт харуулах (image preview / файл татах) ─────────────────
function AttachmentView({ att }: { att: QnaAttachment }) {
  const url = att.attachmentUrl;
  if (isImageMime(att.attachmentMimeType) && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block w-fit max-w-full overflow-hidden rounded-xl border border-border"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={att.attachmentName}
          loading="lazy"
          className="max-h-56 w-auto max-w-full object-contain"
        />
      </a>
    );
  }
  // Зураг биш / URL байхгүй — файлын карт (татах)
  const inner = (
    <div className="mt-2 flex w-fit max-w-full items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
        {att.attachmentName}
      </span>
      {att.attachmentSize > 0 && (
        <span className="shrink-0 text-[10px] text-muted-foreground">{formatBytes(att.attachmentSize)}</span>
      )}
      {url && <Download className="h-3.5 w-3.5 shrink-0 text-primary" />}
    </div>
  );
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" download={att.attachmentName} className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}

// ─── Сонгосон (илгээхийн өмнөх) файлын preview + устгах ────────────────────────
function PendingAttachment({
  file,
  previewUrl,
  uploading,
  progress,
  onRemove,
}: {
  file: File;
  previewUrl: string | null;
  uploading: boolean;
  progress: number;
  onRemove: () => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-2">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt={file.name} className="h-10 w-10 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{file.name}</p>
        {uploading ? (
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">{formatBytes(file.size)}</p>
        )}
      </div>
      {!uploading && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          aria-label="Хавсралт хасах"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {uploading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
    </div>
  );
}

// ─── Файл сонгох товч (📎) + урьдчилсан шалгалт (mime/хэмжээ) ──────────────────
function AttachButton({
  onPick,
  disabled,
}: {
  onPick: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // ижил файлыг дахин сонгож болохуйц болгох
    if (!file) return;
    if (file.size > QNA_MAX_FILE_SIZE) {
      toast.error('Файл хэт том байна (дээд тал нь 100MB)');
      return;
    }
    const mime = file.type || 'application/octet-stream';
    if (!isQnaMimeAllowed(mime)) {
      toast.error('Зөвшөөрөгдөөгүй файлын төрөл (зураг / PDF / Office / zip)');
      return;
    }
    onPick(file);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-ring hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Paperclip className="h-3.5 w-3.5" />
        Хавсаргах
      </button>
    </>
  );
}

// ─── Нэг хариулт (chat bubble) ────────────────────────────────────────────────
// Багшийн хариулт → primary өнгийн bubble + GraduationCap + "Багш" badge (тод ялгарна).
// Хэрэглэгчийн хариулт → энгийн muted bubble.
function AnswerRow({ a }: { a: LessonAnswer }) {
  const instructor = a.isInstructor;
  return (
    <motion.div
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-2.5"
    >
      <Avatar name={a.user.name} image={a.user.image} instructor={instructor} />
      <div
        className={
          'min-w-0 flex-1 rounded-xl rounded-tl-sm border px-3 py-2 ' +
          (instructor
            ? 'border-primary/30 bg-primary/[0.07] ring-1 ring-inset ring-primary/10'
            : 'border-border bg-muted/40')
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {instructor ? (
            /* Багш хариулсан үед нэр (Admin) ХАРУУЛАХГҮЙ — зөвхөн "Багш" badge. */
            <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              <GraduationCap className="h-3 w-3" />
              Багш
            </span>
          ) : (
            <span className="text-xs font-semibold text-foreground">
              {a.user.name ?? 'Хэрэглэгч'}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
        </div>
        {a.answer && (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/80">{a.answer}</p>
        )}
        {a.attachment && <AttachmentView att={a.attachment} />}
      </div>
    </motion.div>
  );
}

// ─── Нэг асуулт + хариултууд + хариулах талбар ────────────────────────────────
function QuestionCard({
  q,
  token,
  onAnswered,
}: {
  q: LessonQuestion;
  token?: string;
  onAnswered: (questionId: string, answer: LessonAnswer) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  // Хариултын хавсралт
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Сонгосон зургийн preview URL (object URL) — цэвэрлэнэ
  useEffect(() => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  const submitReply = useCallback(async () => {
    const text = reply.trim();
    if ((!text && !file) || !token || sending) return;
    setSending(true);
    try {
      let attachment: QnaAttachment | null = null;
      if (file) {
        setProgress(0);
        attachment = await coursesApi.questions.uploadAttachment(token, file, setProgress);
      }
      const ans = await coursesApi.questions.answer(token, q.id, text, attachment);
      onAnswered(q.id, ans);
      setReply('');
      setReplying(false);
      setFile(null);
      setProgress(0);
      toast.success('Хариулт нэмэгдлээ');
    } catch {
      toast.error(file ? 'Хавсралт/хариулт илгээж чадсангүй' : 'Хариулт илгээж чадсангүй');
    } finally {
      setSending(false);
    }
  }, [reply, file, token, sending, q.id, onAnswered]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4"
    >
      {/* Асуулт (chat bubble — зүүн талд) */}
      <div className="flex gap-2.5">
        <Avatar name={q.user.name} image={q.user.image} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{q.user.name ?? 'Хэрэглэгч'}</span>
            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              <MessageCircleQuestion className="h-3 w-3" />
              Асуулт
            </span>
            {q.isPinned && (
              <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                <Pin className="h-3 w-3" />
                Онцолсон
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">{timeAgo(q.createdAt)}</span>
          </div>
          {q.question && (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/90">{q.question}</p>
          )}
          {q.attachment && <AttachmentView att={q.attachment} />}
        </div>
      </div>

      {/* Хариултууд (thread — зүүн заагч шугамтай) */}
      {q.answers.length > 0 && (
        <div className="mt-3 space-y-2.5 border-l-2 border-primary/15 pl-3 sm:pl-5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            <CornerDownRight className="h-3 w-3" />
            {q.answers.length} хариулт
          </p>
          {q.answers.map((a, i) => (
            <AnswerRow key={a.id ?? i} a={a} />
          ))}
        </div>
      )}

      {/* Хариулах */}
      {token && (
        <div className="mt-3">
          {replying ? (
            <div className="space-y-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Хариултаа бичнэ үү..."
                rows={2}
                autoFocus
                disabled={sending}
                className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
              />
              {file && (
                <PendingAttachment
                  file={file}
                  previewUrl={previewUrl}
                  uploading={sending && progress < 100 && progress > 0}
                  progress={progress}
                  onRemove={() => setFile(null)}
                />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={submitReply}
                  disabled={(!reply.trim() && !file) || sending}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Илгээх
                </button>
                {!file && <AttachButton onPick={setFile} disabled={sending} />}
                <button
                  type="button"
                  onClick={() => {
                    setReplying(false);
                    setReply('');
                    setFile(null);
                  }}
                  disabled={sending}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  Болих
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setReplying(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <CornerDownRight className="h-3.5 w-3.5" />
              Хариулах
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Main: Q&A панел ──────────────────────────────────────────────────────────
export function LessonQA({
  productSlug,
  lessonId,
  token,
}: {
  productSlug: string;
  lessonId: string;
  token?: string;
}) {
  const [questions, setQuestions] = useState<LessonQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [text, setText] = useState('');
  const [asking, setAsking] = useState(false);

  // Асуултын хавсралт
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Сонгосон зургийн preview (object URL)
  useEffect(() => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  // Хичээл солих бүрт асуултуудыг дахин татах
  useEffect(() => {
    if (!token) {
      setQuestions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    coursesApi.questions
      .list(token, productSlug, lessonId)
      .then((list) => {
        if (!cancelled) setQuestions(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) {
          // Backend бэлэн биш бол хоосон төлөв (алдаа биш)
          setQuestions([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productSlug, lessonId, token]);

  // Эрэмбэ: онцолсон нь дээр
  const sorted = useMemo(
    () => [...questions].sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned)),
    [questions],
  );

  const submitQuestion = useCallback(async () => {
    const q = text.trim();
    if ((!q && !file) || !token || asking) return;
    setAsking(true);
    try {
      let attachment: QnaAttachment | null = null;
      if (file) {
        setProgress(0);
        attachment = await coursesApi.questions.uploadAttachment(token, file, setProgress);
      }
      const created = await coursesApi.questions.ask(token, productSlug, lessonId, q, attachment);
      setQuestions((prev) => [created, ...prev]);
      setText('');
      setFile(null);
      setProgress(0);
      toast.success('Асуулт илгээгдлээ');
    } catch {
      toast.error(file ? 'Хавсралт/асуулт илгээж чадсангүй' : 'Асуулт илгээж чадсангүй');
    } finally {
      setAsking(false);
    }
  }, [text, file, token, asking, productSlug, lessonId]);

  const handleAnswered = useCallback((questionId: string, answer: LessonAnswer) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, answers: [...q.answers, answer] } : q)),
    );
  }, []);

  return (
    <div className="space-y-4">
      {/* Асуулт бичих */}
      {token ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Энэ хичээлийн талаар асуух зүйлээ бичнэ үү..."
            rows={3}
            disabled={asking}
            className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
          />
          {file && (
            <PendingAttachment
              file={file}
              previewUrl={previewUrl}
              uploading={asking && progress < 100 && progress > 0}
              progress={progress}
              onRemove={() => setFile(null)}
            />
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            {!file ? (
              <AttachButton onPick={setFile} disabled={asking} />
            ) : (
              <span className="text-xs text-muted-foreground">Зураг/файл хавсаргасан</span>
            )}
            <button
              type="button"
              onClick={submitQuestion}
              disabled={(!text.trim() && !file) || asking}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Асуулт илгээх
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-6 py-6 text-center text-sm text-muted-foreground">
          Асуулт асуухын тулд нэвтэрнэ үү.
        </div>
      )}

      {/* Жагсаалт */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Ачааллаж байна...
        </div>
      ) : sorted.length > 0 ? (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {sorted.map((q) => (
              <QuestionCard key={q.id} q={q} token={token} onAnswered={handleAnswered} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <MessageCircleQuestion className="h-7 w-7 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">
            {error ? 'Асуулт-хариулт одоогоор боломжгүй байна.' : 'Асуулт хараахан алга.'}
          </p>
          {!error && token && (
            <p className="max-w-sm text-xs text-muted-foreground/70">Хамгийн түрүүнд асуулт асууж, хэлэлцүүлгийг эхлүүлээрэй.</p>
          )}
        </div>
      )}
    </div>
  );
}
