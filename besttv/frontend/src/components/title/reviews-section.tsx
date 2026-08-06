'use client';

import { useEffect, useState } from 'react';
import {
  ChevronDown,
  CornerDownRight,
  EyeOff,
  Flag,
  Loader2,
  MessageSquare,
  Shield,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { useAuth } from '@/lib/auth-store';
import {
  useDeleteReview,
  useMyReview,
  useReplyReview,
  useReportReview,
  useReviewStats,
  useReviews,
  useSubmitReview,
  useVoteReview,
  type Review,
  type ReviewSort,
} from '@/lib/queries';
import { loginUrl } from '@/lib/auth-intent';

const SORT_LABELS: { value: ReviewSort; label: string }[] = [
  { value: 'helpful', label: 'Хамгийн хэрэгтэй' },
  { value: 'newest', label: 'Шинэ' },
  { value: 'oldest', label: 'Хуучин' },
  { value: 'highest', label: 'Өндөр үнэлгээ' },
  { value: 'lowest', label: 'Бага үнэлгээ' },
];

const REPORT_REASONS = [
  { value: 'spam', label: 'Спам / зар сурталчилгаа' },
  { value: 'offensive', label: 'Доромжилсон агуулга' },
  { value: 'spoiler', label: 'Спойлер (тэмдэглээгүй)' },
  { value: 'other', label: 'Бусад' },
];

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'Дөнгөж сая';
  if (min < 60) return `${min} мин өмнө`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} цаг өмнө`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} хоногийн өмнө`;
  return new Date(iso).toLocaleDateString('mn-MN');
}

