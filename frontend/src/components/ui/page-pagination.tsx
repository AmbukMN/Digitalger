import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PagePaginationProps {
  page: number;
  total: number;
  pageSize: number;
  buildUrl: (page: number) => string;
  // Optional — өгвөл client-side navigation (router.replace) хийнэ. SSR full
  // navigation-ийн оронд instant. href нь SEO/shareable тул хадгална.
  onNavigate?: (page: number) => void;
}

export function PagePagination({ page, total, pageSize, buildUrl, onNavigate }: PagePaginationProps) {
  const handleClick = (p: number) =>
    onNavigate
      ? (e: React.MouseEvent) => {
          // Modifier (шинэ таб) бол default Link зан үлдээнэ
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          onNavigate(p);
        }
      : undefined;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between text-sm">
      <p className="text-muted-foreground">
        Нийт <span className="font-medium text-foreground">{total.toLocaleString()}</span> — {start}–{end}
      </p>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            href={buildUrl(page - 1)}
            onClick={handleClick(page - 1)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Өмнөх
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground cursor-not-allowed opacity-50">
            <ChevronLeft className="h-3.5 w-3.5" />
            Өмнөх
          </span>
        )}

        <div className="hidden sm:flex items-center gap-1 mx-1">
          {pages.map((p, i) =>
            p === '...' ? (
              <span key={`dots-${i}`} className="px-2 text-muted-foreground">…</span>
            ) : p === page ? (
              <span key={p} className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground w-8 h-8 text-sm font-semibold">
                {p}
              </span>
            ) : (
              <Link
                key={p}
                href={buildUrl(p)}
                onClick={handleClick(p)}
                className="inline-flex items-center justify-center rounded-md border border-border bg-background w-8 h-8 text-sm font-medium hover:bg-muted transition-colors"
              >
                {p}
              </Link>
            )
          )}
        </div>

        <span className="sm:hidden px-3 text-muted-foreground tabular-nums">
          {page} / {totalPages}
        </span>

        {page < totalPages ? (
          <Link
            href={buildUrl(page + 1)}
            onClick={handleClick(page + 1)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            Дараах
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground cursor-not-allowed opacity-50">
            Дараах
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}
