'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@besttv/shared';

/**
 * Хуудаслалт.
 *
 * ⚠️ Өмнө нь `Array.from({length: totalPages})`-ээр БҮХ хуудсыг товчлуур
 * болгож гаргадаг байсан — 200 хуудас болбол дэлгэц дүүрнэ. Одоо идэвхтэй
 * хуудсын эргэн тойрны цөөн товч + "…" харагдана.
 */
export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPage,
}: {
  page: number;
  totalPages: number;
  /** Нийт мөр — "1–20 / 340" гэж харуулна */
  total?: number;
  limit?: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  // Идэвхтэйн эргэн тойрон ±1, эхлэл/төгсгөл заавал
  const pages: (number | '…')[] = [];
  const push = (n: number | '…') => pages.push(n);
  const window = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  let last = 0;
  for (let i = 1; i <= totalPages; i++) {
    if (!window.has(i)) continue;
    if (last && i - last > 1) push('…');
    push(i);
    last = i;
  }

  const fromRow = total != null && limit ? (page - 1) * limit + 1 : null;
  const toRow = total != null && limit ? Math.min(page * limit, total) : null;

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      {fromRow != null && (
        <p className="text-xs text-muted-foreground">
          {fromRow.toLocaleString()}–{toRow?.toLocaleString()} / {total?.toLocaleString()}
        </p>
      )}

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Өмнөх хуудас"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              aria-current={page === p ? 'page' : undefined}
              className={cn(
                'h-8 min-w-8 rounded-lg px-2 text-sm font-medium transition-colors',
                page === p
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          aria-label="Дараагийн хуудас"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
