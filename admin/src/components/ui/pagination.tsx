'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@digitalger/shared/ui';

export function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <p className="text-muted-foreground">
        Нийт <span className="font-medium text-foreground">{total}</span> — {start}–{end} харуулж байна
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Өмнөх
        </Button>
        <span className="px-3 text-muted-foreground tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Дараах
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