export function ReviewsSection({
  titleId,
  reviewStats,
}: {
  titleId: string;
  reviewStats: { average: number | null; count: number };
}) {
  const { user } = useAuth();
  const [sort, setSort] = useState<ReviewSort>('helpful');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useReviews(titleId, page, sort);
  const { data: stats } = useReviewStats(titleId);
  const { data: myReview } = useMyReview(titleId, !!user);

  const submit = useSubmitReview(titleId);
  const vote = useVoteReview(titleId);
  const reply = useReplyReview(titleId);
  const report = useReportReview();
  const del = useDeleteReview(titleId);
  const confirm = useConfirm();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hasSpoiler, setHasSpoiler] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  // ⚠️ myReview нь async ирдэг тул useState-ийн эхний утга хоцордог —
  // ирмэгц формыг дүүргэнэ (өмнө нь засвар нь хоосон гарч байсан)
  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setComment(myReview.comment);
      setHasSpoiler(myReview.hasSpoiler);
    }
  }, [myReview]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      toast.error('Одоор үнэлгээ өгнө үү');
      return;
    }
    try {
      await submit.mutateAsync({ rating, comment, hasSpoiler });
      toast.success(myReview ? 'Үнэлгээ шинэчлэгдлээ' : 'Үнэлгээ бүртгэгдлээ');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Хадгалж чадсангүй');
    }
  };

  // ── Сэтгэгдэл/хариу аль ч түвшинд ажиллах нийтлэг үйлдлүүд ──
  const voteById = (reviewId: string, value: 1 | -1) => {
    if (!user) {
      toast.error('Санал өгөхийн тулд нэвтэрнэ үү');
      return;
    }
    vote.mutate(
      { reviewId, value },
      { onError: (e) => toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа') },
    );
  };

  const reportById = async (reviewId: string, reason: string) => {
    try {
      const res = await report.mutateAsync({ reviewId, reason });
      toast.success(res.already ? 'Та аль хэдийн мэдээлсэн байна' : 'Мэдээлэл хүлээн авлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Мэдээлж чадсангүй');
    }
  };

  const deleteById = async (reviewId: string) => {
    const ok = await confirm({
      title: 'Устгах уу?',
      description: 'Энэ сэтгэгдэл бүрмөсөн устана.',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await del.mutateAsync(reviewId);
      toast.success('Устгагдлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Устгаж чадсангүй');
    }
  };

  const onDeleteMine = async () => {
    if (!myReview) return;
    const ok = await confirm({
      title: 'Сэтгэгдлээ устгах уу?',
      description: 'Таны үнэлгээ болон сэтгэгдэл бүрмөсөн устана.',
      bullets: ['Хариунууд ч хамт устана', 'Дахин бичих боломжтой'],
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await del.mutateAsync(myReview.id);
      setRating(0);
      setComment('');
      setHasSpoiler(false);
      toast.success('Сэтгэгдэл устгагдлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Устгаж чадсангүй');
    }
  };

  const total = stats?.count ?? reviewStats.count;
  const average = stats?.average ?? reviewStats.average;
  const maxBar = Math.max(1, ...Object.values(stats?.distribution ?? {}));

  return (
    <section aria-labelledby="reviews-heading" className="mt-10">
      <h2 id="reviews-heading" className="mb-4 text-lg font-semibold text-foreground/95">
        Сэтгэгдэл ба үнэлгээ
      </h2>

      {/* ── Үнэлгээний тойм ── */}
      {total > 0 && (
        <div className="mb-6 flex flex-col gap-5 rounded-xl border border-foreground/10 bg-foreground/5 p-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 flex-col items-center gap-1 sm:w-32">
            <p className="text-4xl font-black text-foreground">{average?.toFixed(1)}</p>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={13}
                  className={
                    (average ?? 0) / 2 > i ? 'fill-premium text-premium' : 'text-foreground/20'
                  }
                />
              ))}
            </div>
            <p className="text-xs text-foreground/45">{total} үнэлгээ</p>
          </div>

          {/* Одны тархалт */}
          {stats && (
            <div className="flex-1 space-y-1">
              {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => {
                const count = stats.distribution[n] ?? 0;
                if (n < 6 && count === 0) return null; // бага үнэлгээ хоосон бол нуух
                return (
                  <div key={n} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-right text-[11px] text-foreground/45">{n}</span>
                    <Star size={9} className="shrink-0 fill-premium text-premium" />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/8">
                      <div
                        className="h-full rounded-full bg-premium transition-all"
                        style={{ width: `${(count / maxBar) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-[11px] text-foreground/45">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Сэтгэгдэл бичих ── */}
      {user ? (
        <form onSubmit={onSubmit} className="mb-6 rounded-xl border border-foreground/10 bg-foreground/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground/80">
              {myReview ? 'Таны үнэлгээ' : 'Үнэлгээ өгөх'}
            </p>
            {myReview && (
              <button
                type="button"
                onClick={onDeleteMine}
                disabled={del.isPending}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/45 transition-colors hover:bg-destructive/15 hover:text-destructive disabled:opacity-40"
              >
                {del.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Устгах
              </button>
            )}
          </div>

          <div
            className="mt-2 flex gap-0.5"
            role="radiogroup"
            aria-label="Одны үнэлгээ 1-10"
            onMouseLeave={() => setHoverRating(0)}
          >
            {Array.from({ length: 10 }).map((_, i) => {
              const value = i + 1;
              const filled = (hoverRating || rating) >= value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} од`}
                  onMouseEnter={() => setHoverRating(value)}
                  onClick={() => setRating(value)}
                  className="rounded p-0.5 transition-transform hover:scale-110"
                >
                  <Star
                    size={22}
                    className={cn(
                      'transition-colors',
                      filled ? 'fill-premium text-premium' : 'text-foreground/20',
                    )}
                  />
                </button>
              );
            })}
            {(hoverRating || rating) > 0 && (
              <span className="ml-2 self-center text-sm font-bold text-premium">
                {hoverRating || rating}/10
              </span>
            )}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Энэ киноны талаар юу бодож байна? (заавал биш)"
            aria-label="Сэтгэгдэл"
            rows={3}
            maxLength={3000}
            className="mt-3 w-full resize-none rounded-lg border border-foreground/12 bg-black/40 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/35 focus:border-primary"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground/55">
              <input
                type="checkbox"
                checked={hasSpoiler}
                onChange={(e) => setHasSpoiler(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-foreground/20"
              />
              <EyeOff size={12} /> Спойлер агуулсан
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-foreground/30">{comment.length}/3000</span>
              <button
                type="submit"
                disabled={submit.isPending || rating < 1}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {submit.isPending && <Loader2 size={14} className="animate-spin" />}
                {myReview ? 'Шинэчлэх' : 'Илгээх'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-6 rounded-xl border border-foreground/10 bg-foreground/5 p-4 text-center">
          <p className="text-sm text-foreground/55">
            Сэтгэгдэл бичихийн тулд{' '}
            <a href={loginUrl()} className="font-semibold text-primary hover:underline">
              нэвтэрнэ үү
            </a>
          </p>
        </div>
      )}

      {/* ── Эрэмбэлэлт ── */}
      {total > 0 && (
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
          {SORT_LABELS.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                setSort(s.value);
                setPage(1);
              }}
              aria-pressed={sort === s.value}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                sort === s.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-foreground/5 text-foreground/55 hover:bg-foreground/10 hover:text-foreground',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Жагсаалт ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-foreground/5" />
          ))}
        </div>
      ) : data?.items.length ? (
        <div className="space-y-3">
          {data.items.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              currentUserId={user?.id}
              isLoggedIn={!!user}
              onVote={(value) => voteById(r.id, value)}
              onVoteById={voteById}
              onReply={async (text) => {
                try {
                  await reply.mutateAsync({ reviewId: r.id, comment: text });
                  toast.success('Хариу бичигдлээ');
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Илгээж чадсангүй');
                  throw e; // ReviewCard textarea-г цэвэрлэхгүй
                }
              }}
              onReport={(reason) => reportById(r.id, reason)}
              onReportById={reportById}
              onDelete={deleteById}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-foreground/12 py-10 text-center">
          <MessageSquare size={24} className="mx-auto mb-2 text-foreground/20" />
          <p className="text-sm text-foreground/40">Одоогоор сэтгэгдэл байхгүй байна.</p>
          <p className="mt-0.5 text-xs text-foreground/25">Хамгийн түрүүнд бичээрэй!</p>
        </div>
      )}

      {/* ── Хуудаслалт ── */}
      {data && data.totalPages > 1 && (
        <div className="mt-5 flex justify-center gap-1.5">
          {Array.from({ length: data.totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={cn(
                'h-8 w-8 rounded-lg text-sm font-medium transition-colors',
                page === i + 1 ? 'bg-primary text-primary-foreground' : 'text-foreground/45 hover:bg-foreground/10',
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewCard({
  review: r,
  currentUserId,
  isLoggedIn,
  onVote,
  onReply,
  onReport,
  onDelete,
  onVoteById,
  onReportById,
  isReply = false,
}: {
  review: Review;
  currentUserId?: string;
  isLoggedIn: boolean;
  onVote: (value: 1 | -1) => void;
  onReply: (text: string) => Promise<void>;
  onReport: (reason: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Хариунд өөрийнх нь id-гаар дуудахад ашиглана */
  onVoteById: (reviewId: string, value: 1 | -1) => void;
  onReportById: (reviewId: string, reason: string) => Promise<void>;
  isReply?: boolean;
}) {
  const [spoilerShown, setSpoilerShown] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(false);

  const isMine = currentUserId === r.userId;
  const initial = (r.user?.name?.[0] ?? 'Х').toUpperCase();

  const submitReply = async () => {
    const t = replyText.trim();
    if (!t) return;
    setReplySending(true);
    try {
      await onReply(t);
      setReplyText('');
      setReplyOpen(false);
      setRepliesOpen(true);
    } catch {
      // Алдааны toast-ыг эцэг компонент харуулсан — бичсэн текстийг ҮЛДЭЭНЭ
    } finally {
      setReplySending(false);
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        r.isStaff
          ? 'border-primary/30 bg-primary/8'
          : isReply
            ? 'border-foreground/8 bg-white/[0.03]'
            : 'border-foreground/10 bg-foreground/5',
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            r.isStaff ? 'bg-primary text-primary-foreground' : 'bg-foreground/10 text-foreground/70',
          )}
        >
          {r.isStaff ? <Shield size={14} /> : initial}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold text-foreground/90">
              {r.isStaff ? 'BestTV баг' : (r.user?.name ?? 'Хэрэглэгч')}
            </p>
            {isMine && (
              <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] text-foreground/50">Та</span>
            )}
            {!isReply && r.rating > 0 && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-premium">
                <Star size={11} className="fill-premium" /> {r.rating}
              </span>
            )}
            <span className="text-[11px] text-foreground/35">{timeAgo(r.createdAt)}</span>
          </div>

          {/* Сэтгэгдлийн текст — спойлер бол бүрхэнэ */}
          {r.comment &&
            (r.hasSpoiler && !spoilerShown ? (
              <button
                onClick={() => setSpoilerShown(true)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-premium/25 bg-premium/8 px-3 py-3 text-xs font-medium text-premium transition-colors hover:bg-premium/15"
              >
                <EyeOff size={13} /> Спойлер агуулсан — харахын тулд дарна уу
              </button>
            ) : (
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/70">
                {r.comment}
              </p>
            ))}

          {/* Үйлдлүүд */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1">
            <button
              onClick={() => onVote(1)}
              aria-label="Хэрэгтэй"
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                r.myVote === 1
                  ? 'bg-success/15 text-success'
                  : 'text-foreground/45 hover:bg-foreground/8 hover:text-foreground/70',
              )}
            >
              <ThumbsUp size={12} /> {r.helpful > 0 ? r.helpful : ''}
            </button>
            <button
              onClick={() => onVote(-1)}
              aria-label="Хэрэггүй"
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                r.myVote === -1
                  ? 'bg-destructive/15 text-destructive'
                  : 'text-foreground/45 hover:bg-foreground/8 hover:text-foreground/70',
              )}
            >
              <ThumbsDown size={12} /> {r.notHelpful > 0 ? r.notHelpful : ''}
            </button>

            {!isReply && isLoggedIn && (
              <button
                onClick={() => setReplyOpen((v) => !v)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/45 transition-colors hover:bg-foreground/8 hover:text-foreground/70"
              >
                <CornerDownRight size={12} /> Хариулах
              </button>
            )}

            {isMine ? (
              <button
                onClick={() => onDelete(r.id)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/45 transition-colors hover:bg-destructive/15 hover:text-destructive"
              >
                <Trash2 size={12} /> Устгах
              </button>
            ) : isLoggedIn ? (
              <button
                onClick={() => setReportOpen((v) => !v)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/35 transition-colors hover:bg-foreground/8 hover:text-foreground/60"
              >
                <Flag size={12} /> Мэдээлэх
              </button>
            ) : null}
          </div>

          {/* Мэдээлэх шалтгаан */}
          {reportOpen && (
            <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-foreground/10 bg-black/30 p-2">
              {REPORT_REASONS.map((rr) => (
                <button
                  key={rr.value}
                  onClick={async () => {
                    setReportOpen(false);
                    await onReport(rr.value);
                  }}
                  className="rounded-md bg-foreground/5 px-2.5 py-1 text-[11px] text-foreground/60 transition-colors hover:bg-destructive/20 hover:text-destructive"
                >
                  {rr.label}
                </button>
              ))}
            </div>
          )}

          {/* Хариу бичих */}
          {replyOpen && (
            <div className="mt-2 flex items-end gap-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitReply();
                  }
                }}
                autoFocus
                rows={2}
                placeholder="Хариу бичих..."
                aria-label="Хариу"
                maxLength={3000}
                className="flex-1 resize-none rounded-lg border border-foreground/12 bg-black/40 px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground/30 focus:border-primary"
              />
              <button
                onClick={submitReply}
                disabled={!replyText.trim() || replySending}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
              >
                {replySending ? <Loader2 size={13} className="animate-spin" /> : 'Илгээх'}
              </button>
            </div>
          )}

          {/* Хариунууд */}
          {!isReply && r.replies && r.replies.length > 0 && (
            <div className="mt-2.5">
              <button
                onClick={() => setRepliesOpen((v) => !v)}
                aria-expanded={repliesOpen}
                className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:brightness-125"
              >
                <ChevronDown
                  size={13}
                  className={cn('transition-transform', repliesOpen && 'rotate-180')}
                />
                {r.replies.length} хариу
              </button>
              {repliesOpen && (
                <div className="mt-2 space-y-2 border-l-2 border-foreground/8 pl-3">
                  {/* ⚠️ onVote/onReport нь эх сэтгэгдлийн id-д бэхлэгдсэн тул
                      хариунд ЗААВАЛ өөрийнх нь id-гаар дахин холбоно */}
                  {r.replies.map((rep) => (
                    <ReviewCard
                      key={rep.id}
                      review={rep}
                      currentUserId={currentUserId}
                      isLoggedIn={isLoggedIn}
                      onVote={(v) => onVoteById(rep.id, v)}
                      onReply={onReply}
                      onReport={(reason) => onReportById(rep.id, reason)}
                      onDelete={onDelete}
                      onVoteById={onVoteById}
                      onReportById={onReportById}
                      isReply
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
