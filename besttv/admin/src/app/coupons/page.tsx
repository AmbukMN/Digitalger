'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Ticket, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { api } from '@/lib/api';
import { useAdminCoupons, type AdminCoupon } from '@/lib/queries';

interface FormState {
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  amount: string;
  maxUses: string;
  minPrice: string;
  expiresAt: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  code: '',
  discountType: 'PERCENT',
  amount: '',
  maxUses: '',
  minPrice: '',
  expiresAt: '',
  isActive: true,
};

export default function CouponsPage() {
  const { data, isLoading } = useAdminCoupons();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminCoupon | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const openEdit = (coupon: AdminCoupon | 'new') => {
    setEditing(coupon);
    setForm(
      coupon === 'new'
        ? EMPTY
        : {
            code: coupon.code,
            discountType: coupon.discountType,
            amount: String(coupon.amount),
            maxUses: coupon.maxUses != null ? String(coupon.maxUses) : '',
            minPrice: String(coupon.minPrice),
            expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : '',
            isActive: coupon.isActive,
          },
    );
  };

  const save = async () => {
    if (!form.code.trim() || !form.amount) {
      toast.error('Код, хэмжээг бөглөнө үү');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        discountType: form.discountType,
        amount: Number(form.amount),
        maxUses: form.maxUses ? Number(form.maxUses) : undefined,
        minPrice: form.minPrice ? Number(form.minPrice) : 0,
        expiresAt: form.expiresAt || undefined,
        isActive: form.isActive,
      };
      if (editing === 'new') {
        await api('/admin/coupons', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Купон нэмэгдлээ');
      } else if (editing) {
        await api(`/admin/coupons/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success('Хадгалагдлаа');
      }
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: AdminCoupon) => {
    const ok = await confirm({
      title: `"${c.code}" купоныг устгах уу?`,
      description:
        c.usedCount > 0
          ? `Энэ купоныг ${c.usedCount} удаа ашигласан байна.`
          : 'Энэ купоныг хараахан ашиглаагүй байна.',
      bullets: ['Хэрэглэгчид энэ кодыг ашиглаж чадахгүй болно'],
      tone: 'danger',
    });
    if (!ok) return;
    await api(`/admin/coupons/${c.id}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['admin-coupons'] });
    toast.success('Купон устгагдлаа');
  };

  const generateCode = () => {
    const code = Array.from({ length: 8 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)],
    ).join('');
    setForm((f) => ({ ...f, code }));
  };

  return (
    <AdminShell>
      <AdminTopbar title="Хямдралын купон" subtitle={data ? `Нийт ${data.length} купон` : undefined} />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        <button
          onClick={() => openEdit('new')}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
        >
          <Plus size={15} /> Купон нэмэх
        </button>

        <div className="admin-card mt-5 overflow-hidden rounded-xl">
          {isLoading ? (
            <div className="flex items-center justify-center py-14 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-accent/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Код</th>
                  <th className="px-4 py-3 text-left font-semibold">Хямдрал</th>
                  <th className="px-4 py-3 text-left font-semibold">Ашигласан</th>
                  <th className="px-4 py-3 text-left font-semibold">Дуусах</th>
                  <th className="px-4 py-3 text-left font-semibold">Төлөв</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">{c.code}</td>
                    <td className="px-4 py-3 text-foreground">
                      {c.discountType === 'PERCENT' ? `${c.amount}%` : `${c.amount.toLocaleString()}₮`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ''}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('mn-MN') : 'Хугацаагvй'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-md px-2 py-1 text-xs font-medium',
                          c.isActive ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
                        )}
                      >
                        {c.isActive ? 'Идэвхтэй' : 'Идэвхгvй'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(c)} aria-label="Засах" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => remove(c)} aria-label="Устгах" className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isLoading && !data?.length && <TableEmptyState icon={Ticket} message="Купон олдсонгүй" />}
        </div>
      </main>

      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing === 'new' ? 'Шинэ купон' : 'Купон засах'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Код</label>
                <div className="flex gap-2">
                  <input
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary"
                  />
                  <button
                    onClick={generateCode}
                    type="button"
                    className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/70"
                  >
                    Vvсгэх
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Төрөл</label>
                  <select
                    value={form.discountType}
                    onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as 'PERCENT' | 'FIXED' }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="PERCENT">Хувь (%)</option>
                    <option value="FIXED">Тогтмол (₮)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Хэмжээ {form.discountType === 'PERCENT' ? '(%)' : '(₮)'}
                  </label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Дээд ашиглалт (заавал биш)</label>
                  <input
                    type="number"
                    value={form.maxUses}
                    onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Хамгийн бага дvн (₮)</label>
                  <input
                    type="number"
                    value={form.minPrice}
                    onChange={(e) => setForm((f) => ({ ...f, minPrice: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Дуусах огноо (заавал биш)</label>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-input"
                />
                Идэвхтэй
              </label>
              <button
                onClick={save}
                disabled={saving}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
              >
                {saving ? <Loader2 size={15} className="mx-auto animate-spin" /> : 'Хадгалах'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AdminShell>
  );
}
