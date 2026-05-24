'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useRef, useState } from 'react';
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
  Input,
  Loading,
} from '@digitalger/shared/ui';
import { CheckCircle2, Clock, Copy, Download, ImageOff, Search, Star, Upload, XCircle } from 'lucide-react';
import { ProductFormDialog } from '@/components/products/product-form-dialog';
import { adminApi } from '@/lib/api';
import type { AdminProduct } from '@/types/admin';

// ── Inline download count editor ───────────────────────────────────────────────
function DownloadCountCell({ product }: { product: AdminProduct }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(product.downloadCount ?? 0));
  const inputRef = useRef<HTMLInputElement>(null);

  const saveMut = useMutation({
    mutationFn: (count: number) => adminApi.products.update(product.id, { downloadCount: count }),
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
        onBlur={() => { if (!saveMut.isPending) saveMut.mutate(parseInt(value) || 0); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); saveMut.mutate(parseInt(value) || 0); }
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="tabular-nums text-sm text-muted-foreground hover:text-foreground transition-colors"
      title="Дарж засах"
      onClick={() => { setValue(String(product.downloadCount ?? 0)); setEditing(true); }}
    >
      {(product.downloadCount ?? 0).toLocaleString()}
    </button>
  );
}

type ImportResult = {
  total: number;
  created: number;
  failed: number;
  results: { row: number; status: string; title?: string; error?: string }[];
};

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
      size: 72,
      cell: ({ row }) => {
        const url = row.original.thumbnailUrl || row.original.previewUrl;
        return (
          <div className="relative w-14 h-10 rounded-lg overflow-hidden bg-muted border border-border shrink-0">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={row.original.title}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageOff className="h-4 w-4 text-muted-foreground/50" />
              </div>
            )}
            {row.original.featured && (
              <div className="absolute top-0.5 right-0.5 rounded-full bg-secondary/90 p-0.5 shadow-sm">
                <Star className="h-2.5 w-2.5 text-secondary-foreground fill-current" />
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'title',
      header: 'Бүтээгдэхүүн',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="min-w-0 max-w-64">
            <p className="font-semibold text-sm leading-snug line-clamp-2">{p.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{p.type}</span>
              <span className="text-[10px] text-muted-foreground truncate max-w-32">{p.slug}</span>
            </div>
          </div>
        );
      },
    },
    {
      id: 'price',
      header: 'Үнэ',
      cell: ({ row }) => {
        const price = Number(row.original.price);
        const compare = Number(row.original.compareAtPrice);
        const hasDiscount = compare > price && compare > 0;
        const pct = hasDiscount ? Math.round((1 - price / compare) * 100) : 0;
        return (
          <div className="whitespace-nowrap">
            <p className="font-bold text-sm tabular-nums">{price.toLocaleString('mn-MN')}₮</p>
            {hasDiscount && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-muted-foreground line-through tabular-nums">{compare.toLocaleString('mn-MN')}₮</span>
                <span className="text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5">-{pct}%</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'discount',
      header: 'Хямдрал',
      cell: ({ row }) => {
        const endsAt = row.original.discountEndsAt;
        if (!endsAt) return <span className="text-xs text-muted-foreground/50">—</span>;
        const d = new Date(endsAt);
        const now = new Date();
        const expired = d < now;
        const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return (
          <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            expired ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
            daysLeft <= 7 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
            'bg-muted text-muted-foreground'
          }`}>
            <Clock className="h-2.5 w-2.5 shrink-0" />
            {expired ? 'Дууссан' : `${daysLeft}өд`}
          </div>
        );
      },
    },
    {
      id: 'downloadCount',
      header: 'Таталт',
      cell: ({ row }) => (
        <div className="flex items-center gap-1" title="Дарж тоог засах">
          <Download className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          <DownloadCountCell product={row.original} />
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Төлөв',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex flex-col gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold w-fit ${
              p.published
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-muted text-muted-foreground'
            }`}>
              {p.published ? <><CheckCircle2 className="h-3 w-3" />Нийтэлсэн</> : 'Ноорог'}
            </span>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => { setEditing(row.original); setDialogOpen(true); }}
          >
            Засах
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Клонлох"
            disabled={cloneMutation.isPending}
            onClick={() => cloneMutation.mutate(row.original.id)}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteTarget(row.original)}
          >
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <Loading label="Бүтээгдэхүүнүүд..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Бүтээгдэхүүн</h1>
          <p className="text-sm text-muted-foreground">Нийт {data?.total ?? 0} бүтээгдэхүүн</p>
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
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending}>
            <Upload className="mr-1.5 h-4 w-4" />
            {importMutation.isPending ? 'Импортлож байна...' : 'Импорт'}
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            + Нэмэх
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Бүтээгдэхүүн хайх..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable columns={columns} data={data?.items ?? []} />

      <ProductFormDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editing} />

      {/* Import result */}
      <Dialog open={!!importResult} onOpenChange={() => setImportResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Импортын үр дүн</DialogTitle></DialogHeader>
          {importResult && (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm rounded-lg bg-muted/50 p-3">
                <span>Нийт: <strong>{importResult.total}</strong></span>
                <span className="text-green-600">Амжилттай: <strong>{importResult.created}</strong></span>
                {importResult.failed > 0 && <span className="text-destructive">Алдаатай: <strong>{importResult.failed}</strong></span>}
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
                {importResult.results.map((r) => (
                  <div key={r.row} className="flex items-start gap-2 text-xs py-1 border-b border-border/50 last:border-0">
                    {r.status === 'created'
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      : <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />}
                    <span className="text-muted-foreground shrink-0">Мөр {r.row}:</span>
                    <span className="flex-1 truncate">{r.title ?? '—'}</span>
                    {r.error && <span className="text-destructive shrink-0">{r.error}</span>}
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

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Устгах уу?</DialogTitle></DialogHeader>
          {deleteTarget && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              {(deleteTarget.thumbnailUrl || deleteTarget.previewUrl) && (
                <div className="h-12 w-16 shrink-0 rounded-md overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={deleteTarget.thumbnailUrl || deleteTarget.previewUrl!} alt={deleteTarget.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                </div>
              )}
              <p className="text-sm font-medium line-clamp-2">{deleteTarget.title}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Бүтээгдэхүүнийг бүрмөсөн устгана. Буцаах боломжгүй.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Цуцлах</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              {deleteMutation.isPending ? 'Устгаж байна...' : 'Устгах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
