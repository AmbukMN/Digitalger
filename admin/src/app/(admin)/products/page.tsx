'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useRef, useState } from 'react';
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
  Input,
  Loading,
} from '@digitalger/shared/ui';
import { ProductFormDialog } from '@/components/products/product-form-dialog';
import { adminApi } from '@/lib/api';
import type { AdminProduct } from '@/types/admin';

function DownloadCountCell({ product }: { product: AdminProduct }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(product.downloadCount ?? 0));
  const inputRef = useRef<HTMLInputElement>(null);

  const saveMut = useMutation({
    mutationFn: (count: number) =>
      adminApi.products.update(product.id, { downloadCount: count }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      setEditing(false);
    },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        min={0}
        className="h-7 w-20 text-xs"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => saveMut.mutate(parseInt(value) || 0)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') saveMut.mutate(parseInt(value) || 0);
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      title="Дарж засах"
      onClick={() => { setValue(String(product.downloadCount ?? 0)); setEditing(true); }}
    >
      {(product.downloadCount ?? 0).toLocaleString()} таталт
    </button>
  );
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'products', search],
    queryFn: () => adminApi.products.list({ search: search || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.products.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      toast.success('Устгагдлаа');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Устгахад алдаа'),
  });

  const columns: ColumnDef<AdminProduct>[] = [
    { accessorKey: 'title', header: 'Гарчиг' },
    { accessorKey: 'slug', header: 'Slug' },
    {
      accessorKey: 'price',
      header: 'Үнэ',
      cell: ({ row }) =>
        Number(row.original.price).toLocaleString('mn-MN') + ' ₮',
    },
    { accessorKey: 'type', header: 'Төрөл' },
    {
      id: 'downloadCount',
      header: 'Таталт',
      cell: ({ row }) => <DownloadCountCell product={row.original} />,
    },
    {
      id: 'status',
      header: 'Төлөв',
      cell: ({ row }) => (
        <Badge variant={row.original.published ? 'default' : 'secondary'}>
          {row.original.published ? 'Нийтэлсэн' : 'Ноорог'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(row.original);
              setDialogOpen(true);
            }}
          >
            Засах
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteTarget(row.original)}
          >
            Устгах
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <Loading label="Бүтээгдэхүүнүүд..." />;
  if (isError)
    return (
      <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Бүтээгдэхүүн</h1>
          <p className="text-muted-foreground">Нийт {data?.total ?? 0}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          + Нэмэх
        </Button>
      </div>

      <Input
        placeholder="Хайх..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <DataTable columns={columns} data={data?.items ?? []} />

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
      />

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Устгах уу?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            &quot;{deleteTarget?.title}&quot; бүтээгдэхүүнийг бүрмөсөн устгана.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Цуцлах
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              Устгах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
