'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import {
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
import { CheckCircle2, Clock, Pencil, Trash2, XCircle, CreditCard } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { Pagination } from '@/components/ui/pagination';
import { OrderStatusBadge } from '@/components/order-status-badge';
import type { AdminPaymentRow } from '@/types/admin';

const DEFAULT_PAGE_SIZE = 20;

type StatusFilter = 'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL',     label: 'Бүгд' },
  { value: 'SUCCESS', label: 'Амжилттай' },
  { value: 'PENDING', label: 'Хүлээгдэж байна' },
  { value: 'FAILED',  label: 'Амжилтгүй' },
];

const STATUS_MAP: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  SUCCESS: { label: 'Амжилттай',       cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  PENDING: { label: 'Хүлээгдэж байна', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="h-3 w-3" /> },
  FAILED:  { label: 'Амжилтгүй',       cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',         icon: <XCircle className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: 'bg-muted text-muted-foreground', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
}

function UserCell({ name, email, image }: { name: string | null; email: string; image?: string | null }) {
  const initials = (name ?? email).charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name ?? email} className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border" referrerPolicy="no-referrer" />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-primary ring-1 ring-primary/20">
          {initials}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium truncate leading-tight">{name ?? '—'}</p>
        <p className="text-xs text-muted-foreground truncate">{email}</p>
      </div>
    </div>
  );
}

function EditPaymentDialog({ payment, open, onClose }: { payment: AdminPaymentRow; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(payment.status);

  const mutation = useMutation({
    mutationFn: () => adminApi.orders.updatePayment(payment.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
      toast.success('Төлбөрийн төлөв шинэчлэгдлээ');
      onClose();
    },
    onError: () => toast.error('Шинэчлэхэд алдаа гарлаа'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Төлбөр засах
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1">
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Захиалга</p>
              <span className="font-mono text-xs font-bold">#{payment.order.id.slice(-8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Хэрэглэгч</p>
              <p className="text-xs font-medium">{payment.order.user.name ?? payment.order.user.email}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-status">Төлбөрийн төлөв</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="pay-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.filter((f) => f.value !== 'ALL').map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Болих</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeletePaymentDialog({ payment, open, onClose }: { payment: AdminPaymentRow; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => adminApi.orders.removePayment(payment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
      toast.success('Төлбөрийн бүртгэл устгагдлаа');
      onClose();
    },
    onError: () => toast.error('Устгахад алдаа гарлаа'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Төлбөр устгах</DialogTitle></DialogHeader>
        <div className="py-2 space-y-2">
          <p className="text-sm">Захиалга <span className="font-mono font-bold">#{payment.order.id.slice(-8).toUpperCase()}</span>-ийн төлбөрийг <span className="text-destructive font-semibold">бүрмөсөн устгах</span> уу?</p>
          <p className="text-xs text-muted-foreground">Зөвхөн QPay-ийн бүртгэл устах бөгөөд захиалга хэвээр үлдэнэ.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Болих</Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Устгаж байна...' : 'Устгах'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentActions({ payment }: { payment: AdminPaymentRow }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setEditOpen(true)} title="Засах">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-red-50 dark:bg-red-950/40" onClick={() => setDeleteOpen(true)} title="Устгах">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {editOpen && <EditPaymentDialog payment={payment} open={editOpen} onClose={() => setEditOpen(false)} />}
      {deleteOpen && <DeletePaymentDialog payment={payment} open={deleteOpen} onClose={() => setDeleteOpen(false)} />}
    </>
  );
}

export default function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'payments', statusFilter, page, pageSize],
    queryFn: () => adminApi.orders.listPayments({ page, pageSize, status: statusFilter }),
    staleTime: 0,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const columns: ColumnDef<AdminPaymentRow>[] = [
    {
      id: 'order',
      header: 'Захиалга',
      cell: ({ row }) => (
        <div className="space-y-1">
          <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-xs font-bold tracking-wide">
            #{row.original.order.id.slice(-8).toUpperCase()}
          </span>
          <div>
            <OrderStatusBadge
              status={row.original.order.status}
              source={row.original.order.source}
              cancelledBy={row.original.order.cancelledBy}
              size="sm"
            />
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">
            {row.original.id.slice(-10).toUpperCase()}
          </p>
        </div>
      ),
    },
    {
      id: 'user',
      header: 'Хэрэглэгч',
      cell: ({ row }) => (
        <UserCell
          name={row.original.order.user.name}
          email={row.original.order.user.email}
          image={row.original.order.user.image}
        />
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Дүн',
      cell: ({ row }) => (
        <p className="font-bold tabular-nums text-sm">{Number(row.original.amount).toLocaleString('mn-MN')} ₮</p>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Төлбөрийн төлөв',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'createdAt',
      header: 'Огноо',
      cell: ({ row }) => {
        const d = new Date(row.original.createdAt);
        return (
          <div className="whitespace-nowrap">
            <p className="text-xs font-medium">{d.toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</p>
            <p className="text-[10px] text-muted-foreground">{d.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        );
      },
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Төлбөр</h1>
        <p className="text-sm text-muted-foreground">Нийт {data?.total ?? 0} төлбөрийн бүртгэл</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <DataTable columns={columns} data={data?.items ?? []} pageSize={pageSize} />
      <Pagination
        page={page}
        total={data?.total ?? 0}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={(size) => { setPageSize(size); setPage(1); }}
      />
    </div>
  );
}
