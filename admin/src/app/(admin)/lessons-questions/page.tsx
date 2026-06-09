'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Input,
  Loading,
} from '@digitalger/shared/ui';
import { cn } from '@digitalger/shared';
import {
  CheckCircle2,
  Download,
  FileText,
  GraduationCap,
  ImageIcon,
  MessagesSquare,
  Paperclip,
  Pin,
  PinOff,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { uploadWithProgress } from '@/lib/upload-with-progress';
import { Pagination } from '@/components/ui/pagination';
import type {
  AdminLessonAnswer,
  AdminLessonQuestion,
  AdminQaAttachment,
} from '@/types/admin';

const DEFAULT_PAGE_SIZE = 20;

// Зөвшөөрөгдөх хавсралтын төрөл (зураг / PDF / документ)
const ACCEPT =
  'image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip';
const MAX_BYTES = 100 * 1024 * 1024; // 100MB

// ─── Туслах функцууд ─────────────────────────────────────────────────────────
function isImage(mime?: string | null, name?: string | null) {
  if (mime?.startsWith('image/')) return true;
  if (name) return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(name);
  return false;
}

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${d.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}`;
}

function isAnswered(q: AdminLessonQuestion) {
  if (typeof q.answered === 'boolean') return q.answered;
  if (typeof q.answerCount === 'number') return q.answerCount > 0;
  return (q.answers?.length ?? 0) > 0;
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({
  name,
  email,
  image,
  size = 36,
  instructor,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: number;
  instructor?: boolean;
}) {
  const initial = (name ?? email ?? '?').charAt(0).toUpperCase();
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name ?? email ?? ''}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover ring-1 ring-border"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1',
        instructor
          ? 'bg-primary/15 text-primary ring-primary/25'
          : 'bg-muted text-muted-foreground ring-border',
      )}
      style={{ width: size, height: size }}
    >
      {initial}
    </div>
  );
}

// ─── Хавсралт preview ────────────────────────────────────────────────────────
function AttachmentPreview({ att }: { att: AdminQaAttachment }) {
  const url = att.url ?? undefined;
  const name = att.name ?? 'файл';
  if (!url) return null;

  if (isImage(att.mimeType, att.name)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative mt-2 block w-fit overflow-hidden rounded-lg border border-border"
        title={name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          className="max-h-56 max-w-[260px] object-cover transition-transform group-hover:scale-[1.02]"
          referrerPolicy="no-referrer"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download
      className="mt-2 flex w-fit max-w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
      title={name}
    >
      <FileText className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      {att.size ? (
        <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(att.size)}</span>
      ) : null}
      <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </a>
  );
}

// ─── Хариулт устгах баталгаажуулалт ──────────────────────────────────────────
function DeleteAnswerButton({ answerId }: { answerId: string }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: () => adminApi.products.questions.removeAnswer(answerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'lessons-questions'] });
      toast.success('Хариулт устгагдлаа');
    },
    onError: () => toast.error('Устгахад алдаа гарлаа'),
  });

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-muted-foreground/60 transition-colors hover:text-destructive"
        title="Хариулт устгах"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px]">
      <button
        type="button"
        className="font-semibold text-destructive hover:underline disabled:opacity-50"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        Устгах
      </button>
      <span className="text-muted-foreground">/</span>
      <button
        type="button"
        className="text-muted-foreground hover:underline"
        onClick={() => setConfirming(false)}
      >
        Болих
      </button>
    </span>
  );
}

// ─── Нэг хариултын bubble ────────────────────────────────────────────────────
function AnswerBubble({ answer }: { answer: AdminLessonAnswer }) {
  const isInstructor = answer.isInstructor;
  return (
    <div className={cn('flex gap-3', isInstructor && 'flex-row-reverse')}>
      <Avatar
        name={answer.user?.name}
        email={answer.user?.email}
        image={answer.user?.image}
        size={32}
        instructor={isInstructor}
      />
      <div className={cn('group min-w-0 max-w-[78%]', isInstructor && 'items-end text-right')}>
        <div className={cn('mb-1 flex items-center gap-2', isInstructor && 'flex-row-reverse')}>
          <span className="text-xs font-semibold text-foreground">
            {answer.user?.name ?? answer.user?.email ?? 'Хэрэглэгч'}
          </span>
          {isInstructor && (
            <Badge variant="purple" className="h-4 px-1.5 py-0 text-[10px]">
              <GraduationCap className="mr-0.5 h-2.5 w-2.5" />Багш
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">{formatDateTime(answer.createdAt)}</span>
        </div>
        <div
          className={cn(
            'inline-block rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
            isInstructor
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm bg-muted text-foreground',
          )}
        >
          <p className="whitespace-pre-wrap break-words text-left">{answer.answer}</p>
        </div>
        {answer.attachment && (
          <div className={cn(isInstructor && 'flex justify-end')}>
            <AttachmentPreview att={answer.attachment} />
          </div>
        )}
        <div className={cn('mt-1 opacity-0 transition-opacity group-hover:opacity-100', isInstructor ? 'text-left' : 'text-right')}>
          <DeleteAnswerButton answerId={answer.id} />
        </div>
      </div>
    </div>
  );
}

// ─── Conversation modal (асуулт + thread) ────────────────────────────────────
function ConversationDialog({
  question,
  open,
  onClose,
}: {
  question: AdminLessonQuestion;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const answers = question.answers ?? [];

  useEffect(() => {
    // Шинэ хариулт нэмэгдэх үед доош гүйлгэнэ
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [answers.length]);

  const previewUrl = useMemo(
    () => (file && isImage(file.type, file.name) ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ''; // дахин ижил файл сонгох боломжтой
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.error('Файл 100MB-аас их байна');
      return;
    }
    setFile(f);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      let attachment:
        | { key: string; url: string; fileName: string; mimeType?: string; sizeBytes?: number }
        | undefined;
      if (file) {
        setUploading(true);
        try {
          const up = await uploadWithProgress(file, 'qa');
          attachment = {
            key: up.key,
            url: up.url,
            fileName: up.fileName,
            mimeType: up.mimeType,
            sizeBytes: up.size,
          };
        } finally {
          setUploading(false);
        }
      }
      return adminApi.products.questions.answer(question.id, text.trim(), attachment);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'lessons-questions'] });
      setText('');
      setFile(null);
      toast.success('Хариулт илгээгдлээ');
    },
    onError: () => toast.error('Хариулахад алдаа гарлаа'),
  });

  const canSubmit = (text.trim().length > 0 || !!file) && !mutation.isPending && !uploading;

  function submit() {
    if (!canSubmit) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-3.5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessagesSquare className="h-4 w-4 text-primary" />
            Асуултын яриа
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1.5 text-xs">
            {question.lesson?.product?.title && (
              <Badge variant="info" className="h-5 px-1.5 py-0 text-[11px]">
                {question.lesson.product.title}
              </Badge>
            )}
            {question.lesson?.title && (
              <span className="text-muted-foreground">• {question.lesson.title}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Thread */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Эх асуулт */}
          <div className="flex gap-3">
            <Avatar
              name={question.user?.name}
              email={question.user?.email}
              image={question.user?.image}
              size={36}
            />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {question.user?.name ?? question.user?.email ?? 'Хэрэглэгч'}
                </span>
                {question.user?.email && question.user?.name && (
                  <span className="truncate text-xs text-muted-foreground">{question.user.email}</span>
                )}
                <span className="text-[10px] text-muted-foreground">{formatDateTime(question.createdAt)}</span>
              </div>
              <div className="inline-block rounded-2xl rounded-tl-sm border border-border bg-card px-3.5 py-2 text-sm leading-relaxed">
                <p className="whitespace-pre-wrap break-words">{question.question}</p>
              </div>
              {question.attachment && <AttachmentPreview att={question.attachment} />}
            </div>
          </div>

          {/* Хариултууд */}
          {answers.length > 0 ? (
            answers.map((a) => <AnswerBubble key={a.id} answer={a} />)
          ) : (
            <div className="flex flex-col items-center gap-1 py-6 text-center text-sm text-muted-foreground">
              <MessagesSquare className="h-7 w-7 opacity-40" />
              Хараахан хариулаагүй байна
            </div>
          )}
          <div ref={threadEndRef} />
        </div>

        {/* Хариулах хэсэг */}
        <div className="border-t border-border bg-muted/30 px-4 py-3">
          {/* Сонгосон файлын preview */}
          <AnimatePresence>
            {file && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-2 overflow-hidden"
              >
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt={file.name} className="h-10 w-10 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    title="Хасах"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={handlePickFile}
            />
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={mutation.isPending || uploading}
              title="Зураг / файл хавсаргах (≤100MB)"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Багшийн хариулт бичих... (Ctrl+Enter илгээх)"
              className="max-h-32 min-h-10 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={submit}
              disabled={!canSubmit}
              title="Хариулах"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {uploading && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">Файл байршуулж байна...</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Нэг асуултын мөр (list) ────────────────────────────────────────────────
function QuestionRow({ question }: { question: AdminLessonQuestion }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const answered = isAnswered(question);
  const hasAttachment = !!question.attachment?.url;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'lessons-questions'] });

  const pinMutation = useMutation({
    mutationFn: () => adminApi.products.questions.pin(question.id, !question.isPinned),
    onSuccess: () => {
      invalidate();
      toast.success(question.isPinned ? 'Онцлох болиулав' : 'Асуулт онцлогдлоо');
    },
    onError: () => toast.error('Үйлдэл амжилтгүй'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminApi.products.questions.remove(question.id),
    onSuccess: () => {
      invalidate();
      toast.success('Асуулт устгагдлаа');
    },
    onError: () => toast.error('Устгахад алдаа гарлаа'),
  });

  return (
    <>
      <div
        className={cn(
          'group flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40 hover:bg-muted/40',
          question.isPinned && 'ring-1 ring-secondary/40',
        )}
        onClick={() => setOpen(true)}
      >
        <Avatar
          name={question.user?.name}
          email={question.user?.email}
          image={question.user?.image}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-foreground">
              {question.user?.name ?? question.user?.email ?? 'Хэрэглэгч'}
            </span>
            {question.user?.email && (
              <span className="truncate text-xs text-muted-foreground">{question.user.email}</span>
            )}
            {question.isPinned && (
              <Badge variant="warning" className="h-4 px-1.5 py-0 text-[10px]">
                <Pin className="mr-0.5 h-2.5 w-2.5" />Онцолсон
              </Badge>
            )}
          </div>

          <p className="mt-1 line-clamp-2 text-sm text-foreground/90" style={{ overflowWrap: 'anywhere' }}>
            {question.question}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {question.lesson?.product?.title && (
              <Badge variant="info" className="h-5 px-1.5 py-0 text-[11px]">
                {question.lesson.product.title}
              </Badge>
            )}
            {question.lesson?.title && (
              <span className="truncate text-xs text-muted-foreground">• {question.lesson.title}</span>
            )}
            {hasAttachment && (
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground" title="Хавсралттай">
                {isImage(question.attachment?.mimeType, question.attachment?.name) ? (
                  <ImageIcon className="h-3.5 w-3.5" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5" />
                )}
              </span>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {formatDateTime(question.createdAt)}
            </span>
          </div>
        </div>

        {/* Status + actions */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {answered ? (
            <Badge variant="success" className="h-5 gap-0.5 px-1.5 py-0 text-[11px]">
              <CheckCircle2 className="h-3 w-3" />Хариулсан
            </Badge>
          ) : (
            <Badge variant="destructive" className="h-5 px-1.5 py-0 text-[11px]">
              Хариулаагүй
            </Badge>
          )}

          <div
            className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-secondary-foreground"
              disabled={pinMutation.isPending}
              onClick={() => pinMutation.mutate()}
              title={question.isPinned ? 'Онцлохыг болих' : 'Онцлох'}
            >
              {question.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </Button>
            {confirmDelete ? (
              <span className="flex items-center gap-1 pr-1 text-[11px]">
                <button
                  type="button"
                  className="font-semibold text-destructive hover:underline disabled:opacity-50"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                >
                  Устгах
                </button>
                <button type="button" className="text-muted-foreground hover:underline" onClick={() => setConfirmDelete(false)}>
                  Болих
                </button>
              </span>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive/60 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                title="Асуулт устгах"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {open && <ConversationDialog question={question} open={open} onClose={() => setOpen(false)} />}
    </>
  );
}

// ─── Хуудас ──────────────────────────────────────────────────────────────────
export default function LessonsQuestionsPage() {
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [onlyUnanswered]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'lessons-questions', onlyUnanswered, page, pageSize],
    queryFn: () => adminApi.products.questions.list({ page, pageSize, onlyUnanswered }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const allItems = data?.items ?? [];

  // Хайлт — frontend талд (хэрэглэгч нэр/email/асуулт/хичээл/бүтээгдэхүүн)
  const items = useMemo(() => {
    if (!search) return allItems;
    return allItems.filter((q) => {
      const hay = [
        q.question,
        q.user?.name,
        q.user?.email,
        q.lesson?.title,
        q.lesson?.product?.title,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(search);
    });
  }, [allItems, search]);

  const unansweredCount = allItems.filter((q) => !isAnswered(q)).length;

  if (isLoading) return <Loading label="Асуултууд..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <MessagesSquare className="h-6 w-6 text-primary" />
            Суралцагчийн асуулт
          </h1>
          <p className="text-sm text-muted-foreground">
            Нийт {data?.total ?? 0} асуулт
            {unansweredCount > 0 && (
              <span className="ml-1.5 font-medium text-red-600 dark:text-red-400">
                • {unansweredCount} хариулаагүй
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Хэрэглэгч, асуулт, хичээлээр хайх..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={onlyUnanswered ? 'outline' : 'default'}
            size="sm"
            onClick={() => setOnlyUnanswered(false)}
          >
            Бүгд
          </Button>
          <Button
            variant={onlyUnanswered ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnlyUnanswered(true)}
          >
            Хариулаагүй
          </Button>
        </div>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <MessagesSquare className="h-9 w-9 opacity-40" />
          <p className="text-sm">{search ? 'Хайлтад тохирох асуулт алга' : 'Асуулт байхгүй байна'}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((q) => (
            <QuestionRow key={q.id} question={q} />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        total={data?.total ?? 0}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}
