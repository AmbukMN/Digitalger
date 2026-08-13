'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  Gift,
  Loader2,
  Pencil,
  Percent,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatPrice } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { AdminErrorState } from '@/components/admin-error-state';
import { api } from '@/lib/api';
import { runMutation } from '@/lib/mutate';
import {
  useAdminPromotions,
  useAdminPlans,
  type AdminPromotion,
  type PromotionType,
} from '@/lib/queries';

/**
 * УРАМШУУЛЛЫН УДИРДЛАГА.
 *
 * ⚠️ Купоноос ЯЛГААТАЙ: купон нь код бичиж идэвхжүүлдэг, урамшуулал нь
 * АВТОМАТААР үйлчилж багцын карт дээр харагддаг. Тиймээс энд «хэдэн
 * хүн ашигласан», «хэдэн төгрөг өгсөн» гэсэн үр дүн чухал.
 */

const TYPE_LABEL: Record<PromotionType, string> = {
  EXTRA_DAYS: 'Нэмэлт хоног',
  DISCOUNT: 'Хямдрал',
  GIFT_PLAN: 'Бэлэг багц',
  WALLET_BONUS: 'Хэтэвчийн бонус',
};

const TYPE_ICON: Record<PromotionType, typeof Gift> = {
  EXTRA_DAYS: CalendarClock,
  DISCOUNT: Percent,
  GIFT_PLAN: Gift,
  WALLET_BONUS: Wallet,
};

interface FormState {
  name: string;
  shortText: string;
  description: string;
  type: PromotionType;
  bonusDays: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: string;
  giftPlanId: string;
  giftDays: string;
  minTopup: string;
  bonusAmount: string;
  planIds: string[];
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  maxUses: string;
  maxPerUser: string;
  newUsersOnly: boolean;
  blockCoupons: boolean;
  bannerKey: string;
  bannerMobileKey: string;
  order: string;
}

/** ⚠️ Огноо `datetime-local` формат — «2026-08-13T09:00» */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY: FormState = {
  name: '',
  shortText: '',
  description: '',
  type: 'EXTRA_DAYS',
  bonusDays: '30',
  discountType: 'PERCENT',
  discountValue: '',
  giftPlanId: '',
  giftDays: '',
  minTopup: '',
  bonusAmount: '',
  planIds: [],
  startsAt: toLocalInput(new Date()),
  /* ⚠️ Анхдагч 30 хоног — хугацаагүй урамшуулал байж БОЛОХГҮЙ
     (мартвал мөнхөд хямдрал өгнө) */
  endsAt: toLocalInput(new Date(Date.now() + 30 * 86_400_000)),
  isActive: true,
  maxUses: '',
  maxPerUser: '1',
  newUsersOnly: false,
  blockCoupons: false,
  bannerKey: '',
  bannerMobileKey: '',
  order: '0',
};

type Status = 'live' | 'scheduled' | 'expired' | 'used-up' | 'off';

/**
 * ⚠️⚠️ БОДИТ төлөв — `isActive` дангаараа ХУДАЛ хэлдэг.
 *
 * Хугацаа нь эхлээгүй / өнгөрсөн / хязгаар дүүрсэн урамшуулал DB-д
 * `isActive: true` хэвээр үлддэг. Админ «идэвхтэй» гэж хараад
 * хэрэглэгчид харагдахгүй байгаад гайхна.
 */
function statusOf(p: AdminPromotion): Status {
  if (!p.isActive) return 'off';
  const now = Date.now();
  if (new Date(p.startsAt).getTime() > now) return 'scheduled';
  if (new Date(p.endsAt).getTime() < now) return 'expired';
  if (p.maxUses != null && p.usedCount >= p.maxUses) return 'used-up';
  return 'live';
}

const STATUS_LABEL: Record<Status, string> = {
  live: 'Явагдаж байна',
  scheduled: 'Товлосон',
  expired: 'Дууссан',
  'used-up': 'Хязгаар дүүрсэн',
  off: 'Идэвхгүй',
};

