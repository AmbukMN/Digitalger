'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge, DataTable, ErrorState, Loading } from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';
import { Pagination } from '@/components/ui/pagination';
import type { AdminOrder } from '@/types/admin';

const PAGE_SIZE = 20;

type PaymentRow = {
  qpayId: string;
  orderId: string;
  amount: number | string;
  status: string;
  userEmail: string;
  userName: string | null;
  orderDate: string;
};

type StatusFilter = 'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Бүгд' },
  { value: 'SUCCESS', label: 'Амжилттай' },
  { value: 'PENDING', label: 'Хүлээгдэж байна' },
  { value: 'FAILED', label: 'Амжилтгүй' },
];

export default function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);

  // Reset page when status filter changes
  const handleStatusFilter = (v: StatusFilter) => { setStatusFilter(v); setPage(1); };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'orders', 'payments', page],
    queryFn: () => adminApi.orders.list({ page, pageSize: PAGE_SIZE }),
  });

  const allRows: PaymentRow[] =
    data?.items.flatMap((order: AdminOrder) =>
      (order.payments ?? []).map((p) => ({
        qpayId: p.id,
        orderId: order.id,
        amount: p.amount,
        status: p.status,
        userEmail: order.user.email,
        userName: order.user.name,
        orderDate: order.createdAt,
      })),
    ) ?? [];

  const rows =
    statusFilter === 'ALL'
      ? allRows
      : allRows.filter((r) => r.status === statusFilter);

  const counts: Record<string, number> = {};
  allRows.forEach((r) => {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  });

  const columns: ColumnDef<PaymentRow>[] = [
    {
      id: 'order',
      header: 'Захиалгын дугаар',
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-foreground">
            #{row.original.orderId.slice(-8).toUpperCase()}
          </span>
          <p className="text-[10px] text-muted-foreground font-mono">
            QPay: {row.original.qpayId.slice(-10).toUpperCase()}
          </p>
        </div>
      ),
    },
    {
      id: 'user',
      header: 'Хэрэглэгч',
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{row.original.userName ?? '—'}</p>
          <p className="text-xs text-muted-foreground truncate">{row.original.userEmail}</p>
        </div>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Дүн',
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums">
          {Number(row.original.amount).toLocaleString('mn-MN')} ₮
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Төлбөрийн төлөв',
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === 'SUCCESS'
              ? 'default'
              : row.original.status === 'FAILED'
                ? 'destructive'
                : 'outline'
          }
        >
          {row.original.status === 'SUCCESS'
            ? 'Амжилттай'
            : row.original.status === 'PENDING'
              ? 'Хүлээгдэж байна'
              : row.original.status === 'FAILED'
                ? 'Амжилтгүй'
                : row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'orderDate',
      header: 'Огноо',
      cell: ({ row }) =>
        new Date(row.original.orderDate).toLocaleDateString('mn-MN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
    },
  ];

  if (isLoading) return <Loading label="Төлбөрүүд..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Төлбөр</h1>
        <p className="text-sm text-muted-foreground">
          QPay гүйлгээний бүртгэл
        </p>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const count = f.value === 'ALL' ? allRows.length : (counts[f.value] ?? 0);
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => handleStatusFilter(f.value)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              {f.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  statusFilter === f.value
                    ? 'bg-background/20 text-primary-foreground'
                    : 'bg-background text-foreground'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <DataTable columns={columns} data={rows} />
      {/* Paginate by orders (each page has PAGE_SIZE orders → derive payments from them) */}
      <Pagination
        page={page}
        total={data?.total ?? 0}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />

      {/* Legend */}
      <p className="text-xs text-muted-foreground">
        <span className="font-medium">Захиалгын дугаар</span> — манай системийн дугаар.{' '}
        <span className="font-medium">QPay Ref</span> — QPay-ийн гүйлгээний дугаар (буцаалт болон тооцоо нягтлахад хэрэглэнэ).
      </p>
    </div>
  );
}
