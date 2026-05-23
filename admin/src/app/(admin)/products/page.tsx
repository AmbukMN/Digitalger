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
import { Copy, Upload, CheckCircle2, XCircle, ImageOff, Tag, Clock, Download } from 'lucide-react';
import Image from 'next/image';
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

type ImportResult = { total: number; created: number; failed: number; results: { row: number; status: string; title?: string; error?: string }[] };

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: (file: File) => adminApi.products.bulkImport(file),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      setImportResult(res);
      toast.success(`${res.created} бүтээгдэхүүн импортлогдлоо${res.failed > 0 ? `, ${res.failed} алдаатай` : ''}`);
    },
    onError: () => toast.error('Импортлоход алдаа гарлаа'),
  });

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

  const cloneMutation = useMutation({
    mutationFn: (id: string) => adminApi.products.clone(id),
    onSuccess: (cloned) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      toast.success(`"${cloned.title}" клонлогдлоо`);
    },
    onError: () => toast.error('Клонлоход алдаа гарлаа'),
  });

  const columns: ColumnDef<AdminProduct>[] = [
    {
      id: 'thumbnail',
      header: '',
      size: 60,
      cell: ({ row }) => {
        const url = row.original.thumbnailUrl || row.original.previewUrl;
        return (
          <div className="w-12 h-9 rounded overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
            {url ? (
              <Image src={url} alt={row.original.title} width={48} height={36} className="object-cover w-full h-full" />
            ) : (
              <ImageOff className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'title',
      header: 'Бүтээгдэхүүн',
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="font-medium text-sm leading-tight line-clamp-2">{row.original.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{row.original.type} · {row.original.slug}</p>
        </div>
      ),
    },
    {
      id: 'price',
      header: 'Үнэ',
      cell: ({ row }) => {
        const price = Number(row.original.price);
        const compare = Number(row.original.compareAtPrice);
        const hasDiscount = compare > price;
        const pct = hasDiscount ? Math.round((1 - price / compare) * 100) : 0;
        return (
          <div className="space-y-0.5">
            <p className="font-semibold text-sm">{price.toLocaleString('mn-MN')}₮</p>
            {hasDiscount && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground line-through">{compare.toLocaleString('mn-MN')}₮</span>
                <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">-{pct}%</Badge>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'discount',
      header: 'Хямдрал дуусах',
      cell: ({ row }) => {
        const endsAt = row.original.discountEndsAt;
        if (!endsAt) return <span className="text-xs text-muted-foreground">—</span>;
        const d = new Date(endsAt);
        const now = new Date();
        const expired = d < now;
        const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return (
          <div className="flex items-center gap-1">
            <Clock className={`h-3.5 w-3.5 shrink-0 ${expired ? 'text-destructive' : daysLeft <= 7 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            <span className={`text-xs ${expired ? 'text-destructive' : daysLeft <= 7 ? 'text-orange-500 font-medium' : 'text-muted-foreground'}`}>
              {expired ? 'Дууссан' : `${daysLeft} өдөр`}
            </span>
          </div>
        );
      },
    },
    {
      id: 'downloadCount',
      header: 'Таталт',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <DownloadCountCell product={row.original} />
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Төлөв',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <Badge variant={row.original.published ? 'default' : 'secondary'} className="text-xs w-fit">
            {row.original.published ? 'Нийтэлсэн' : 'Ноорог'}
          </Badge>
          {row.original.featured && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 w-fit text-amber-600 border-amber-400">
              <Tag className="h-2.5 w-2.5 mr-0.5" />Онцлох
            </Badge>
          )}
        </div>
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
            variant="outline"
            size="sm"
            title="Клонлох"
            disabled={cloneMutation.isPending}
            onClick={() => cloneMutation.mutate(row.original.id)}
          >
            <Copy className="h-3.5 w-3.5" />
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
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) { importMutation.mutate(file); e.target.value = ''; }
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {importMutation.isPending ? 'Импортлож байна...' : 'CSV/Excel импорт'}
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            + Нэмэх
          </Button>
        </div>
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

      {/* Import result dialog */}
      <Dialog open={!!importResult} onOpenChange={() => setImportResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Импортын үр дүн</DialogTitle>
          </DialogHeader>
          {importResult && (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm">
                <span>Нийт: <strong>{importResult.total}</strong></span>
                <span className="text-green-600">Амжилттай: <strong>{importResult.created}</strong></span>
                {importResult.failed > 0 && <span className="text-destructive">Алдаатай: <strong>{importResult.failed}</strong></span>}
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {importResult.results.map((r) => (
                  <div key={r.row} className="flex items-start gap-2 text-xs py-1 border-b border-border last:border-0">
                    {r.status === 'created'
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      : <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />}
                    <span className="text-muted-foreground">Мөр {r.row}:</span>
                    <span className="flex-1">{r.title ?? '—'}</span>
                    {r.error && <span className="text-destructive">{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setImportResult(null)}>Хаах</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
