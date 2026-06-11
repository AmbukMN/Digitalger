'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Star, Pencil, Trash2, Search, X } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@digitalger/shared/ui';
import { adminApi, errMsg } from '@/lib/api';
import { Pagination } from '@/components/ui/pagination';
import type { AdminReview } from '@/types/admin';

// ─── Од (rating) харуулах ─────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={
            n <= rating
              ? 'h-3.5 w-3.5 fill-amber-400 text-amber-400'
              : 'h-3.5 w-3.5 text-muted-foreground/30'
          }
        />
      ))}
    </span>
  );
}

// ─── Засах dialog (comment / rating / authorName) ────────────────────────────
function EditReviewDialog({
  open,
  review,
  onClose,
}: {
  open: boolean;
  review: AdminReview | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  const [authorName, setAuthorName] = useState('');

  useEffect(() => {
    if (review) {
      setComment(review.comment ?? '');
      setRating(review.rating);
      setAuthorName(review.authorName ?? '');
    }
  }, [review, open]);

  const mut = useMutation({
    mutationFn: () => {
      if (!review) throw new Error('Review байхгүй');
      return adminApi.reviews.update(review.id, {
        comment: comment.trim() || null,
        rating,
        authorName: authorName.trim() || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      toast.success('Шинэчлэгдлээ');
      onClose();
    },
    onError: (e: Error) => toast.error(errMsg(e, 'Алдаа гарлаа')),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Сэтгэгдэл засах</DialogTitle>
        </DialogHeader>
        {review && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              mut.mutate();
            }}
          >
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {review.product?.title ?? 'Бүтээгдэхүүнгүй'}
              {' · '}
              {review.user?.name || review.user?.email || review.authorName || 'Зочин'}
            </div>
            <div className="space-y-1.5">
              <Label>Үнэлгээ (од)</Label>
              <Select value={String(rating)} onValueChange={(v) => setRating(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {'★'.repeat(n)}{'☆'.repeat(5 - n)} ({n})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Нэр (authorName)</Label>
              <Input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Харагдах нэр (хоосон бол хэрэглэгчийн нэр)"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Сэтгэгдэл</Label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="Сэтгэгдлийн текст..."
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Болих
              </Button>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Үндсэн хуудас ────────────────────────────────────────────────────────────
export default function ReviewsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [editing, setEditing] = useState<AdminReview | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminReview | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Product шүүлтийн dropdown — бүх бүтээгдэхүүн (нэг хуудсанд)
  const { data: productsData } = useQuery({
    queryKey: ['admin', 'reviews-product-filter'],
    queryFn: () => adminApi.products.list({ page: 1, pageSize: 1000 }),
    staleTime: 5 * 60 * 1000,
  });
  const products = productsData?.items ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reviews', { page, pageSize, debouncedSearch, productId, rating }],
    queryFn: () =>
      adminApi.reviews.list({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        productId: productId || undefined,
        rating: rating ? Number(rating) : undefined,
      }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Шүүлт/хуудас солиход сонголтыг цэвэрлэнэ
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, pageSize, debouncedSearch, productId, rating]);

  const total = data?.total ?? 0;
  const items = data?.items ?? [];

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.reviews.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      toast.success('Устгагдлаа');
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(errMsg(e, 'Устгахад алдаа гарлаа')),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: () => adminApi.reviews.bulkDelete([...selectedIds]),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      toast.success(`${res.deleted} сэтгэгдэл устгагдлаа`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    },
    onError: (e) => toast.error(errMsg(e, 'Устгахад алдаа гарлаа')),
  });

  const hasFilter = !!(search || productId || rating);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-primary" /> Review (Сэтгэгдэл ба үнэлгээ)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Бүтээгдэхүүний бүх сэтгэгдлийг удирдах ({total})
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Сэтгэгдэл, хэрэглэгч хайх..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={productId || 'all'}
              onValueChange={(v) => {
                setProductId(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Бүтээгдэхүүн" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх бүтээгдэхүүн</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={rating || 'all'}
              onValueChange={(v) => {
                setRating(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Од" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх од</SelectItem>
                {[5, 4, 3, 2, 1].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} ★
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setProductId('');
                  setRating('');
                  setPage(1);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">{selectedIds.size} сонгогдсон</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Сонгосныг устгах ({selectedIds.size})
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Цуцлах
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Ачаалж байна...</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Сэтгэгдэл олдсонгүй</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border cursor-pointer"
                        checked={items.length > 0 && items.every((r) => selectedIds.has(r.id))}
                        onChange={(e) =>
                          setSelectedIds(e.target.checked ? new Set(items.map((r) => r.id)) : new Set())
                        }
                      />
                    </th>
                    <th className="px-4 py-2.5 font-medium">Бүтээгдэхүүн</th>
                    <th className="px-4 py-2.5 font-medium">Хэрэглэгч</th>
                    <th className="px-4 py-2.5 font-medium">Үнэлгээ</th>
                    <th className="px-4 py-2.5 font-medium">Сэтгэгдэл</th>
                    <th className="px-4 py-2.5 font-medium">Огноо</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b border-border/50 hover:bg-muted/30 ${selectedIds.has(r.id) ? 'bg-primary/5' : ''}`}
                    >
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border cursor-pointer"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                        />
                      </td>
                      <td className="px-4 py-2.5 max-w-56">
                        {r.product ? (
                          <a
                            href={`/products`}
                            className="font-medium text-primary hover:underline line-clamp-1"
                            title={r.product.title}
                          >
                            {r.product.title}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        <div className="line-clamp-1">
                          {r.user?.name || r.authorName || 'Зочин'}
                        </div>
                        {r.user?.email && (
                          <div className="text-xs text-muted-foreground/70 line-clamp-1">{r.user.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Stars rating={r.rating} />
                      </td>
                      <td className="px-4 py-2.5 max-w-72">
                        <span className="line-clamp-2 text-muted-foreground" title={r.comment ?? ''}>
                          {r.comment || <span className="italic opacity-60">—</span>}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString('mn-MN')}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditing(r);
                              setEditOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive/60 hover:text-destructive"
                            onClick={() => setDeleteTarget(r)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination
        page={page}
        total={total}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      <EditReviewDialog open={editOpen} review={editing} onClose={() => setEditOpen(false)} />

      {/* Нэг устгах */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Сэтгэгдэл устгах уу?</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {deleteTarget.comment || deleteTarget.user?.name || deleteTarget.authorName || 'Энэ сэтгэгдэл'}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Цуцлах
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              {deleteMut.isPending ? 'Устгаж байна...' : 'Устгах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk устгах */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(o) => !o && setBulkDeleteOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{selectedIds.size} сэтгэгдэл устгах уу?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Энэ үйлдлийг буцаах боломжгүй.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Цуцлах
            </Button>
            <Button
              variant="destructive"
              disabled={bulkDeleteMut.isPending}
              onClick={() => bulkDeleteMut.mutate()}
            >
              {bulkDeleteMut.isPending ? 'Устгаж байна...' : `Устгах (${selectedIds.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