const STATUS_CLASS: Record<Status, string> = {
  live: 'bg-success/15 text-success',
  scheduled: 'bg-primary/15 text-primary',
  expired: 'bg-foreground/8 text-foreground/40',
  'used-up': 'bg-premium/15 text-premium',
  off: 'bg-foreground/8 text-foreground/40',
};

/** Урамшууллын утгыг хүнд ойлгомжтой нэг мөрөөр */
function valueText(p: AdminPromotion): string {
  switch (p.type) {
    case 'EXTRA_DAYS':
      return `+${p.bonusDays} хоног`;
    case 'DISCOUNT':
      return p.discountType === 'PERCENT'
        ? `${p.discountValue}% хямдрал`
        : `${formatPrice(p.discountValue ?? 0)} хямдрал`;
    case 'GIFT_PLAN':
      return p.giftPlan ? `«${p.giftPlan.name}» бэлэг` : 'Бэлэг багц';
    case 'WALLET_BONUS':
      return `${formatPrice(p.minTopup ?? 0)}+ → +${formatPrice(p.bonusAmount ?? 0)}`;
  }
}

export default function PromotionsPage() {
  const { data, isLoading, isError, error, refetch } = useAdminPromotions();
  const { data: plans } = useAdminPlans();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<AdminPromotion | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | Status>('');
  const [type, setType] = useState<'' | PromotionType>('');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((p) => {
      if (status && statusOf(p) !== status) return false;
      if (type && p.type !== type) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) || p.shortText.toLowerCase().includes(needle)
      );
    });
  }, [data, q, status, type]);

  /* ⚠️ Статистик — админ нэг харцаар байдлыг мэдэх ёстой */
  const stats = useMemo(() => {
    const all = data ?? [];
    return {
      live: all.filter((p) => statusOf(p) === 'live').length,
      scheduled: all.filter((p) => statusOf(p) === 'scheduled').length,
      totalUsed: all.reduce((s, p) => s + p.usedCount, 0),
      totalPeople: all.reduce((s, p) => s + p._count.redemptions, 0),
    };
  }, [data]);

  const openEdit = (p: AdminPromotion | 'new') => {
    setEditing(p);
    setForm(
      p === 'new'
        ? EMPTY
        : {
            name: p.name,
            shortText: p.shortText,
            description: p.description,
            type: p.type,
            bonusDays: p.bonusDays != null ? String(p.bonusDays) : '',
            discountType: p.discountType ?? 'PERCENT',
            discountValue: p.discountValue != null ? String(p.discountValue) : '',
            giftPlanId: p.giftPlanId ?? '',
            giftDays: p.giftDays != null ? String(p.giftDays) : '',
            minTopup: p.minTopup != null ? String(p.minTopup) : '',
            bonusAmount: p.bonusAmount != null ? String(p.bonusAmount) : '',
            planIds: p.plans.map((x) => x.planId),
            startsAt: toLocalInput(new Date(p.startsAt)),
            endsAt: toLocalInput(new Date(p.endsAt)),
            isActive: p.isActive,
            maxUses: p.maxUses != null ? String(p.maxUses) : '',
            maxPerUser: String(p.maxPerUser),
            newUsersOnly: p.newUsersOnly,
            blockCoupons: p.blockCoupons,
            bannerKey: p.bannerKey ?? '',
            bannerMobileKey: p.bannerMobileKey ?? '',
            order: String(p.order),
          },
    );
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Нэрийг бөглөнө үү');
      return;
    }
    /* ⚠️ Төрөл бүрийн заавал талбарыг ЭНД шалгана — backend ч шалгана,
       гэхдээ энд шалгавал хэрэглэгч алдааг шууд харна */
    if (form.type === 'EXTRA_DAYS' && !form.bonusDays) {
      toast.error('Хэдэн хоног нэмэхийг заана уу');
      return;
    }
    if (form.type === 'DISCOUNT' && !form.discountValue) {
      toast.error('Хямдралын хэмжээг заана уу');
      return;
    }
    if (form.type === 'GIFT_PLAN' && !form.giftPlanId) {
      toast.error('Бэлэг багцыг сонгоно уу');
      return;
    }
    if (form.type === 'WALLET_BONUS' && (!form.minTopup || !form.bonusAmount)) {
      toast.error('Доод дүн болон бонусыг бөглөнө үү');
      return;
    }

    setSaving(true);
    try {
      /**
       * ⚠️ Төрөлд ХАМААРАЛГҮЙ талбарыг `undefined` илгээнэ — хуучин
       * утга үлдвэл төрөл солиход хуучин хямдрал дагаж ажиллана.
       */
      const payload = {
        name: form.name,
        shortText: form.shortText,
        description: form.description,
        type: form.type,
        bonusDays: form.type === 'EXTRA_DAYS' ? Number(form.bonusDays) : undefined,
        discountType: form.type === 'DISCOUNT' ? form.discountType : undefined,
        discountValue: form.type === 'DISCOUNT' ? Number(form.discountValue) : undefined,
        giftPlanId: form.type === 'GIFT_PLAN' ? form.giftPlanId : undefined,
        giftDays: form.type === 'GIFT_PLAN' && form.giftDays ? Number(form.giftDays) : undefined,
        minTopup: form.type === 'WALLET_BONUS' ? Number(form.minTopup) : undefined,
        bonusAmount: form.type === 'WALLET_BONUS' ? Number(form.bonusAmount) : undefined,
        planIds: form.planIds,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        isActive: form.isActive,
        maxUses: form.maxUses ? Number(form.maxUses) : undefined,
        maxPerUser: Number(form.maxPerUser) || 1,
        newUsersOnly: form.newUsersOnly,
        blockCoupons: form.blockCoupons,
        bannerKey: form.bannerKey || undefined,
        bannerMobileKey: form.bannerMobileKey || undefined,
        order: Number(form.order) || 0,
      };

      if (editing === 'new') {
        await api('/admin/promotions', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Урамшуулал нэмэгдлээ');
      } else if (editing) {
        await api(`/admin/promotions/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Хадгалагдлаа');
      }
      qc.invalidateQueries({ queryKey: ['admin-promotions'] });
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: AdminPromotion) => {
    const used = p._count.redemptions;
    const ok = await confirm({
      title: `«${p.name}» урамшууллыг устгах уу?`,
      description:
        used > 0
          ? `Энэ урамшууллыг ${used} хүн ашигласан тул УСТГАХ БОЛОМЖГҮЙ. Оронд нь идэвхгүй болгоно уу.`
          : 'Энэ урамшууллыг хараахан хэн ч ашиглаагүй байна.',
      bullets:
        used > 0
          ? ['Ашиглалтын түүх алдагдана — санхүүгийн баталгаа үгүй болно']
          : ['Багцын карт дээрх урамшуулал алга болно'],
      tone: 'danger',
    });
    if (!ok) return;
    await runMutation(() => api(`/admin/promotions/${p.id}`, { method: 'DELETE' }), {
      success: 'Урамшуулал устгагдлаа',
      onDone: () => qc.invalidateQueries({ queryKey: ['admin-promotions'] }),
    });
  };

  const toggleActive = async (p: AdminPromotion) => {
    await runMutation(
      () =>
        api(`/admin/promotions/${p.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !p.isActive }),
        }),
      {
        success: p.isActive ? 'Идэвхгүй боллоо' : 'Идэвхжлээ',
        onDone: () => qc.invalidateQueries({ queryKey: ['admin-promotions'] }),
      },
    );
  };

  return (
    <AdminShell>
      <AdminTopbar
        title="Урамшуулал"
        subtitle={data ? `Нийт ${data.length} урамшуулал` : undefined}
      />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        {/* ⚠️ «Шинэ» товч ЭНД (topbar-д action байхгүй) */}
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => openEdit('new')}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
          >
            <Plus size={15} />
            Шинэ урамшуулал
          </button>
        </div>

        {/* ─── Статистик ─── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Явагдаж байна', value: stats.live, icon: TrendingUp, tone: 'text-success' },
          { label: 'Товлосон', value: stats.scheduled, icon: CalendarClock, tone: 'text-primary' },
          { label: 'Нийт ашиглалт', value: stats.totalUsed, icon: Gift, tone: 'text-premium' },
          { label: 'Хэрэглэгч', value: stats.totalPeople, icon: Users, tone: 'text-foreground/60' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-foreground/10 bg-foreground/3 p-3.5"
          >
            <div className="flex items-center gap-1.5">
              <s.icon size={14} className={s.tone} />
              <span className="text-xs text-foreground/50">{s.label}</span>
            </div>
            <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Шүүлт ─── */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-50 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Нэрээр хайх…"
            className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as '' | Status)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">Бүх төлөв</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => setType(e.target.value as '' | PromotionType)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">Бүх төрөл</option>
          {(Object.keys(TYPE_LABEL) as PromotionType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {/* ─── Жагсаалт ─── */}
      <div className="mt-4 overflow-hidden rounded-xl border border-foreground/10">
        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : isError ? (
          <AdminErrorState error={error} onRetry={() => void refetch()} />
        ) : rows.length === 0 ? (
          <TableEmptyState
            icon={Gift}
            message={q || status || type ? 'Хайлтад тохирох урамшуулал алга' : 'Урамшуулал байхгүй'}
            description={
              q || status || type
                ? 'Шүүлтээ өөрчилж үзнэ үү'
                : 'Шинэ урамшуулал үүсгэж багцын борлуулалтаа нэмэгдүүлээрэй'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-sm">
              <thead>
                <tr className="border-b border-foreground/10 bg-foreground/4 text-left text-xs uppercase tracking-wide text-foreground/45">
                  <th className="px-4 py-2.5 font-semibold">Урамшуулал</th>
                  <th className="px-4 py-2.5 font-semibold">Утга</th>
                  <th className="px-4 py-2.5 font-semibold">Хугацаа</th>
                  <th className="px-4 py-2.5 font-semibold">Ашиглалт</th>
                  <th className="px-4 py-2.5 font-semibold">Төлөв</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const st = statusOf(p);
                  const Icon = TYPE_ICON[p.type];
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-foreground/6 transition-colors last:border-0 hover:bg-foreground/3"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <Icon size={15} className="mt-0.5 shrink-0 text-premium" />
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">{p.name}</p>
                            {p.shortText && (
                              <p className="mt-0.5 truncate text-xs text-foreground/45">
                                {p.shortText}
                              </p>
                            )}
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="rounded bg-foreground/8 px-1.5 py-0.5 text-[10px] text-foreground/50">
                                {TYPE_LABEL[p.type]}
                              </span>
                              {/* ⚠️ Хамрах хүрээ — «бүх багц» эсэх нь чухал мэдээлэл */}
                              <span className="rounded bg-foreground/8 px-1.5 py-0.5 text-[10px] text-foreground/50">
                                {p.plans.length === 0
                                  ? 'Бүх багц'
                                  : `${p.plans.length} багц`}
                              </span>
                              {p.newUsersOnly && (
                                <span className="rounded bg-primary/12 px-1.5 py-0.5 text-[10px] text-primary">
                                  Шинэ хэрэглэгч
                                </span>
                              )}
                              {p.blockCoupons && (
                                <span className="rounded bg-destructive/12 px-1.5 py-0.5 text-[10px] text-destructive">
                                  Купон хориотой
                                </span>
                              )}
                              {p.bannerKey && (
                                <span className="rounded bg-success/12 px-1.5 py-0.5 text-[10px] text-success">
                                  Баннертай
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-premium">
                        {valueText(p)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-foreground/55">
                        {new Date(p.startsAt).toLocaleDateString('mn-MN')}
                        <br />
                        {new Date(p.endsAt).toLocaleDateString('mn-MN')}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-foreground/70">
                        {p.usedCount}
                        {p.maxUses != null && (
                          <span className="text-muted-foreground"> / {p.maxUses}</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <button
                          onClick={() => void toggleActive(p)}
                          title="Дарж идэвхийг солино"
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-bold transition-opacity hover:opacity-75',
                            STATUS_CLASS[st],
                          )}
                        >
                          {STATUS_LABEL[st]}
                        </button>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            aria-label="Засах"
                            className="rounded-lg p-1.5 text-foreground/40 transition-colors hover:bg-foreground/8 hover:text-foreground"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => void remove(p)}
                            aria-label="Устгах"
                            className="rounded-lg p-1.5 text-foreground/40 transition-colors hover:bg-destructive/12 hover:text-destructive"
                          >
                            <Trash2 size={14} />
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
      </div>

      {/* ─── Засварын цонх ─── */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing === 'new' ? 'Шинэ урамшуулал' : 'Урамшуулал засах'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Field label="Нэр" hint="Хэрэглэгчид харагдана — «Нээлтийн урамшуулал»">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={INPUT}
                placeholder="Нээлтийн урамшуулал"
              />
            </Field>

            <Field
              label="Товч тайлбар"
              hint="Багцын карт дээр гарах НЭГ мөр — «30 хоног аваад 60 хоног үзнэ»"
            >
              <input
                value={form.shortText}
                onChange={(e) => setForm({ ...form, shortText: e.target.value })}
                className={INPUT}
                placeholder="30 хоног аваад 60 хоног үзнэ"
              />
            </Field>

            {/* ─── Төрөл ─── */}
            <Field label="Төрөл">
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(TYPE_LABEL) as PromotionType[]).map((t) => {
                  const Icon = TYPE_ICON[t];
                  return (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, type: t })}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                        form.type === t
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-foreground/12 text-foreground/60 hover:border-foreground/25',
                      )}
                    >
                      <Icon size={15} className={form.type === t ? 'text-primary' : ''} />
                      {TYPE_LABEL[t]}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* ─── Төрлөөс хамаарах талбарууд ─── */}
            {form.type === 'EXTRA_DAYS' && (
              <Field label="Нэмэлт хоног" hint="Багцын хугацаан дээр нэмэгдэнэ. Үнэ өөрчлөгдөхгүй.">
                <input
                  type="number"
                  value={form.bonusDays}
                  onChange={(e) => setForm({ ...form, bonusDays: e.target.value })}
                  className={INPUT}
                  placeholder="30"
                />
              </Field>
            )}

            {form.type === 'DISCOUNT' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Хямдралын төрөл">
                  <select
                    value={form.discountType}
                    onChange={(e) =>
                      setForm({ ...form, discountType: e.target.value as 'PERCENT' | 'FIXED' })
                    }
                    className={INPUT}
                  >
                    <option value="PERCENT">Хувиар (%)</option>
                    <option value="FIXED">Тогтмол дүн (₮)</option>
                  </select>
                </Field>
                <Field
                  label="Хэмжээ"
                  hint={form.discountType === 'PERCENT' ? '1-100 хооронд' : 'Төгрөгөөр'}
                >
                  <input
                    type="number"
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    className={INPUT}
                    placeholder={form.discountType === 'PERCENT' ? '30' : '10000'}
                  />
                </Field>
              </div>
            )}

            {form.type === 'GIFT_PLAN' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Бэлэг багц">
                  <select
                    value={form.giftPlanId}
                    onChange={(e) => setForm({ ...form, giftPlanId: e.target.value })}
                    className={INPUT}
                  >
                    <option value="">— сонгох —</option>
                    {plans?.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Бэлэг багцын хоног" hint="Хоосон бол үндсэн багцтай ижил">
                  <input
                    type="number"
                    value={form.giftDays}
                    onChange={(e) => setForm({ ...form, giftDays: e.target.value })}
                    className={INPUT}
                    placeholder="30"
                  />
                </Field>
              </div>
            )}

            {form.type === 'WALLET_BONUS' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Доод дүн" hint="Энэ дүнгээс дээш цэнэглэвэл">
                  <input
                    type="number"
                    value={form.minTopup}
                    onChange={(e) => setForm({ ...form, minTopup: e.target.value })}
                    className={INPUT}
                    placeholder="50000"
                  />
                </Field>
                <Field label="Бонус" hint="…энэ дүнг нэмж өгнө">
                  <input
                    type="number"
                    value={form.bonusAmount}
                    onChange={(e) => setForm({ ...form, bonusAmount: e.target.value })}
                    className={INPUT}
                    placeholder="10000"
                  />
                </Field>
              </div>
            )}

            {/* ─── Хамрах багц ─── */}
            {form.type !== 'WALLET_BONUS' && (
              <Field label="Хамрах багц" hint="Юу ч сонгохгүй бол БҮХ багцад үйлчилнэ">
                <div className="flex flex-wrap gap-1.5">
                  {plans?.map((pl) => {
                    const on = form.planIds.includes(pl.id);
                    return (
                      <button
                        key={pl.id}
                        onClick={() =>
                          setForm({
                            ...form,
                            planIds: on
                              ? form.planIds.filter((x) => x !== pl.id)
                              : [...form.planIds, pl.id],
                          })
                        }
                        className={cn(
                          'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                          on
                            ? 'border-primary bg-primary/12 text-foreground'
                            : 'border-foreground/12 text-foreground/55 hover:border-foreground/25',
                        )}
                      >
                        {pl.name}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            {/* ─── Хугацаа ─── */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Эхлэх">
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  className={INPUT}
                />
              </Field>
              <Field label="Дуусах" hint="Дуусмагц автоматаар алга болно">
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  className={INPUT}
                />
              </Field>
            </div>

            {/* ─── Хязгаар ─── */}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Нийт хязгаар" hint="Хоосон = хязгааргүй">
                <input
                  type="number"
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                  className={INPUT}
                  placeholder="∞"
                />
              </Field>
              <Field label="Нэг хүн" hint="Ихэвчлэн 1">
                <input
                  type="number"
                  value={form.maxPerUser}
                  onChange={(e) => setForm({ ...form, maxPerUser: e.target.value })}
                  className={INPUT}
                />
              </Field>
              <Field label="Эрэмбэ" hint="Бага нь эхэнд">
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: e.target.value })}
                  className={INPUT}
                />
              </Field>
            </div>

            {/* ─── Баннер ─── */}
            <Field
              label="Баннерын зураг (R2 key)"
              hint="Кино эгнээний дунд гарна. Хоосон бол баннер гарахгүй."
            >
              <input
                value={form.bannerKey}
                onChange={(e) => setForm({ ...form, bannerKey: e.target.value })}
                className={INPUT}
                placeholder="images/banner/xxx.webp"
              />
            </Field>

            {/* ─── Тохиргоо ─── */}
            <div className="space-y-2 rounded-lg bg-foreground/4 p-3">
              <Toggle
                label="Идэвхтэй"
                hint="Унтраавал хэрэглэгчид харагдахгүй"
                value={form.isActive}
                onChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Toggle
                label="Зөвхөн шинэ хэрэглэгчид"
                hint="Өмнө нь багц аваагүй хүнд л үйлчилнэ"
                value={form.newUsersOnly}
                onChange={(v) => setForm({ ...form, newUsersOnly: v })}
              />
              <Toggle
                label="Купон хориглох"
                hint="Энэ урамшууллын үед купон код ашиглах боломжгүй"
                value={form.blockCoupons}
                onChange={(v) => setForm({ ...form, blockCoupons: v })}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 rounded-lg bg-foreground/8 py-2.5 text-sm font-semibold text-foreground/70 transition-colors hover:bg-foreground/12"
              >
                Болих
              </button>
              <button
                onClick={() => void save()}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Хадгалах
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </main>
    </AdminShell>
  );
}

const INPUT =
  'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-foreground/70">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-foreground/40">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span>
        <span className="text-sm font-medium text-foreground/85">{label}</span>
        {hint && <span className="block text-[11px] text-foreground/40">{hint}</span>}
      </span>
      <span
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          value ? 'bg-primary' : 'bg-foreground/20',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white transition-transform',
            value ? 'translate-x-4.5' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}
