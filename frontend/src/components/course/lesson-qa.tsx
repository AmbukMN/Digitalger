'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CornerDownRight,
  GraduationCap,
  Loader2,
  MessageCircleQuestion,
  Pin,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { coursesApi } from '@/lib/api';
import type { LessonAnswer, LessonQuestion } from '@/lib/api';

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

// ─── Нэг хариулт ──────────────────────────────────────────────────────────────
function AnswerRow({ a }: { a: LessonAnswer }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-2.5"
    >
      <Avatar name={a.user.name} image={a.user.image} instructor={a.isInstructor} />
      <div className="min-w-0 flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{a.user.name ?? 'Хэрэглэгч'}</span>
          {a.isInstructor && (
            <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
              <GraduationCap className="h-3 w-3" />
              Багш
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/80">{a.answer}</p>
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

  const submitReply = useCallback(async () => {
    const text = reply.trim();
    if (!text || !token || sending) return;
    setSending(true);
    try {
      const ans = await coursesApi.questions.answer(token, q.id, text);
      onAnswered(q.id, ans);
      setReply('');
      setReplying(false);
      toast.success('Хариулт нэмэгдлээ');
    } catch {
      toast.error('Хариулт илгээж чадсангүй');
    } finally {
      setSending(false);
    }
  }, [reply, token, sending, q.id, onAnswered]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4"
    >
      {/* Асуулт */}
      <div className="flex gap-2.5">
        <Avatar name={q.user.name} image={q.user.image} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{q.user.name ?? 'Хэрэглэгч'}</span>
            {q.isPinned && (
              <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                <Pin className="h-3 w-3" />
                Онцолсон
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">{timeAgo(q.createdAt)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/90">{q.question}</p>
        </div>
      </div>

      {/* Хариултууд */}
      {q.answers.length > 0 && (
        <div className="mt-3 space-y-2 border-l border-border pl-3 sm:pl-5">
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
                className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={submitReply}
                  disabled={!reply.trim() || sending}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Илгээх
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplying(false);
                    setReply('');
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
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
    if (!q || !token || asking) return;
    setAsking(true);
    try {
      const created = await coursesApi.questions.ask(token, productSlug, lessonId, q);
      setQuestions((prev) => [created, ...prev]);
      setText('');
      toast.success('Асуулт илгээгдлээ');
    } catch {
      toast.error('Асуулт илгээж чадсангүй');
    } finally {
      setAsking(false);
    }
  }, [text, token, asking, productSlug, lessonId]);

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
            className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={submitQuestion}
              disabled={!text.trim() || asking}
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
