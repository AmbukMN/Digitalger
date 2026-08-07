'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Search, Ticket, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { AdminErrorState } from '@/components/admin-error-state';
import { api } from '@/lib/api';
import { runMutation } from '@/lib/mutate';
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

type Status = 'live' | 'expired' | 'used-up' | 'off';

/**
 * ⚠️⚠️ Купоны БОДИТ төлөв — `isActive` дангаараа ХУДАЛ хэлдэг.
 * Хугацаа нь өнгөрсөн эсвэл ашиглалтын хязгаар дүүрсэн купон DB-д
 * `isActive: true` хэвээр үлддэг тул хүснэгтэд "Идэвхтэй" гэж
 * харагдана — гэтэл хэрэглэгч тэр кодыг ашиглаж ЧАДАХГҮЙ.
 * Админ "яагаад ажиллахгүй байна вэ" гэж гайхах гол шалтгаан энэ.
 */
function statusOf(c: AdminCoupon): Status {
  if (!c.isActive) return 'off';
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) return 'expired';
  if (c.maxUses != null && c.usedCount >= c.maxUses) return 'used-up';
  return 'live';
}

const STATUS_LABEL: Record<Status, string> = {
  live: 'Идэвхтэй',
  expired: 'Хугацаа дууссан',
  'used-up': 'Хязгаар дүүрсэн',
  off: 'Идэвхгүй',
};

