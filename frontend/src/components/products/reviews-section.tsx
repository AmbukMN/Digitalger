'use client';

import { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, LogIn, Pencil, Send, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Label } from '@digitalger/shared/ui';
import { cn } from '@digitalger/shared';
import { reviewsApi, ApiError } from '@/lib/api';
import type { ReviewItem, ReviewsPage } from '@/lib/api';
import { AuthModal } from '@/components/auth/auth-modal';

const PAGE_SIZE = 10;

// 1-9 хооронд санамсаргүй тоо (contact-form-той ижил math captcha)
function rand() {
  return Math.floor(Math.random() * 9) + 1;
}

// ─── Од эгнээ (зөвхөн харуулах) ──────────────────────────────────────────────
function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${cls} ${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
}

// ─── Од сонгох (hover/click) ─────────────────────────────────────────────────
function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onMouseEnter={() => setHover(s)}
          onClick={() => onChange(s)}
          aria-label={`${s} од`}
          className="rounded-md p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Star
            className={cn(
              'h-7 w-7 transition-colors',
              s <= active ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30',
            )}
          />
        </button>
      ))}
    </div>
  );
}

function RatingBar({ stars, count, total }: { stars: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-3 text-right text-muted-foreground">{stars}</span>
      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-yellow-400" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-5 text-muted-foreground">{count}</span>
    </div>
  );
}

