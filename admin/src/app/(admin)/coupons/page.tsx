'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Clipboard, Pencil, Plus, RefreshCw, Tag, Trash2 } from 'lucide-react';
import {
  Badge,
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
import type { AdminCoupon } from '@/types/admin';
import { formatPrice } from '@digitalger/shared';

const emptyForm = {
  code: '',
  type: 'PERCENT' as 'PERCENT' | 'FIXED',
  value: '',
  minPrice: '',
  maxUses: '',
  active: true,
  expiresAt: '',
};

function CouponDialog({
  open, coupon, onClose, onSaved,
}: {
  open: boolean;
  coupon: AdminCoupon | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      if (coupon) {
        setForm({
          code: coupon.code,
          type: coupon.type,
          value: String(Number(coupon.value)),
          minPrice: coupon.minPrice != null ? String(Number(coupon.minPrice)) : '',
          maxUses: coupon.maxUses != null ? String(coupon.maxUses) : '',
          active: coupon.active,
          expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : '',
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [open, coupon?.id]);

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        code: form.code.trim() || undefined,
        type: form.type,
        value: parseFloat(form.value) || 0,
        minPrice: form.minPrice ? parseFloat(form.minPrice) : undefined,
        maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
        active: form.active,
        expiresAt: form.expiresAt || null,
      };
      return coupon
        ? adminApi.coupons.update(coupon.id, body)
        : adminApi.coupons.create(body);
    },
    onSuccess: () => {
      toast.success(coupon ? 'Купон шинэчлэгдлээ' : 'Купон нэмэгдлээ');
      onSaved();
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.message ? JSON.parse(err.message)?.message : null;
      toast.error(msg || 'Алдаа гарлаа');
    },
  });

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await adminApi.coupons.generateCode();
      setForm((f) => ({ ...f, code: res.code }));
    } catch {
      toast.error('Алдаа гарлаа');
    } finally {
      setGenerating(false);
    }
  }

  const valid = form.value && parseFloat(form.value) > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{coupon ? 'Купон засах' : 'Шинэ купон нэмэх'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Code */}
          <div className="space-y-1.5">
            <Label>Купон код</Label>
            <div className="flex gap-2">
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="Хоосон орхивол автоматаар үүснэ"
                className="font-mono uppercase"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleGenerate}
                disabled={generating}
                title="Автоматаар үүсгэх"
              >
                <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Type + Value */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Хөнгөлөлтийн төрөл</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Хувь (%)</SelectItem>
                  <SelectItem value="FIXED">Тогтмол (₮)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{form.type === 'PERCENT' ? 'Хувь (%)' : 'Дүн (₮)'}</Label>
              <Input
                type="number"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder={form.type === 'PERCENT' ? 'жишээ: 20' : 'жишээ: 5000'}
                min="0"
                max={form.type === 'PERCENT' ? '100' : undefined}
              />
            </div>
          </div>

          {/* Min price */}
          <div className="space-y-1.5">
            <Label>Хамгийн бага дүн (₮) <span className="text-muted-foreground text-xs">(заавал биш)</span></Label>
            <Input
              type="number"
              value={form.minPrice}
              onChange={(e) => setForm((f) => ({ ...f, minPrice: e.target.value }))}
              placeholder="Купон хэрэглэх хамгийн бага үнэ"
              min="0"
            />
          </div>

          {/* Max uses */}
          <div className="space-y-1.5">
            <Label>Хамгийн их ашиглалт <span className="text-muted-foreground text-xs">(заавал биш — хязгааргүй)</span></Label>
            <Input
              type="number"
              value={form.maxUses}
              onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
              placeholder="жишээ: 100"
              min="1"
            />
          </div>

          {/* Expires at */}
          <div className="space-y-1.5">
            <Label>Дуусах огноо <span className="text-muted-foreground text-xs">(заавал биш)</span></Label>
            <Input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
            />
          </div>

          {/* Active */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            <span className="text-sm font-medium">Идэвхтэй</span>
          </label>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Болих</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !valid}>
            {mutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success('Хуулагдлаа'));
}

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCoupon, setEditCoupon] = useState<AdminCoupon | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCoupon | null>(null);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: () => adminApi.coupons.list(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.coupons.remove(id),
    onSuccess: () => {
      toast.success('Устгагдлаа');
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(errMsg(e, 'Алдаа гарлаа')),
  });

  function handleEdit(coupon: AdminCoupon) {
    setEditCoupon(coupon);
    setDialogOpen(true);
  }

  function handleAdd() {
    setEditCoupon(null);
    setDialogOpen(true);
  }

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tag className="h-6 w-6 text-primary" />
            Купон код
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Хямдралын купон кодуудыг удирдах</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-1.5 h-4 w-4" /> Купон нэмэх
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Ачаалж байна...</div>
          ) : coupons.length === 0 ? (
            <div className="p-12 text-center">
              <Tag className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Купон байхгүй байна</p>
              <Button variant="outline" className="mt-4" onClick={handleAdd}>
                <Plus className="mr-1.5 h-4 w-4" /> Шинэ купон нэмэх
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">Код</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">Хөнгөлөлт</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">Хамгийн бага</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">Ашиглалт</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">Дуусах</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">Төлөв</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {coupons.map((coupon) => {
                    const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
                    const isFull = coupon.maxUses != null && coupon.usedCount >= coupon.maxUses;
                    return (
                      <tr key={coupon.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-primary tracking-wider">{coupon.code}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(coupon.code)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="Хуулах"
                            >
                              <Clipboard className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold">
                            {coupon.type === 'PERCENT'
                              ? `${Number(coupon.value)}%`
                              : formatPrice(Number(coupon.value))}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {coupon.minPrice != null ? formatPrice(Number(coupon.minPrice)) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={isFull ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                            {coupon.usedCount}
                            {coupon.maxUses != null ? ` / ${coupon.maxUses}` : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {coupon.expiresAt
                            ? new Date(coupon.expiresAt).toLocaleDateString('mn-MN')
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {isExpired || isFull ? (
                            <Badge variant="destructive" className="text-xs">Дууссан</Badge>
                          ) : coupon.active ? (
                            <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Идэвхтэй</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Идэвхгүй</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleEdit(coupon)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(coupon)}
                              disabled={deleteMut.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Купон устгах уу?</DialogTitle></DialogHeader>
          {deleteTarget && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-mono font-bold text-sm text-primary">{deleteTarget.code}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Купоныг бүрмөсөн устгана. Буцаах боломжгүй.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Цуцлах</Button>
            <Button variant="destructive" disabled={deleteMut.isPending} onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>
              {deleteMut.isPending ? 'Устгаж байна...' : 'Устгах'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CouponDialog
        open={dialogOpen}
        coupon={editCoupon}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
