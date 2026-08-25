'use client';

import { useMemo, useState } from 'react';
import { TableSkeleton } from '@/components/table-skeleton';
import { Ban, Check, CreditCard, Film, Loader2, Ticket, TrendingUp, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatDateTime, formatPrice } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { StatCard } from '@/components/stat-card';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { AdminErrorState } from '@/components/admin-error-state';
import { DataToolbar, SortHeader } from '@/components/data-toolbar';
import { Pagination } from '@/components/pagination';
import { api } from '@/lib/api';
import { downloadCsv, filtersToQuery } from '@/lib/export-csv';
import { useAdminPaymentCounts, useAdminPayments, type PaymentFilters } from '@/lib/queries';
import { NewBadge } from '@/components/new-badge';
/* ⚠️ Төрлийн badge — /bank хуудастай НЭГ эх сурвалж */
import { PayKindCell, payKindName } from '@/components/pay-kind-badge';
import { ProviderBadge, PROVIDER_OPTIONS } from '@/components/provider-badge';
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
  provider: 'ALL',
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
  /** Амжилтгүй төлбөр — тусдаа section (sidebar-т ч тусад нь тоологддог) */
  const isNewFailed = useNewSince('payments-failed');
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

  const { data, isFetching, isError, error, refetch } = useAdminPayments(f);
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
    if (f.provider && f.provider !== 'ALL') n++;
    return n;
  }, [f]);

  const toggleSort = (field: string) =>
    set({ sort: field, dir: f.sort === field && f.dir === 'desc' ? 'asc' : 'desc' });

  /** CSV татах — шүүсэн БҮХ мөр (хуудаслалтгүй) */
  const exportCsv = async () => {
    setExporting(true);
    /* ⚠️ Blob/URL/toast логик `lib/export-csv.ts`-д НЭГ эх сурвалж */
    await downloadCsv(`/admin/payments/export?${filtersToQuery(f)}`, 'payments');
    setExporting(false);
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
          {/* ⚠️ Орлого = багц/кино/түрээс. Хэтэвч цэнэглэлт ХАСАГДСАН
              (топап дараа багц болвол давхар тоологдоно). Топапыг hint-д
              тусад нь мэдээлнэ. */}
          <StatCard
            layout="stack"
            icon={<TrendingUp size={18} />}
            label="Бодит орлого"
            value={formatPrice(stats?.paidAmount ?? 0)}
            hint={
              stats?.topupAmount
                ? `${(stats?.paidCount ?? 0).toLocaleString()} гүйлгээ · хэтэвч цэнэглэлт хасав`
                : `${(stats?.paidCount ?? 0).toLocaleString()} гүйлгээ`
            }
            tone="success"
          />
          <StatCard
            layout="stack"
            icon={<CreditCard size={18} />}
            label="Нийт дүн (бүх төлөв)"
            value={formatPrice(stats?.totalAmount ?? 0)}
            hint={
              stats?.topupAmount
                ? `${(data?.total ?? 0).toLocaleString()} гүйлгээ · +${formatPrice(stats.topupAmount)} топап`
                : `${(data?.total ?? 0).toLocaleString()} гүйлгээ`
            }
          />
          <StatCard
            layout="stack"
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
                /* ⚠️ Түрээс нь өмнө нь «Багц»-д хамаарч байсан —
                   тусад нь шүүх боломжгүй байв (backend тайлбар үз) */
                { value: 'rental', label: 'Ширхэгээр түрээс' },
                { value: 'topup', label: 'Хэтэвч цэнэглэлт' },
              ],
              onChange: (v) => set({ kind: v }),
            },
            {
              /* ⚠️ Төлбөрийн аргаар шүүх — «картаар хэдэн төлбөр орсон
                 бэ» гэдгийг админ шууд харна */
              id: 'provider',
              label: 'Төлбөрийн арга',
              value: f.provider ?? 'ALL',
              options: [...PROVIDER_OPTIONS],
              onChange: (v) => set({ provider: v }),
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

        {/* ⚠️⚠️ МӨНГӨНИЙ хуудсанд алдааны төлөв ЗААВАЛ — API унахад
            хоосон хүснэгт харагдвал админ "өнөөдөр гүйлгээ ороогүй"
            гэж эндүүрч, бодит орлогыг мэдэхгүй өнгөрнө */}
        {isError ? (
          <div className="mt-5">
            <AdminErrorState error={error} onRetry={() => void refetch()} />
          </div>
        ) : (
        <div
          className={cn(
            'admin-card mt-5 overflow-x-auto rounded-xl transition-opacity',
            isFetching && 'opacity-60',
          )}
        >
          <table className="w-full min-w-215 text-sm">
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
                      {/*
                        ⚠️ Төлөгдсөн ба амжилтгүй төлбөр нь ӨӨР ӨӨР section-тай
                        (`payments` / `payments-failed`) — sidebar-т ч тусад нь
                        тоологддог. Тиймээс мөрийн тэмдэглэгээг ч тухайн
                        төлөвт харгалзах section-оор шалгана, эс бөгөөс
                        амжилтгүй төлбөр "шинэ" гэж хэзээ ч тэмдэглэгдэхгүй.
                      */}
                      {(p.status === 'FAILED'
                        ? isNewFailed(p.createdAt)
                        : isNew(p.paidAt ?? p.createdAt)) && <NewBadge className="ml-1.5" />}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {/* ⚠️ Аль аргаар төлсөн — админ ялгаж харна */}
                    <ProviderBadge provider={p.provider} className="mr-1.5 align-middle" />
                    {/* ⚠️ Төрөл + нэр — /bank хуудастай НЭГ компонент */}
                    <PayKindCell p={p} />
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
                    {formatDateTime(p.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {p.paidAt ? formatDateTime(p.paidAt) : '—'}
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
                                  /* ⚠️ Түрээс бол КИНОНЫ нэр (`pay-kind-badge` тайлбар) */
                                  payKindName(p),
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

          {/* ⚠️ ЭХНИЙ ачаалалт — spinner БИШ skeleton (төслийн дүрэм).
              Дараагийн шүүлтэд хуучин дата `opacity-60`-той үлдэнэ. */}
          {!data && <TableSkeleton rows={8} cols={6} hasAvatar={false} />}
          {!data?.items.length && !isFetching && (
            <TableEmptyState
              icon={CreditCard}
              message={activeCount > 0 ? 'Шүүлтэд тохирох төлбөр олдсонгүй' : 'Төлбөр байхгүй байна'}
            />
          )}
        </div>
        )}

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

