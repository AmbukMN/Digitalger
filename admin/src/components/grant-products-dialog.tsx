'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Loading,
} from '@digitalger/shared/ui';
import { Search, Check, Gift, Trash2, X, Package } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api';
import type { AdminUser } from '@/types/admin';

function fmtPrice(v: number | string): string {
  return String(Math.round(Number(v) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '₮';
}

interface Props {
  user: AdminUser | null;
  onClose: () => void;
}

export function GrantProductsDialog({ user, onClose }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Хайлт debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Dialog нээгдэх бүрд reset
  useEffect(() => {
    if (user) {
      setSearch('');
      setDebounced('');
      setSelected(new Set());
    }
  }, [user]);

  // Бүх бүтээгдэхүүн (search filter-тэй)
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['admin-grant-products', debounced],
    queryFn: () => adminApi.products.list({ pageSize: 100, search: debounced || undefined }),
    enabled: !!user,
  });

  // Хэрэглэгчид аль хэдийн идэвхжүүлсэн бүтээгдэхүүн (цуцлах боломжтой)
  const { data: grantedData, refetch: refetchGranted } = useQuery({
    queryKey: ['admin-granted', user?.id],
    queryFn: () => adminApi.users.listGranted(user!.id),
    enabled: !!user,
  });

  const grantedIds = useMemo(
    () => new Set((grantedData?.items ?? []).map((g) => g.productId)),
    [grantedData],
  );

  const grantMutation = useMutation({
    mutationFn: (ids: string[]) => adminApi.users.grantProducts(user!.id, ids),
    onSuccess: (res) => {
      if (res.granted > 0) {
        toast.success(`${res.granted} бүтээгдэхүүн идэвхжлээ${res.skipped ? ` (${res.skipped} аль хэдийн идэвхтэй)` : ''}`);
      } else {
        toast.info(res.message ?? 'Сонгосон бүгд аль хэдийн идэвхтэй байна');
      }
      setSelected(new Set());
      refetchGranted();
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: unknown) => toast.error((e as Error)?.message || 'Идэвхжүүлэхэд алдаа гарлаа'),
  });

  const revokeMutation = useMutation({
    mutationFn: (productId: string) => adminApi.users.revokeGranted(user!.id, productId),
    onSuccess: () => {
      toast.success('Бүтээгдэхүүн цуцлагдлаа');
      refetchGranted();
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: unknown) => toast.error((e as Error)?.message || 'Цуцлахад алдаа гарлаа'),
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const products = productsData?.items ?? [];

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Бүтээгдэхүүн идэвхжүүлэх
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{user?.name ?? user?.email}</span> хэрэглэгчид
            бүтээгдэхүүнийг үнэгүй идэвхжүүлнэ (Миний санд орно).
          </p>
        </DialogHeader>

        {/* Аль хэдийн идэвхжүүлсэн (цуцлах боломжтой) */}
        {grantedData && grantedData.items.length > 0 && (
          <div className="border-b border-border bg-muted/30 px-5 py-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Идэвхжүүлсэн бүтээгдэхүүн ({grantedData.items.length}) — цуцлах боломжтой
            </p>
            <div className="flex flex-wrap gap-1.5">
              {grantedData.items.map((g) => (
                <span
                  key={g.productId}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background py-0.5 pl-2.5 pr-1 text-xs"
                >
                  <span className="max-w-[160px] truncate">{g.title}</span>
                  <button
                    type="button"
                    onClick={() => revokeMutation.mutate(g.productId)}
                    disabled={revokeMutation.isPending}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-destructive/70 hover:bg-red-50 dark:bg-red-950/40 hover:text-destructive disabled:opacity-50"
                    title="Цуцлах"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Хайлт */}
        <div className="border-b border-border px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Бүтээгдэхүүн хайх..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Бүтээгдэхүүн жагсаалт (multi-select) */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {isLoading ? (
            <Loading label="Бүтээгдэхүүн ачаалж байна..." className="py-8" />
          ) : products.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Бүтээгдэхүүн олдсонгүй</p>
          ) : (
            <div className="space-y-1">
              {products.map((p) => {
                const isSel = selected.has(p.id);
                const alreadyGranted = grantedIds.has(p.id);
                const img = p.thumbnailUrl || p.previewUrl;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => !alreadyGranted && toggle(p.id)}
                    disabled={alreadyGranted}
                    className={`flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      alreadyGranted
                        ? 'cursor-not-allowed border-transparent opacity-50'
                        : isSel
                          ? 'border-primary bg-muted'
                          : 'border-transparent hover:bg-muted/50'
                    }`}
                  >
                    {/* Checkbox */}
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        isSel ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
                      }`}
                    >
                      {isSel && <Check className="h-3.5 w-3.5" />}
                    </span>
                    {/* Зураг */}
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={p.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Package className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    {/* Мэдээлэл */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{p.type}</span>
                        {p.category?.name && <span>{p.category.name}</span>}
                        <span className="font-medium text-foreground">{fmtPrice(p.price)}</span>
                      </div>
                    </div>
                    {alreadyGranted && (
                      <span className="shrink-0 text-[10px] font-medium text-green-600">Идэвхтэй</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-5 py-3">
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {selected.size > 0 ? `${selected.size} сонгосон` : 'Бүтээгдэхүүн сонгоно уу'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Хаах
              </Button>
              <Button
                onClick={() => grantMutation.mutate([...selected])}
                disabled={selected.size === 0 || grantMutation.isPending}
                className="gap-1.5"
              >
                <Gift className="h-4 w-4" />
                {grantMutation.isPending ? 'Идэвхжүүлж байна...' : 'Идэвхжүүлэх'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
