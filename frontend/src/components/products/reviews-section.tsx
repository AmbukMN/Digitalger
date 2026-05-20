import Image from 'next/image';
import { Star } from 'lucide-react';
import type { ProductDetail } from '@/types/api';

type Review = NonNullable<ProductDetail['reviews']>[number];

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

export function ReviewsSection({
  reviews,
  rating,
  ratingCount,
}: {
  reviews: Review[];
  rating: number;
  ratingCount: number;
}) {
  const counts = [5, 4, 3, 2, 1].map((s) => ({
    stars: s,
    count: reviews.filter((r) => Math.round(r.rating) === s).length,
  }));

  return (
    <section>
      <h2 className="text-lg font-bold mb-5">Хэрэглэгчийн сэтгэгдэл</h2>

      {/* Summary */}
      <div className="flex gap-6 mb-6 p-5 rounded-xl border border-border bg-muted/30">
        <div className="text-center shrink-0">
          <p className="text-5xl font-extrabold leading-none">{rating.toFixed(1)}</p>
          <StarRow rating={Math.round(rating)} size="lg" />
          <p className="text-xs text-muted-foreground mt-1">{ratingCount} үнэлгээ</p>
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          {counts.map(({ stars, count }) => (
            <RatingBar key={stars} stars={stars} count={count} total={ratingCount} />
          ))}
        </div>
      </div>

      {/* Individual reviews */}
      <div className="space-y-4">
        {reviews.map((review) => {
          const initial = (review.user.name ?? 'U').charAt(0).toUpperCase();
          const date = review.createdAt
            ? new Intl.DateTimeFormat('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' }).format(
                new Date(review.createdAt),
              )
            : null;

          return (
            <div key={review.id} className="flex gap-3 border-b border-border pb-4 last:border-0">
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
                  {date && <span className="text-xs text-muted-foreground">{date}</span>}
                </div>
                <StarRow rating={review.rating} />
                {review.comment && (
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    {review.comment}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
