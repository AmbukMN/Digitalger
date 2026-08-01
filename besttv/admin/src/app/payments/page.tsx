'use client';

import { useMemo, useState } from 'react';
import { Ban, Check, CreditCard, Loader2, Ticket, TrendingUp, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatPrice } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { DataToolbar, SortHeader } from '@/components/data-toolbar';
import { Pagination } from '@/components/pagination';
import { api } from '@/lib/api';
import { useAdminPaymentCounts, useAdminPayments, type PaymentFilters } from '@/lib/queries';
import { useNewSince } from '@/lib/use-new-since';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Хүлээгдэж буй',
  PAID: 'Төлөгдсөн',
  FAILED: 'Амжилтгүй',
  EXPIRED: 'Хугацаа дууссан',
  CANCELLED: 'Цуцлагдсан',
};

const EMPTY: PaymentFilters = {
  status: 'ALL',
  search: '',
  from: '',
  to: '',
  minAmount: '',
  maxAmount: '',
  kind: 'ALL',
  sort: 'createdAt',
  dir: 'desc',
  page: 1,
  limit: 20,
};

export default function PaymentsPage() {
  const [f, setF] = useState<PaymentFilters>(EMPTY);
  const [exporting, setExporting] = useState(false);
  /** ⚠️ Хуудас нээгдэх мөчид тэмдэглэсэн — badge цэвэрлэгдсэн ч мөр тэмдэглэгдэнэ */
  const isNew = useNewSince('payments');
  const confirm = useConfirm();
  const qc = useQueryClient();
  /** Давхар дарахаас сэргийлж тухайн мөрийг түр түгжинэ */
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-payments'] });
    qc.invalidateQueries({ queryKey: ['admin-payment-counts'] });
    qc.invalidateQueries({ queryKey: ['admin-badges'] });
  };

  /**
   * Гараар баталгаажуулах — банкаар шилжүүлсэн гэх мэт.
   * ⚠️ Багц/хэтэвч АВТОМАТ идэвхжинэ, имэйл илгээгдэнэ (тусад нь эрх олгох
   * шаардлагагүй).
   */
  const markPaid = async (id: string, label: string, amount: number) => {
    const ok = await confirm({
      title: 'Төлбөрийг баталгаажуулах уу?',
      description: `${label} · ${formatPrice(amount)}`,
      bullets: [
        'Багц/хэтэвч АВТОМАТ идэвхжинэ',
        'Хэрэглэгчид баталгаажуулах имэйл илгээгдэнэ',
      ],
      confirmLabel: 'Баталгаажуулах',
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await api(`/admin/payments/${id}/mark-paid`, { method: 'POST' });
      refresh();
      toast.success('Төлбөр баталгаажиж эрх нээгдлээ');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Цуцлах.
   * ⚠️ ТӨЛӨГДСӨН байсан бол олгогдсон ЭРХ ч хүчингүй болно (хэтэвчийн
   * цэнэглэлт бол дүн буцаан хасагдана).
   */
  const cancelPayment = async (id: string, label: string, wasPaid: boolean) => {
    const ok = await confirm({
      title: 'Төлбөрийг цуцлах уу?',
      description: label,
      bullets: wasPaid
        ? [
            '⚠️ Энэ төлбөрөөр олгогдсон ЭРХ ХҮЧИНГҮЙ болно',
            'Хэтэвчийн цэнэглэлт бол дүн буцаан хасагдана',
          ]
        : ['Хүлээгдэж буй нэхэмжлэл цуцлагдана'],
      confirmLabel: 'Цуцлах',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await api(`/admin/payments/${id}/cancel`, { method: 'POST', body: JSON.stringify({}) });
      refresh();
      toast.success('Төлбөр цуцлагдлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setBusyId(null);
    }
  };

  const { data, isFetching } = useAdminPayments(f);
  const { data: counts } = useAdminPaymentCounts({
    search: f.search,
    from: f.from,
    to: f.to,
    kind: f.kind,
  });

  /** Шүүлт солиход хуудсыг 1 рүү буцаана (эс бөгөөс хоосон хуудас гарна) */
  const set = (patch: Partial<PaymentFilters>) =>
    setF((s) => ({ ...s, ...patch, page: patch.page ?? 1 }));

  /** Идэвхтэй шүүлтийн тоо — "Цэвэрлэх" товч ба badge-д */
  const activeCount = useMemo(() => {
    let n = 0;
    if (f.search) n++;
    if (f.from || f.to) n++;
    if (f.minAmount || f.maxAmount) n++;
    if (f.kind && f.kind !== 'ALL') n++;
    return n;
  }, [f]);

  const toggleSort = (field: string) =>
    set({ sort: field, dir: f.sort === field && f.dir === 'desc' ? 'asc' : 'desc' });

  /** CSV татах — шүүсэн БҮХ мөр (хуудаслалтгүй) */
  const exportCsv = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(f)) {
        if (!v || v === 'ALL' || ['page', 'limit', 'sort', 'dir'].includes(k)) continue;
        qs.set(k, String(v));
      }
      const res = await api<{ csv: string; count: number }>(`/admin/payments/export?${qs}`);
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${res.count} мөр татагдлаа`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Татахад алдаа гарлаа');
    } finally {
      setExporting(false);
    }
  };

  const stats = data?.stats;

  return (
    <AdminShell>
      <AdminTopbar
        title="Төлбөрийн жагсаалт"
        subtitle={data ? `${data.total.toLocaleString()} гүйлгээ` : undefined}
      />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        {/* ── Статистик — ШҮҮЛТЭД тохирсон дүн (зөвхөн энэ хуудас биш) ── */}
        <div className="mb-5 grid gap-3 grid-cols-1 sm:grid-cols-3">
          <StatCard
            icon={<TrendingUp size={18} />}
            label="Төлөгдсөн орлого"
            value={formatPrice(stats?.paidAmount ?? 0)}
            hint={`${(stats?.paidCount ?? 0).toLocaleString()} гүйлгээ`}
            tone="success"
          />
          <StatCard
            icon={<CreditCard size={18} />}
            label="Нийт дүн (бүх төлөв)"
            value={formatPrice(stats?.totalAmount ?? 0)}
            hint={`${(data?.total ?? 0).toLocaleString()} гүйлгээ`}
          />
          <StatCard
            icon={<Wallet size={18} />}
            label="Дундаж дүн"
            value={formatPrice(
              stats?.paidCount ? Math.round(stats.paidAmount / stats.paidCount) : 0,
            )}
            hint="төлөгдсөн гүйлгээнд"
          />
        </div>

        <DataToolbar
          search={f.search ?? ''}
          onSearch={(v) => set({ search: v })}
          searchPlaceholder="Хэрэглэгч, имэйл, QPay дугаараар хайх..."
          tabs={[
            { id: 'ALL', label: 'Бүгд', count: counts?.ALL },
            { id: 'PAID', label: 'Төлөгдсөн', count: counts?.PAID },
            { id: 'PENDING', label: 'Хүлээгдэж буй', count: counts?.PENDING },
            { id: 'FAILED', label: 'Амжилтгүй', count: counts?.FAILED },
            { id: 'EXPIRED', label: 'Хугацаа дууссан', count: counts?.EXPIRED },
          ]}
          activeTab={f.status}
          onTab={(id) => set({ status: id })}
          from={f.from}
          to={f.to}
          onDateRange={(from, to) => set({ from, to })}
          selects={[
            {
              id: 'kind',
              label: 'Төрөл',
              value: f.kind ?? 'ALL',
              options: [
                { value: 'ALL', label: 'Бүгд' },
                { value: 'plan', label: 'Багц худалдан авалт' },
                { value: 'topup', label: 'Хэтэвч цэнэглэлт' },
              ],
              onChange: (v) => set({ kind: v }),
            },
          ]}
          numberRange={{
            label: 'Дүнгийн муж (₮)',
            min: f.minAmount ?? '',
            max: f.maxAmount ?? '',
            onChange: (min, max) => set({ minAmount: min, maxAmount: max }),
          }}
          limit={f.limit}
          onLimit={(n) => set({ limit: n })}
          onExport={exportCsv}
          exporting={exporting}
          activeCount={activeCount}
          onReset={() => setF(EMPTY)}
        />

        <div
          className={cn(
            'admin-card mt-5 overflow-x-auto rounded-xl transition-opacity',
            isFetching && 'opacity-60',
          )}
        >
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-accent/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Хэрэглэгч</th>
                <th className="px-4 py-3 text-left font-semibold">Төрөл / Багц</th>
                <SortHeader
                  label="Дүн"
                  field="amount"
                  sort={f.sort ?? 'createdAt'}
                  dir={f.dir ?? 'desc'}
                  onSort={toggleSort}
                  align="right"
                />
                <th className="px-4 py-3 text-left font-semibold">Төлөв</th>
                <SortHeader
                  label="Үүссэн"
                  field="createdAt"
                  sort={f.sort ?? 'createdAt'}
                  dir={f.dir ?? 'desc'}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Төлсөн"
                  field="paidAt"
                  sort={f.sort ?? 'createdAt'}
                  dir={f.dir ?? 'desc'}
                  onSort={toggleSort}
                />
                <th className="px-4 py-3 text-right font-semibold">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.items.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <p className="flex items-center font-medium text-foreground">
                      <span className="truncate">{p.user.name ?? p.user.email}</span>
                      {isNew(p.paidAt ?? p.createdAt) && (
                        <span className="ml-1.5 shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
                          шинэ
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {p.isWalletTopup ? (
                      <span className="inline-flex items-center gap-1.5 text-primary">
                        <Wallet size={13} /> Хэтэвч цэнэглэлт
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{p.plan?.name ?? '—'}</span>
                    )}
                    {p.couponCode && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded bg-premium/15 px-1.5 py-0.5 text-[10px] font-semibold text-premium">
                        <Ticket size={10} /> {p.couponCode}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-foreground">{formatPrice(p.amount)}</span>
                    {p.originalAmount != null && p.originalAmount > p.amount && (
                      <p className="text-[11px] text-muted-foreground line-through">
                        {formatPrice(p.originalAmount)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-medium',
                        p.status === 'PAID' && 'bg-success/15 text-success',
                        p.status === 'PENDING' && 'bg-warning/15 text-warning',
                        (p.status === 'FAILED' || p.status === 'CANCELLED') &&
                          'bg-destructive/15 text-destructive',
                        p.status === 'EXPIRED' && 'bg-muted text-muted-foreground',
                      )}
                    >
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleString('mn-MN')}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {p.paidAt ? new Date(p.paidAt).toLocaleString('mn-MN') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {busyId === p.id ? (
                        <Loader2 size={15} className="animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          {p.status !== 'PAID' && p.status !== 'CANCELLED' && (
                            <button
                              onClick={() =>
                                markPaid(
                                  p.id,
                                  p.isWalletTopup ? 'Хэтэвч цэнэглэлт' : (p.plan?.name ?? 'Багц'),
                                  p.amount,
                                )
                              }
                              title="Гараар баталгаажуулах"
                              aria-label="Баталгаажуулах"
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-success/15 hover:text-success"
                            >
                              <Check size={15} />
                            </button>
                          )}
                          {p.status !== 'CANCELLED' && (
                            <button
                              onClick={() =>
                                cancelPayment(
                                  p.id,
                                  `${p.user.name ?? p.user.email} · ${formatPrice(p.amount)}`,
                                  p.status === 'PAID',
                                )
                              }
                              title="Цуцлах"
                              aria-label="Цуцлах"
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                            >
                              <Ban size={15} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.items.length && !isFetching && (
            <TableEmptyState
              icon={CreditCard}
              message={activeCount > 0 ? 'Шүүлтэд тохирох төлбөр олдсонгүй' : 'Төлбөр байхгүй байна'}
            />
          )}
        </div>

        <Pagination
          page={data?.page ?? 1}
          totalPages={data?.totalPages ?? 1}
          total={data?.total}
          limit={data?.limit}
          onPage={(p) => setF((s) => ({ ...s, page: p }))}
        />
      </main>
    </AdminShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'success';
}) {
  return (
    <div className="admin-card rounded-xl p-4">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            tone === 'success' ? 'bg-success/12 text-success' : 'bg-primary/12 text-primary',
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
