'use client';

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { Button } from './button';
import { Skeleton } from './skeleton';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  pageSize?: number;
  // Server-side pagination
  pageCount?: number;
  pageIndex?: number;
  onPageChange?: (page: number) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading,
  pageSize = 10,
  pageCount,
  pageIndex,
  onPageChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const isServerPaginated = onPageChange !== undefined;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    ...(isServerPaginated
      ? {
          manualPagination: true,
          pageCount: pageCount ?? -1,
          state: { sorting, pagination: { pageIndex: pageIndex ?? 0, pageSize } },
        }
      : {
          state: { sorting },
          initialState: { pagination: { pageSize } },
        }),
  });

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ⚠️ Responsive: mobile-д багана шахагдахгүй — overflow-x-auto-оор
          хэвтээ scroll (overflow-hidden байсныг сольсон). min-w-max нь table-г
          шахахгүй бүтэн өргөнөөр (утсан дэлгэцэд гүйлгэж харна). */}
      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="h-11 whitespace-nowrap px-4 text-left font-medium text-muted-foreground"
                    style={h.column.columnDef.size ? { width: h.column.columnDef.size, minWidth: h.column.columnDef.minSize, maxWidth: h.column.columnDef.maxSize } : undefined}
                  >
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-border transition-colors hover:bg-muted/30"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 align-middle"
                      style={cell.column.columnDef.size ? { width: cell.column.columnDef.size, minWidth: cell.column.columnDef.minSize, maxWidth: cell.column.columnDef.maxSize } : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Өгөгдөл байхгүй
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isServerPaginated) onPageChange!((pageIndex ?? 0) - 1);
              else table.previousPage();
            }}
            disabled={isServerPaginated ? (pageIndex ?? 0) === 0 : !table.getCanPreviousPage()}
          >
            Өмнөх
          </Button>
          <span className="text-sm text-muted-foreground">
            {(isServerPaginated ? (pageIndex ?? 0) : table.getState().pagination.pageIndex) + 1} / {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isServerPaginated) onPageChange!((pageIndex ?? 0) + 1);
              else table.nextPage();
            }}
            disabled={isServerPaginated
              ? (pageIndex ?? 0) >= (pageCount ?? 1) - 1
              : !table.getCanNextPage()}
          >
            Дараах
          </Button>
        </div>
      )}
    </div>
  );
}