export default function CouponsPage() {
  const { data, isLoading, isError, error, refetch } = useAdminCoupons();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminCoupon | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | Status>('');
  const confirm = useConfirm();

  /**
   * ⚠️ Шүүлт CLIENT талд — купон ихэвчлэн хэдэн арваар тоологддог тул
   * сервер рүү дахин очих нь илүү удаан (сүлжээний саатал > шүүх хугацаа).
   */
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((c) => {
      if (status && statusOf(c) !== status) return false;
      if (!needle) return true;
      const label = c.discountType === 'PERCENT' ? `${c.amount}%` : `${c.amount}₮`;
      return c.code.toLowerCase().includes(needle) || label.toLowerCase().includes(needle);
    });
  }, [data, q, status]);

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
    /* ⚠️ `runMutation` — өмнө нь try/catch БАЙХГҮЙ байсан тул 403/500
       гарвал toast ч гарахгүй, мөр ч устахгүй (админ болсон гэж бодно) */
    await runMutation(() => api(`/admin/coupons/${c.id}`, { method: 'DELETE' }), {
      success: 'Купон устгагдлаа',
      onDone: () => qc.invalidateQueries({ queryKey: ['admin-coupons'] }),
    });
  };

  const toggleActive = async (c: AdminCoupon) => {
    await runMutation(
      () =>
        api(`/admin/coupons/${c.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !c.isActive }),
        }),
      {
        success: c.isActive ? 'Купон идэвхгүй боллоо' : 'Купон идэвхжлээ',
        onDone: () => qc.invalidateQueries({ queryKey: ['admin-coupons'] }),
      },
    );
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
        {/* ⚠️ Хайлт + төлөвийн шүүлт — өмнө нь ЗӨВХӨН доош гүйлгэж хайх
            боломжтой байв (кампанит ажил бүрд купон нэмэгдсээр байдаг) */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Код, хямдралын дүнгээр хайх…"
              aria-label="Купон хайх"
              className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | Status)}
            aria-label="Төлөвөөр шүүх"
            className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">Бүх төлөв</option>
            <option value="live">Идэвхтэй</option>
            <option value="expired">Хугацаа дууссан</option>
            <option value="used-up">Хязгаар дүүрсэн</option>
            <option value="off">Идэвхгүй</option>
          </select>
          <button
            onClick={() => openEdit('new')}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
          >
            <Plus size={15} /> Купон нэмэх
          </button>
        </div>

        {/* ⚠️ Шүүлтийн үр дүнгийн тоо — хоосон үр дүн нь "дата устсан"
            гэж ойлгогдохгүй байх зорилготой */}
        {(q || status) && (
          <p className="mt-2 text-xs text-muted-foreground">
            {rows.length} / {data?.length ?? 0} купон
          </p>
        )}

        <div className="admin-card mt-4 overflow-hidden rounded-xl">
          {isError ? (
            <AdminErrorState error={error} onRetry={() => void refetch()} />
          ) : isLoading ? (
            /* ⚠️ Spinner БИШ skeleton — төслийн дүрэм (бүтэц урьдчилж
               харагдаж, дата ирэхэд layout үсэрдэггүй) */
            <TableSkeleton rows={6} cols={6} />
          ) : (
            /* ⚠️ Мобайлд хэвтээ гүйлт — 6 багана 375px дэлгэцэнд шахагдаж
               текст давхцдаг байв */
            <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-sm">
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
                {rows.map((c) => {
                  const st = statusOf(c);
                  /* Ажиллахаа больсон купон — админ хараад ШУУД ялгах ёстой */
                  const dead = st !== 'live';
                  return (
                  <tr
                    key={c.id}
                    className={cn(
                      'transition-colors hover:bg-accent/40',
                      /* ⚠️ Бүдэгрүүлэлт нь мөрийг БҮХЭЛД нь хамарна — зөвхөн
                         badge солих нь 6 баганын дунд анзаарагдахгүй өнгөрдөг */
                      dead && 'opacity-55',
                    )}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-foreground">{c.code}</span>
                      {dead && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                          {st === 'off' ? 'Идэвхгүй' : 'Дууссан'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {c.discountType === 'PERCENT' ? `${c.amount}%` : `${c.amount.toLocaleString()}₮`}
                    </td>
                    <td className={cn('px-4 py-3', st === 'used-up' ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                      {c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ''}
                    </td>
                    <td className={cn('px-4 py-3', st === 'expired' ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('mn-MN') : 'Хугацаагүй'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(c)}
                        /* ⚠️ `aria-pressed` — төлөвийг ЗӨВХӨН өнгө/текстээр
                           илэрхийлбэл скрин ридер уншихгүй */
                        aria-pressed={c.isActive}
                        aria-label={c.isActive ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}
                        className={cn(
                          'whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                          st === 'live'
                            ? 'bg-success/15 text-success hover:bg-success/25'
                            : st === 'off'
                              ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                              : 'bg-muted text-muted-foreground hover:bg-accent',
                        )}
                      >
                        {STATUS_LABEL[st]}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* ⚠️ 36px — өмнөх 26px (`p-1.5`+14px) нь хүрэлцэх
                            зөвлөмжөөс хамаагүй бага, таблет дээр устгахыг
                            андуурч дардаг байв */}
                        <button onClick={() => openEdit(c)} aria-label="Засах" className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => remove(c)} aria-label="Устгах" className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
          {!isLoading && !isError && !rows.length && (
            /* ⚠️ Хайлтын үр дүн хоосон БА купон огт байхгүй хоёрыг ЯЛГАНА —
               эс бөгөөс админ "бүх купон устсан" гэж сандарна */
            <TableEmptyState
              icon={Ticket}
              message={q || status ? 'Хайлтад тохирох купон олдсонгүй' : 'Купон байхгүй байна'}
              description={
                q || status
                  ? 'Өөр код эсвэл төлөв сонгож үзнэ үү.'
                  : 'Купон нэмбэл хэрэглэгч төлбөрийн хуудсанд кодоо оруулж хямдрал авна.'
              }
              action={
                q || status ? (
                  <button
                    onClick={() => {
                      setQ('');
                      setStatus('');
                    }}
                    className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    Шүүлт цэвэрлэх
                  </button>
                ) : (
                  <button
                    onClick={() => openEdit('new')}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
                  >
                    <Plus size={15} /> Эхний купон нэмэх
                  </button>
                )
              }
            />
          )}
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
                    Үүсгэх
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
                  <label className="mb-1 block text-xs text-muted-foreground">Хамгийн бага дүн (₮)</label>
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
