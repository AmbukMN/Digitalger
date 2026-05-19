import Link from 'next/link';
import { Package } from 'lucide-react';
import { formatPrice } from '@digitalger/shared';
import { cn } from '@digitalger/shared';

interface ProductRowItemProps {
  thumbnail?: string | null;
  title: string;
  titleHref?: string;
  price?: number | null;
  compareAtPrice?: number | null;
  badge?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function ProductRowItem({
  thumbnail,
  title,
  titleHref,
  price,
  compareAtPrice,
  badge,
  meta,
  actions,
  className,
}: ProductRowItemProps) {
  const hasDiscount = compareAtPrice && price != null && compareAtPrice > price;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Thumbnail */}
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
            <Package className="h-5 w-5" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {badge && <div className="mb-0.5">{badge}</div>}

        {titleHref ? (
          <Link href={titleHref} className="text-sm font-medium hover:text-primary truncate block leading-snug">
            {title}
          </Link>
        ) : (
          <p className="text-sm font-medium truncate leading-snug">{title}</p>
        )}

        {price != null && (
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-sm font-bold text-primary">{formatPrice(price)}</span>
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(compareAtPrice!)}
              </span>
            )}
          </div>
        )}

        {meta && <div className="mt-0.5">{meta}</div>}
      </div>

      {/* Actions */}
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
