'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ClipboardCheck, Loader2, RotateCcw, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { coursesApi } from '@/lib/api';
import type { LessonQuiz as Quiz, QuizSubmitResult } from '@/lib/api';

// ─── Main: Шалгалт ──────────────────────────────────────────────────────────
export function LessonQuiz({
  productSlug,
  lessonId,
  token,
}: {
  productSlug: string;
  lessonId: string;
  token?: string;
}) {
  const queryClient = useQueryClient();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmitResult | null>(null);

  // Хичээл солих бүрт шалгалтыг дахин татах
  useEffect(() => {
    setQuiz(null);
    setStarted(false);
    setAnswers({});
    setResult(null);
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    coursesApi.quiz
      .get(token, productSlug, lessonId)
      .then((q) => {
        if (!cancelled) setQuiz(q ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productSlug, lessonId, token]);

  const allAnswered = useMemo(
    () => !!quiz && quiz.questions.every((q) => answers[q.id] !== undefined),
    [quiz, answers],
  );

  const select = useCallback((questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  }, []);

  const retry = useCallback(() => {
    setAnswers({});
    setResult(null);
    setStarted(true);
  }, []);

  const submit = useCallback(async () => {
    if (!quiz || !token || submitting || !allAnswered) return;
    setSubmitting(true);
    try {
      // Асуултын дарааллаар хариултын индексүүдийг бэлдэх
      const payload = quiz.questions.map((q) => answers[q.id]);
      const res = await coursesApi.quiz.submit(token, productSlug, lessonId, payload);
      setResult(res);
      // ⚠️ Таб badge (lesson-content) шинэ оноог шууд авна — bestAttempt cache-ийг
      // invalidate хийж refetch → "✗ 50%" → "✓ 100%" real-time солигдоно.
      queryClient.invalidateQueries({ queryKey: ['lesson-quiz', productSlug, lessonId] });
      if (res.passed) toast.success(`Та тэнцлээ! Оноо: ${res.score}`);
      else toast.error(`Дахин оролдоно уу. Оноо: ${res.score}`);
    } catch {
      toast.error('Шалгалт илгээж чадсангүй');
    } finally {
      setSubmitting(false);
    }
  }, [quiz, token, submitting, allAnswered, answers, productSlug, lessonId, queryClient]);

  // ── Ачаалж байна ──
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Ачааллаж байна...
      </div>
    );
  }

  // ── Шалгалт байхгүй / нэвтрээгүй ──
  if (!quiz) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
        <ClipboardCheck className="h-7 w-7 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">
          {token ? 'Энэ хичээлд шалгалт алга.' : 'Шалгалт өгөхийн тулд нэвтэрнэ үү.'}
        </p>
      </div>
    );
  }

  // ── Үр дүн ──
  if (result) {
    const passed = result.passed;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className={
          'flex flex-col items-center gap-4 rounded-2xl border p-8 text-center ' +
          (passed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10')
        }
      >
        {passed ? (
          <CheckCircle2 className="h-14 w-14 text-emerald-400" />
        ) : (
          <XCircle className="h-14 w-14 text-red-400" />
        )}
        <div>
          <p className="text-xl font-bold text-foreground">{passed ? 'Та тэнцлээ! 🎉' : 'Дахин оролдоно уу'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Таны оноо: <span className="font-bold text-foreground">{result.score}</span> · Тэнцэх оноо:{' '}
            {quiz.passScore}
          </p>
        </div>
        {!passed && (
          <button
            type="button"
            onClick={retry}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" />
            Дахин өгөх
          </button>
        )}
        {passed && (
          <button
            type="button"
            onClick={retry}
            className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" />
            Дахин өгөх
          </button>
        )}
      </motion.div>
    );
  }

  // ── Эхлэхийн өмнөх дэлгэц ──
  if (!started) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 rounded-2xl border border-primary/30 bg-muted p-8 text-center"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <ClipboardCheck className="h-7 w-7 text-primary" />
        </span>
        <div>
          <p className="text-lg font-bold text-foreground">{quiz.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {quiz.questions.length} асуулт · Тэнцэх оноо: {quiz.passScore}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Шалгалт эхлүүлэх
        </button>
      </motion.div>
    );
  }

  // ── Асуултууд ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{quiz.title}</p>
        <span className="text-xs text-muted-foreground tabular-nums">
          {Object.keys(answers).length} / {quiz.questions.length} хариулсан
        </span>
      </div>

      <AnimatePresence initial={false}>
        {quiz.questions.map((q, qi) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <p className="mb-3 text-sm font-medium text-foreground">
              <span className="mr-1.5 text-primary">{qi + 1}.</span>
              {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const selected = answers[q.id] === oi;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => select(q.id, oi)}
                    className={
                      'flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ' +
                      (selected
                        ? 'border-primary bg-muted/70 text-foreground'
                        : 'border-border bg-background text-foreground/80 hover:bg-muted')
                    }
                  >
                    <span
                      className={
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ' +
                        (selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground')
                      }
                    >
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span className="min-w-0 flex-1">{opt}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <button
        type="button"
        onClick={submit}
        disabled={!allAnswered || submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Шалгалт илгээх
      </button>
    </div>
  );
}
