'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { OrderStatus } from '@digitalger/shared';
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Input,
  Label,
  Loading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@digitalger/shared/ui';
import { CheckCircle2, Package, Pencil, Search, Tag, Trash2, XCircle, Clock, RotateCcw, Ban } from 'lucide-react';
import Image from 'next/image';
import { adminApi } from '@/lib/api';
import { Pagination } from '@/components/ui/pagination';
import type { AdminOrder } from '@/types/admin';

const PAGE_SIZE = 20;

const STATUSES: { value: OrderStatus | 'ALL'; label: string; color?: string }[] = [
  { value: 'ALL',       label: 'Бүгд' },
  { value: 'PENDING',   label: 'Хүлээгдэж байна' },
  { value: 'PAID',      label: 'Төлсөн' },
  { value: 'FAILED',    label: 'Амжилтгүй' },
  { value: 'REFUNDED',  label: 'Буцаасан' },
  { value: 'CANCELLED', label: 'Цуцалсан' },
];

function formatMoney(value: number | string) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('mn-MN').format(n) + ' ₮';
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    PAID:      { label: 'Төлсөн',            cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   icon: <CheckCircle2 className="h-3 w-3" /> },
    PENDING:   { label: 'Хүлээгдэж байна',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',   icon: <Clock className="h-3 w-3" /> },
    FAILED:    { label: 'Амжилтгүй',         cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           icon: <XCircle className="h-3 w-3" /> },
    REFUNDED:  { label: 'Буцаасан',          cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',       icon: <RotateCcw className="h-3 w-3" /> },
    CANCELLED: { label: 'Цуцалсан',          cls: 'bg-muted text-muted-foreground',                                          icon: <Ban className="h-3 w-3" /> },
  };
  const s = map[status] ?? map.CANCELLED;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
}

function UserCell({ name, email }: { name: string | null; email: string }) {
  const initials = (name ?? email).charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate leading-tight">{name ?? '—'}</p>
        <p className="text-xs text-muted-foreground truncate">{email}</p>
      </div>
    </div>
  );
}