// ─── Нэг сэтгэгдэл мөр ────────────────────────────────────────────────────────
function ReviewRow({
  review,
  isMine,
  onEdit,
  onDelete,
  deleting,
}: {
  review: ReviewItem;
  isMine: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const initial = (review.user.name ?? 'U').charAt(0).toUpperCase();
  const date = review.createdAt
    ? new Intl.DateTimeFormat('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' }).format(
        new Date(review.createdAt),
      )
    : null;

  return (
    <div
      className={cn(
        'flex gap-3 border-b border-border pb-4 last:border-0',
        isMine && 'rounded-xl border border-primary/30 bg-primary/4 p-4 last:border last:border-primary/30',
      )}
    >
      <div className="shrink-0">
        {review.user.image ? (
          <Image
            src={review.user.image}
            alt={review.user.name ?? 'User'}
            width={36}
            height={36}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {initial}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{review.user.name ?? 'Нэргүй'}</span>
          {isMine && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Таны үнэлгээ
            </span>
          )}
          {date && <span className="text-xs text-muted-foreground">{date}</span>}
        </div>
        <StarRow rating={review.rating} />
        {review.comment && (
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {review.comment}
          </p>
        )}
        {isMine && (onEdit || onDelete) && (
          <div className="mt-2 flex items-center gap-3">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Pencil className="h-3 w-3" />
                Засах
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Устгах
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Сэтгэгдэл үлдээх/засах форм ──────────────────────────────────────────────
function ReviewForm({
  token,
  slug,
  defaultName,
  existing,
  onDone,
  onCancel,
}: {
  token: string;
  slug: string;
  defaultName: string;
  existing: ReviewItem | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const isEdit = Boolean(existing);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [authorName, setAuthorName] = useState(existing?.user.name ?? defaultName ?? '');
  const [captcha, setCaptcha] = useState(() => ({ a: rand(), b: rand() }));
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const refreshCaptcha = useCallback(() => {
    setCaptcha({ a: rand(), b: rand() });
    setCaptchaAnswer('');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (rating < 1 || rating > 5) {
      toast.error('Од сонгож үнэлгээ өгнө үү');
      return;
    }
    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      toast.error('Сэтгэгдлээ бичнэ үү');
      return;
    }

    setLoading(true);
    try {
      if (isEdit && existing) {
        // Засах — captcha шаардлагагүй (өөрийн сэтгэгдэл)
        await reviewsApi.update(token, existing.id, { rating, comment: trimmedComment });
        toast.success('Үнэлгээ шинэчлэгдлээ');
      } else {
        // Шинээр — math captcha шалгана
        const answer = Number(captchaAnswer);
        if (!Number.isInteger(answer) || answer !== captcha.a + captcha.b) {
          toast.error('Баталгаажуулалтын тооцоо буруу байна');
          refreshCaptcha();
          setLoading(false);
          return;
        }
        await reviewsApi.create(token, slug, {
          rating,
          comment: trimmedComment,
          authorName: authorName.trim() || undefined,
          captchaA: captcha.a,
          captchaB: captcha.b,
          captchaAnswer: answer,
        });
        toast.success('Сэтгэгдэл амжилттай үлдээлээ! Баярлалаа 🎉');
      }
      onDone();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 429) {
        toast.error('Хэт олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу.');
      } else if (status === 409) {
        toast.error('Та энэ бүтээгдэхүүнд аль хэдийн сэтгэгдэл үлдээсэн байна.');
      } else if (status === 403) {
        toast.error('Сэтгэгдэл үлдээх боломжгүй байна.');
      } else {
        toast.error('Илгээхэд алдаа гарлаа, дахин оролдоно уу');
      }
      if (!isEdit) refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-muted/30 p-4 sm:p-5 space-y-4"
      noValidate
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{isEdit ? 'Үнэлгээгээ засах' : 'Сэтгэгдэл үлдээх'}</h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Болих"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Од сонгох */}
      <div className="space-y-1.5">
        <Label>
          Үнэлгээ <span className="text-destructive">*</span>
        </Label>
        <StarPicker value={rating} onChange={setRating} disabled={loading} />
      </div>

      {/* Нэр (зөвхөн шинээр үлдээхэд) */}
      {!isEdit && (
        <div className="space-y-1.5">
          <Label htmlFor="review-name">Харагдах нэр</Label>
          <Input
            id="review-name"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Таны нэр"
            disabled={loading}
            maxLength={60}
          />
        </div>
      )}

      {/* Сэтгэгдэл */}
      <div className="space-y-1.5">
        <Label htmlFor="review-comment">
          Сэтгэгдэл <span className="text-destructive">*</span>
        </Label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Бүтээгдэхүүний талаар санал бодлоо хуваалцаарай..."
          disabled={loading}
          rows={4}
          maxLength={1000}
          className={cn(
            'flex min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm',
            'transition-[colors,shadow,border-color] duration-150 ease-out',
            'placeholder:text-muted-foreground',
            'hover:border-border/80',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
      </div>

      {/* Math captcha — зөвхөн шинээр үлдээхэд */}
      {!isEdit && (
        <div className="space-y-1.5">
          <Label htmlFor="review-captcha">
            Баталгаажуулалт <span className="text-destructive">*</span>
          </Label>
          <div className="flex items-center gap-3">
            <span
              className="select-none rounded-lg border border-border bg-muted px-3 py-2 text-sm font-semibold text-foreground"
              aria-hidden="true"
            >
              {captcha.a} + {captcha.b} = ?
            </span>
            <Input
              id="review-captcha"
              type="text"
              inputMode="numeric"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Хариу"
              disabled={loading}
              aria-label={`${captcha.a} нэмэх ${captcha.b} хэдтэй тэнцэх вэ?`}
              className="w-28"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading} className="font-semibold">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Илгээж байна...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              {isEdit ? 'Хадгалах' : 'Илгээх'}
            </>
          )}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            Болих
          </Button>
        )}
      </div>
    </form>
  );
}

// ─── Үндсэн хэсэг ─────────────────────────────────────────────────────────────
export function ReviewsSection({
  slug,
  initialReviews,
  rating,
  ratingCount,
}: {
  slug: string;
  initialReviews: ReviewItem[];
  rating: number;
  ratingCount: number;
}) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [authOpen, setAuthOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Эхний хуудсыг server-ээс ирсэн initialReviews-аар урьдчилан дүүргэнэ (flash-гүй).
  const initialPageData = useMemo<ReviewsPage>(
    () => ({
      items: initialReviews,
      total: ratingCount,
      page: 1,
      pageSize: PAGE_SIZE,
    }),
    [initialReviews, ratingCount],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['reviews', slug, page],
    queryFn: () => reviewsApi.list(slug, page, PAGE_SIZE),
    placeholderData: (prev) => prev,
    initialData: page === 1 ? initialPageData : undefined,
    staleTime: 30_000,
  });

  // Өөрийн сэтгэгдэл (нэвтэрсэн бол)
  const { data: myReview } = useQuery({
    queryKey: ['reviews', slug, 'mine'],
    queryFn: () => reviewsApi.mine(token!, slug),
    enabled: !!token,
    staleTime: 30_000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? ratingCount;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Backend breakdown байвал тэрийг, эс бол одоогийн хуудаснаас тооцоолно (graceful).
  const counts = useMemo(() => {
    const bd = data?.breakdown;
    return [5, 4, 3, 2, 1].map((s) => ({
      stars: s,
      count: bd
        ? Number(bd[String(s)] ?? 0)
        : items.filter((r) => Math.round(r.rating) === s).length,
    }));
  }, [data?.breakdown, items]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['reviews', slug] });
  }, [queryClient, slug]);

  const handleDelete = useCallback(async () => {
    if (!token || !myReview) return;
    if (!window.confirm('Үнэлгээгээ устгах уу?')) return;
    setDeleting(true);
    try {
      await reviewsApi.remove(token, myReview.id);
      toast.success('Үнэлгээ устгагдлаа');
      setEditing(false);
      invalidate();
    } catch {
      toast.error('Устгахад алдаа гарлаа');
    } finally {
      setDeleting(false);
    }
  }, [token, myReview, invalidate]);

  const handleFormDone = useCallback(() => {
    setEditing(false);
    setPage(1);
    invalidate();
  }, [invalidate]);

  const isLoggedIn = !!token;
  const myName = session?.user?.name ?? '';

  return (
    <section>
      <h2 className="text-lg font-bold mb-5">Хэрэглэгчийн сэтгэгдэл</h2>

      {/* Хураангуй + 5★ breakdown chart */}
      <div className="flex gap-6 mb-6 p-5 rounded-xl border border-border bg-muted/30">
        <div className="text-center shrink-0">
          <p className="text-5xl font-extrabold leading-none">{rating.toFixed(1)}</p>
          <StarRow rating={Math.round(rating)} size="lg" />
          <p className="text-xs text-muted-foreground mt-1">{total} үнэлгээ</p>
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          {counts.map(({ stars, count }) => (
            <RatingBar key={stars} stars={stars} count={count} total={total} />
          ))}
        </div>
      </div>

      {/* Сэтгэгдэл үлдээх / нэвтрэх блок */}
      <div className="mb-6">
        {!isLoggedIn ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Сэтгэгдэл үлдээхийн тулд нэвтэрнэ үү.
            </p>
            <Button onClick={() => setAuthOpen(true)} className="font-semibold shrink-0">
              <LogIn className="h-4 w-4" />
              Нэвтрэх
            </Button>
          </div>
        ) : myReview && !editing ? (
          // Аль хэдийн үлдээсэн — өөрийн үнэлгээ + засах/устгах
          <ReviewRow
            review={myReview}
            isMine
            onEdit={() => setEditing(true)}
            onDelete={handleDelete}
            deleting={deleting}
          />
        ) : (
          // Шинээр үлдээх ЭСВЭЛ засах
          <ReviewForm
            token={token!}
            slug={slug}
            defaultName={myName}
            existing={editing ? myReview ?? null : null}
            onDone={handleFormDone}
            onCancel={editing ? () => setEditing(false) : undefined}
          />
        )}
      </div>

      {/* Жагсаалт */}
      <AnimatePresence mode="popLayout" initial={false}>
        {items.length === 0 && !isLoading ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-dashed border-border py-10 text-center"
          >
            <p className="text-sm text-muted-foreground">
              Одоогоор сэтгэгдэл алга. Эхний сэтгэгдэл үлдээгээрэй!
            </p>
          </motion.div>
        ) : (
          <motion.div key="list" className={cn('space-y-4', isFetching && 'opacity-60')}>
            {items.map((review) => (
              <ReviewRow
                key={review.id}
                review={review}
                isMine={!!myReview && myReview.id === review.id}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Өмнөх
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .map((p, idx, arr) => {
              const prev = arr[idx - 1];
              const gap = prev !== undefined && p - prev > 1;
              return (
                <span key={p} className="flex items-center gap-1.5">
                  {gap && <span className="px-1 text-muted-foreground">…</span>}
                  <Button
                    variant={p === page ? 'default' : 'outline'}
                    size="sm"
                    disabled={isFetching}
                    onClick={() => setPage(p)}
                    className="min-w-9"
                  >
                    {p}
                  </Button>
                </span>
              );
            })}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isFetching}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Дараах
          </Button>
        </div>
      )}

      {/* Нэвтрэх modal */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </section>
  );
}
