'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Crown, Loader2, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice, cn } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { api } from '@/lib/api';
import { useAdminGenres, useAdminPlans, type AdminPlan } from '@/lib/queries';

interface FormState {
  name: string;
  description: string;
  price: string;
  durationDays: string;
  features: string;
  isVip: boolean;
  isActive: boolean;
  order: string;
  genreIds: string[];
}

const EMPTY: FormState = {
  name: '',
  description: '',
  price: '',
  durationDays: '30',
  features: 'Завсаргүй үзвэр, FHD чанар, Олон төхөөрөмж',
  isVip: false,
  isActive: true,
  order: '0',
  genreIds: [],
};

/** Хугацааны товч сонголтууд — уян хатан, гараар ч бичиж болно */
const DURATION_PRESETS = [
  { label: '1 сар', days: 30 },
  { label: '3 сар', days: 90 },
  { label: '6 сар', days: 180 },
  { label: '1 жил', days: 365 },
];

export default function PlansPage() {
  const { data, isLoading } = useAdminPlans();
  const { data: genres } = useAdminGenres();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminPlan | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const openEdit = (plan: AdminPlan | 'new') => {
    setEditing(plan);
    setForm(
      plan === 'new'
        ? EMPTY
        : {
            name: plan.name,
            description: plan.description ?? '',
            price: String(plan.price),
            durationDays: String(plan.durationDays),
            features: (plan.features ?? []).join(', '),
            isVip: plan.isVip,
            isActive: plan.isActive,
            order: String(plan.order),
            genreIds: plan.genres.map((g) => g.id),
          },
    );
  };

  const save = async () => {
    if (!form.name.trim() || !form.price || !form.durationDays) {
      toast.error('Нэр, үнэ, хугацааг бөглөнө үү');
      return;
    }
    if (!form.isVip && form.genreIds.length === 0) {
      toast.error('Жанр сонгоно уу (эсвэл VIP болгоно уу)');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        price: Number(form.price),
        durationDays: Number(form.durationDays),
        features: form.features.split(',').map((f) => f.trim()).filter(Boolean),
        isVip: form.isVip,
        isActive: form.isActive,
        order: Number(form.order) || 0,
        genreIds: form.isVip ? [] : form.genreIds,
      };
      if (editing === 'new') {
        await api('/admin/plans', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Багц үүслээ');
      } else if (editing) {
        await api(`/admin/plans/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success('Хадгалагдлаа');
      }
      qc.invalidateQueries({ queryKey: ['admin-plans'] });
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: AdminPlan) => {
    const ok = await confirm({
      title: `"${p.name}" багцыг устгах уу?`,
      description: 'Хэрэглэгчид энэ багцыг худалдаж авах боломжгүй болно.',
      bullets: [
        'Төлбөр/захиалга хийгдсэн бол УСТАХГҮЙ — зөвхөн идэвхгүй болно',
        'Одоо эрхтэй хэрэглэгчдийн эрх хэвээр үлдэнэ',
      ],
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const res = await api<{
        deactivated?: boolean;
        deleted?: boolean;
        payments?: number;
        subscriptions?: number;
        message?: string;
      }>(`/admin/plans/${p.id}`, { method: 'DELETE' });

      await qc.invalidateQueries({ queryKey: ['admin-plans'] });

      // ⚠️ Устгагдаагүй бол ХУДАЛ "устгагдлаа" гэж хэлэхгүй — юу болсныг
      // тайлбарлаж, хүчээр устгах сонголт санал болгоно.
      if (res.deactivated) {
        toast.warning(res.message ?? 'Багц идэвхгүй болголоо (устгасангүй)', { duration: 6000 });

        const forceOk = await confirm({
          title: 'Бүрмөсөн устгах уу?',
          description: `"${p.name}" багцад ${res.payments ?? 0} төлбөр, ${res.subscriptions ?? 0} захиалга холбоотой.`,
          bullets: [
            'Багц бүрмөсөн устана',
            'Төлбөрийн түүх ҮЛДЭНЭ (багцгүй гэж харагдана)',
            `${res.subscriptions ?? 0} захиалга устаж, тэдгээр хэрэглэгч эрхээ АЛДАНА`,
            'Сэргээх БОЛОМЖГҮЙ',
          ],
          confirmLabel: 'Тийм, бүрмөсөн устга',
          tone: 'danger',
        });
        if (!forceOk) return;

        await api(`/admin/plans/${p.id}?force=1`, { method: 'DELETE' });
        await qc.invalidateQueries({ queryKey: ['admin-plans'] });
        toast.success('Багц бүрмөсөн устгагдлаа');
      } else {
        toast.success('Багц устгагдлаа');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Устгаж чадсангүй');
    }
  };

  const toggleActive = async (p: AdminPlan) => {
    try {
      await api(`/admin/plans/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      await qc.invalidateQueries({ queryKey: ['admin-plans'] });
      toast.success(p.isActive ? 'Багц идэвхгүй боллоо' : 'Багц идэвхжлээ');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Өөрчилж чадсангүй');
    }
  };

  const toggleGenre = (id: string) => {
    setForm((f) => ({
      ...f,
      genreIds: f.genreIds.includes(id) ? f.genreIds.filter((g) => g !== id) : [...f.genreIds, id],
    }));
  };

  return (
    <AdminShell>
      <AdminTopbar
        title="Багцууд"
        subtitle={data ? `Нийт ${data.length} багц · ${data.filter((p) => p.isActive).length} идэвхтэй` : undefined}
      />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        <div className="mb-4 rounded-lg border border-primary/25 bg-primary/8 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Багц хэрхэн ажилладаг вэ:</strong> Багц бүр сонгосон
          жанруудын контентыг нээнэ. Хэрэглэгч олон багц зэрэг авч болно. VIP багц нь жанр
          сонгохгүйгээр БҮХ контентыг нээнэ.
        </div>

        <button
          onClick={() => openEdit('new')}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
        >
          <Plus size={15} /> Багц нэмэх
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
                  <th className="px-4 py-3 text-left font-semibold">Багц</th>
                  <th className="px-4 py-3 text-left font-semibold">Үнэ</th>
                  <th className="px-4 py-3 text-left font-semibold">Хугацаа</th>
                  <th className="px-4 py-3 text-left font-semibold">Нээгдэх контент</th>
                  <th className="px-4 py-3 text-left font-semibold">Төлөв</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-1.5 font-medium text-foreground">
                        {p.isVip && <Crown size={13} className="text-premium" />}
                        {p.name}
                      </p>
                      {p.description && (
                        <p className="truncate text-xs text-muted-foreground">{p.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{formatPrice(p.price)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.durationDays} хоног</td>
                    <td className="max-w-xs px-4 py-3">
                      {p.isVip ? (
                        <span className="rounded-md bg-premium/15 px-2 py-0.5 text-xs font-medium text-premium">
                          Бүх контент
                        </span>
                      ) : p.genres.length ? (
                        <div className="flex flex-wrap gap-1">
                          {p.genres.map((g) => (
                            <span
                              key={g.id}
                              className={cn(
                                'rounded-md px-2 py-0.5 text-xs',
                                g.isAdult ? 'bg-destructive/15 text-destructive' : 'bg-accent text-muted-foreground',
                              )}
                            >
                              {g.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-destructive">⚠️ Жанр сонгоогүй</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(p)}
                        className={cn(
                          'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                          p.isActive
                            ? 'bg-success/15 text-success hover:bg-success/25'
                            : 'bg-muted text-muted-foreground hover:bg-accent',
                        )}
                      >
                        {p.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          aria-label="Засах"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => remove(p)}
                          aria-label="Устгах"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isLoading && !data?.length && <TableEmptyState icon={Wallet} message="Багц байхгүй байна" />}
        </div>
      </main>

      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing === 'new' ? 'Шинэ багц' : 'Багц засах'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <Field label="Багцын нэр">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="ж: Монгол кино багц"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </Field>

              <Field label="Тайлбар (заавал биш)">
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </Field>

              <div className="flex gap-3">
                <Field label="Үнэ (₮)" className="flex-1">
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Дараалал" className="w-24">
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </Field>
              </div>

              <Field label="Хугацаа (хоног)">
                <div className="flex flex-wrap gap-1.5">
                  {DURATION_PRESETS.map((d) => (
                    <button
                      key={d.days}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, durationDays: String(d.days) }))}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                        Number(form.durationDays) === d.days
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-accent text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                  <input
                    type="number"
                    value={form.durationDays}
                    onChange={(e) => setForm((f) => ({ ...f, durationDays: e.target.value }))}
                    className="w-20 rounded-md border border-input bg-card px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
              </Field>

              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-premium/30 bg-premium/8 p-3">
                <input
                  type="checkbox"
                  checked={form.isVip}
                  onChange={(e) => setForm((f) => ({ ...f, isVip: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Crown size={14} className="text-premium" /> VIP багц
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Бүх жанрын контент нээгдэнэ (18+ хамт). Жанр сонгох шаардлагагүй.
                  </span>
                </span>
              </label>

              {!form.isVip && (
                <Field label={`Нээгдэх жанрууд (${form.genreIds.length} сонгосон)`}>
                  <div className="flex flex-wrap gap-1.5 rounded-lg border border-input bg-card p-2.5">
                    {genres?.map((g) => {
                      const active = form.genreIds.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGenre(g.id)}
                          className={cn(
                            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                            active
                              ? g.isAdult
                                ? 'bg-destructive text-white'
                                : 'bg-primary text-primary-foreground'
                              : 'bg-accent text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {g.isAdult && '🔞 '}
                          {g.name}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}

              <Field label="Онцлогууд (таслалаар)">
                <input
                  value={form.features}
                  onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </Field>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-input"
                />
                Идэвхтэй (сайтад харагдана)
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

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
