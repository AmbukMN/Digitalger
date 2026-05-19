'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { OrderStatus } from '@digitalger/shared';
import {
  Button,
  DataTable,
  ErrorState,
  Input,
  Loading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@digitalger/shared/ui';
import { Search, Tag } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { Pagination } from '@/components/ui/pagination';
import type { AdminOrder } from '@/types/admin';

const PAGE_SIZE = 20;

const STATUSES: { value: OrderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Бүгд' },
  { value: 'PENDING', label: 'Хүлээгдэж байна' },
  { value: 'PAID', label: 'Төлсөн' },
  { value: 'FAILED', label: 'Амжилтгүй' },
  { value: 'REFUNDED', label: 'Буцаасан' },
  { value: 'CANCELLED', label: 'Цуцалсан' },
];

const STATUS_VARIANTS: Record<OrderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PAID: 'default',
  PENDING: 'outline',
  FAILED: 'destructive',
  REFUNDED: 'secondary',
  CANCELLED: 'secondary',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PAID: 'Төлсөн',
  PENDING: 'Хүлээгдэж байна',
  FAILED: 'Амжилтгүй',
  REFUNDED: 'Буцаасан',
  CANCELLED: 'Цуцалсан',
};

function formatMoney(value: number | string) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('mn-MN').format(n) + ' ₮';
}

function OrderNumber({ id }: { id: string }) {
  const short = `#${id.slice(-8).toUpperCase()}`;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-foreground">
        {short}
      </span>
    </div>
  );
}

function OrderStatusSelect({ order }: { order: AdminOrder }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (status: string) => adminApi.orders.updateStatus(order.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast.success('Төлөв шинэчлэгдлээ');
    },
    onError: () => toast.error('Шинэчлэхэд алдаа'),
  });

  return (
    <Select
      value={order.status}
      onValueChange={(v) => mutation.mutate(v)}
      disabled={mutation.isPending}
    >
      <SelectTrigger className="h-8 w-44 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.filter((s) => s.value !== 'ALL').map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page when filter or search changes
  useEffect(() => { setPage(1); }, [statusFilter, search]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'orders', statusFilter, search, page],
    queryFn: () =>
      adminApi.orders.list({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const columns: ColumnDef<AdminOrder>[] = [
    {
      accessorKey: 'id',
      header: 'Захиалгын дугаар',
      cell: ({ row }) => <OrderNumber id={row.original.id} />,
    },
    {
      id: 'user',
      header: 'Хэрэглэгч',
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{row.original.user.name ?? '—'}</p>
          <p className="text-xs text-muted-foreground truncate">{row.original.user.email}</p>
        </div>
      ),
    },
    {
      id: 'items',
      header: 'Бүтээгдэхүүн',
      cell: ({ row }) => (
        <div className="max-w-52">
          {row.original.items.slice(0, 2).map((item) => (
            <p key={item.id} className="truncate text-xs text-muted-foreground">
              {item.product.title}
            </p>
          ))}
          {row.original.items.length > 2 && (
            <p className="text-xs text-muted-foreground">
              +{row.original.items.length - 2} дахин
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'total',
      header: 'Дүн',
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <span className="font-semibold tabular-nums">{formatMoney(row.original.total)}</span>
          {row.original.couponCode && (
            <div className="flex flex-wrap items-center gap-1 mt-0.5">
              {row.original.couponCode.split(',').map((code: string) => code.trim()).filter(Boolean).map((code: string) => (
                <span key={code} className="inline-flex items-center gap-0.5 rounded bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 text-[10px] font-mono font-bold text-green-700 dark:text-green-400">
                  <Tag className="h-2.5 w-2.5" />
                  {code}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'changeStatus',
      header: 'Төлөв',
      cell: ({ row }) => <OrderStatusSelect order={row.original} />,
    },
    {
      accessorKey: 'createdAt',
      header: 'Огноо',
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleDateString('mn-MN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
    },
  ];

  if (isLoading) return <Loading label="Захиалгууд..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Захиалга</h1>
          <p className="text-sm text-muted-foreground">Нийт {data?.total ?? 0} захиалга</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Захиалгын дугаар эсвэл и-мэйлээр хайх..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status filter */}
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as OrderStatus | 'ALL')}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(search || statusFilter !== 'ALL') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput('');
              setSearch('');
              setStatusFilter('ALL');
              setPage(1);
            }}
          >
            Цэвэрлэх
          </Button>
        )}
      </div>

      {/* Status quick-filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => {
          const count =
            s.value === 'ALL'
              ? data?.total ?? 0
              : (data?.items ?? []).filter((o) => o.status === s.value).length;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => { setStatusFilter(s.value as OrderStatus | 'ALL'); setPage(1); }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              {s.label}
              {s.value !== 'ALL' && (
                <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px] font-bold">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <DataTable columns={columns} data={data?.items ?? []} />
      <Pagination
        page={page}
        total={data?.total ?? 0}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />
    </div>
  );
}
