'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@digitalger/shared/ui';

// "Бүгд" сонголтын утга — практик дээр бүх мөрийг нэг хуудсанд багтаах том тоо
const ALL_PAGE_SIZE = 10000;

export function Pagination({
  page,
  total,
  pageSize,
  onPage,
  onPageSize,
  pageSizeOptions = [10, 20, 50, 100],
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize?: (size: number) => void;
  pageSizeOptions?: number[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Хуудаслалт хийх шаардлагатай эсэх
  const showPager = totalPages > 1;
  // pageSize сонгуулагч харагдах эсэх: onPageSize өгсөн ба нийт нь хамгийн бага сонголтоос их үед
  const minOption = pageSizeOptions.length ? Math.min(...pageSizeOptions) : 10;
  const showPageSize = !!onPageSize && total > minOption;

  // Юу ч харуулах шаардлагагүй бол null
  if (!showPager && !showPageSize) return null;

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // Одоогийн pageSize-ийн select утга ("all" эсвэл тоо)
  const sizeValue = pageSize >= ALL_PAGE_SIZE ? 'all' : String(pageSize);

  return (
    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {showPageSize && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground whitespace-nowrap">Хуудсанд:</span>
            <Select
              value={sizeValue}
              onValueChange={(v) => onPageSize!(v === 'all' ? ALL_PAGE_SIZE : Number(v))}
            >
              <SelectTrigger className="h-8 w-22">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
                <SelectItem value="all">Бүгд</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <p className="text-muted-foreground">
          Нийт <span className="font-medium text-foreground">{total}</span> — {start}–{end} харуулж байна
        </p>
      </div>

      {showPager && (
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
      )}
    </div>
  );
}