function EditOrderDialog({ order, open, onClose }: { order: AdminOrder; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [coupon, setCoupon] = useState(order.couponCode ?? '');

  const mutation = useMutation({
    mutationFn: () => adminApi.orders.update(order.id, { status, couponCode: coupon.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast.success('Захиалга шинэчлэгдлээ');
      onClose();
    },
    onError: () => toast.error('Шинэчлэхэд алдаа гарлаа'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-primary">#{order.id.slice(-8).toUpperCase()}</span>
            <span className="font-normal text-muted-foreground">захиалга засах</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1">
            <p className="text-xs text-muted-foreground">Хэрэглэгч</p>
            <p className="text-sm font-medium">{order.user.name ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{order.user.email}</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1">
            <p className="text-xs text-muted-foreground mb-1">Бүтээгдэхүүн ({order.items.length})</p>
            {order.items.map((item) => (
              <p key={item.id} className="text-sm truncate">• {item.product.title}</p>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-status">Төлөв</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
              <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.filter((s) => s.value !== 'ALL').map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-coupon">Купон код <span className="text-muted-foreground font-normal">(хоосон = устгах)</span></Label>
            <Input id="edit-coupon" value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="SUMMER20, ..." className="font-mono uppercase" />
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

function DeleteOrderDialog({ order, open, onClose }: { order: AdminOrder; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => adminApi.orders.remove(order.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast.success('Захиалга устгагдлаа');
      onClose();
    },
    onError: () => toast.error('Устгахад алдаа гарлаа'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Захиалга устгах</DialogTitle></DialogHeader>
        <div className="py-2 space-y-2">
          <p className="text-sm">
            <span className="font-mono font-bold text-foreground">#{order.id.slice(-8).toUpperCase()}</span> захиалгыг{' '}
            <span className="text-destructive font-semibold">бүрмөсөн устгах</span> уу?
          </p>
          <p className="text-xs text-muted-foreground">Захиалгын бүх мэдээлэл, төлбөрийн бүртгэл устах бөгөөд буцаах боломжгүй.</p>
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

function OrderActions({ order }: { order: AdminOrder }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setEditOpen(true)} title="Засах">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteOpen(true)} title="Устгах">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {editOpen && <EditOrderDialog order={order} open={editOpen} onClose={() => setEditOpen(false)} />}
      {deleteOpen && <DeleteOrderDialog order={order} open={deleteOpen} onClose={() => setDeleteOpen(false)} />}
    </>
  );
}

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [statusFilter, search]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'orders', statusFilter, search, page],
    queryFn: () => adminApi.orders.list({
      status: statusFilter !== 'ALL' ? statusFilter : undefined,
      search: search || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
  });

  const statusCounts = (data?.items ?? []).reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const columns: ColumnDef<AdminOrder>[] = [
    {
      accessorKey: 'id',
      header: 'Дугаар',
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-xs font-bold tracking-wide">
          #{row.original.id.slice(-8).toUpperCase()}
        </span>
      ),
    },
    {
      id: 'user',
      header: 'Хэрэглэгч',
      cell: ({ row }) => <UserCell name={row.original.user.name} email={row.original.user.email} />,
    },
    {
      id: 'items',
      header: 'Бүтээгдэхүүн',
      cell: ({ row }) => {
        const items = row.original.items;
        const first3 = items.slice(0, 3);
        return (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex -space-x-2 shrink-0">
              {first3.map((item, idx) => (
                <div
                  key={item.id}
                  className="relative h-8 w-8 rounded-md border-2 border-background bg-muted overflow-hidden shrink-0"
                  style={{ zIndex: first3.length - idx }}
                >
                  {item.product.previewUrl ? (
                    <Image src={item.product.previewUrl} alt={item.product.title} fill className="object-cover" sizes="32px"
                      unoptimized={item.product.previewUrl.split('?')[0].toLowerCase().endsWith('.svg')} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <Package className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="min-w-0 max-w-40">
              <p className="truncate text-xs font-medium leading-tight">{items[0]?.product.title ?? '—'}</p>
              {items.length > 1 && (
                <p className="text-[10px] text-muted-foreground">+{items.length - 1} бүтээгдэхүүн</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'total',
      header: 'Дүн',
      cell: ({ row }) => (
        <div>
          <p className="font-bold tabular-nums text-sm">{formatMoney(row.original.total)}</p>
          {row.original.couponCode && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {row.original.couponCode.split(',').map((c) => c.trim()).filter(Boolean).map((c) => (
                <span key={c} className="inline-flex items-center gap-0.5 rounded-full bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 text-[10px] font-mono font-bold text-green-700 dark:text-green-400">
                  <Tag className="h-2.5 w-2.5" />{c}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Төлөв',
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
      cell: ({ row }) => <OrderActions order={row.original} />,
    },
  ];

  if (isLoading) return <Loading label="Захиалгууд..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Захиалга</h1>
          <p className="text-sm text-muted-foreground">Нийт {data?.total ?? 0} захиалга</p>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Дугаар эсвэл и-мэйлээр хайх..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | 'ALL')}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || statusFilter !== 'ALL') && (
          <Button variant="ghost" size="sm" onClick={() => { setSearchInput(''); setSearch(''); setStatusFilter('ALL'); setPage(1); }}>
            Цэвэрлэх
          </Button>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => {
          const count = s.value === 'ALL' ? (data?.total ?? 0) : (statusCounts[s.value] ?? 0);
          const active = statusFilter === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => { setStatusFilter(s.value as OrderStatus | 'ALL'); setPage(1); }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {s.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${active ? 'bg-white/20' : 'bg-background text-foreground'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <DataTable columns={columns} data={data?.items ?? []} />
      <Pagination page={page} total={data?.total ?? 0} pageSize={PAGE_SIZE} onPage={setPage} />
    </div>
  );
}
