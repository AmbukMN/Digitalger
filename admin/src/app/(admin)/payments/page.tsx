'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Label,
  Loading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@digitalger/shared/ui';
import { Pencil, Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { Pagination } from '@/components/ui/pagination';
import type { AdminOrder } from '@/types/admin';

const PAGE_SIZE = 20;

type PaymentRow = {
  id: string;
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

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  SUCCESS: 'Амжилттай',
  PENDING: 'Хүлээгдэж байна',
  FAILED: 'Амжилтгүй',
};

// ── Edit Payment Dialog ───────────────────────────────────────────────────────
function EditPaymentDialog({
  payment,
  open,
  onClose,
}: {
  payment: PaymentRow;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(payment.status);

  const mutation = useMutation({
    mutationFn: () => adminApi.orders.updatePayment(payment.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders', 'payments'] });
      toast.success('Төлбөрийн төлөв шинэчлэгдлээ');
      onClose();
    },
    onError: () => toast.error('Шинэчлэхэд алдаа гарлаа'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Төлбөр засах</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Захиалга</p>
            <p className="font-mono text-sm font-semibold">
              #{payment.orderId.slice(-8).toUpperCase()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Хэрэглэгч</p>
            <p className="text-sm">{payment.userName ?? '—'} · {payment.userEmail}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-status">Төлбөрийн төлөв</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="pay-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.filter((f) => f.value !== 'ALL').map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Болих
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Payment Dialog ─────────────────────────────────────────────────────
function DeletePaymentDialog({
  payment,
  open,
  onClose,
}: {
  payment: PaymentRow;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => adminApi.orders.removePayment(payment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders', 'payments'] });
      toast.success('Төлбөрийн бүртгэл устгагдлаа');
      onClose();
    },
    onError: () => toast.error('Устгахад алдаа гарлаа'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Төлбөр устгах</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-2">
          <p className="text-sm">
            Захиалга{' '}
            <span className="font-mono font-semibold">
              #{payment.orderId.slice(-8).toUpperCase()}
            </span>
            -ийн төлбөрийн бүртгэлийг{' '}
            <span className="text-destructive font-semibold">бүрмөсөн устгах</span> уу?
          </p>
          <p className="text-xs text-muted-foreground">
            Зөвхөн QPay-ийн бүртгэл устах бөгөөд захиалга хэвээр үлдэнэ.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Болих
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Устгаж байна...' : 'Тийм, устга'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Payment Actions ───────────────────────────────────────────────────────────
function PaymentActions({ payment }: { payment: PaymentRow }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setEditOpen(true)}
          title="Засах"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => setDeleteOpen(true)}
          title="Устгах"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {editOpen && (
        <EditPaymentDialog payment={payment} open={editOpen} onClose={() => setEditOpen(false)} />
      )}
      {deleteOpen && (
        <DeletePaymentDialog payment={payment} open={deleteOpen} onClose={() => setDeleteOpen(false)} />
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);

  const handleStatusFilter = (v: StatusFilter) => { setStatusFilter(v); setPage(1); };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'orders', 'payments', page],
    queryFn: () => adminApi.orders.list({ page, pageSize: PAGE_SIZE }),
  });

  const allRows: PaymentRow[] =
    data?.items.flatMap((order: AdminOrder) =>
      (order.payments ?? []).map((p) => ({
        id: p.id,
        orderId: order.id,
        amount: p.amount,
        status: p.status,
        userEmail: order.user.email,
        userName: order.user.name,
        orderDate: order.createdAt,
      })),
    ) ?? [];

  const rows =
    statusFilter === 'ALL' ? allRows : allRows.filter((r) => r.status === statusFilter);

  const counts: Record<string, number> = {};
  allRows.forEach((r) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });

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
            ID: {row.original.id.slice(-10).toUpperCase()}
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
          {PAYMENT_STATUS_LABELS[row.original.status] ?? row.original.status}
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
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => <PaymentActions payment={row.original} />,
    },
  ];

  if (isLoading) return <Loading label="Төлбөрүүд..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Төлбөр</h1>
        <p className="text-sm text-muted-foreground">QPay гүйлгээний бүртгэл</p>
      </div>

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
      <Pagination
        page={page}
        total={data?.total ?? 0}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />

      <p className="text-xs text-muted-foreground">
        <span className="font-medium">ID</span> — төлбөрийн дотоод дугаар.{' '}
        Захиалгыг устгахгүйгээр зөвхөн QPay бүртгэлийг устгах боломжтой.
      </p>
    </div>
  );
}
