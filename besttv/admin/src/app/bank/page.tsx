'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Check,
  Clock,
  Copy,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatPrice } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { ImageUpload } from '@/components/image-upload';
import { TableEmptyState } from '@/components/table-empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { AdminErrorState } from '@/components/admin-error-state';
import { api } from '@/lib/api';
import { runMutation } from '@/lib/mutate';
import {
  useAdminBankAccounts,
  useAdminBankPayments,
  useAdminBankSettings,
  type AdminBankAccount,
  type AdminBankPayment,
} from '@/lib/queries';

/**
 * ДАНСНЫ ТӨЛБӨР — ГАРААР БАТАЛГААЖУУЛАХ.
 *
 * ⚠️⚠️ ХЭРЭГЛЭГЧ МӨНГӨӨ ШИЛЖҮҮЛЧИХСЭН ХҮЛЭЭЖ БАЙНА. Энэ хуудас
 * хурдан ажиллах ёстой: гүйлгээний утга ХАМГИЙН ТОД, баримтын зураг
 * шууд харагдана, баталгаажуулах товч нэг дарахад ажиллана.
 */

type Tab = 'pending' | 'waiting' | 'all' | 'accounts';

const TAB_LABEL: Record<Tab, string> = {
  pending: 'Шалгах хүлээж буй',
  waiting: 'Шилжүүлээгүй',
  all: 'Бүх төлбөр',
  accounts: 'Данснууд',
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Хүлээгдэж буй', cls: 'bg-premium/15 text-premium' },
  PAID: { label: 'Баталгаажсан', cls: 'bg-success/15 text-success' },
  CANCELLED: { label: 'Татгалзсан', cls: 'bg-destructive/12 text-destructive' },
  EXPIRED: { label: 'Хугацаа дууссан', cls: 'bg-foreground/8 text-foreground/40' },
  FAILED: { label: 'Амжилтгүй', cls: 'bg-destructive/12 text-destructive' },
};

function ago(iso: string | null): string {
  if (!iso) return '—';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'Яг одоо';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цаг`;
  return `${Math.floor(h / 24)} өдөр`;
}

export default function BankPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const { data, isLoading, isError, error, refetch } = useAdminBankPayments(
    tab === 'all' || tab === 'accounts' ? undefined : tab,
  );
  const { data: settings } = useAdminBankSettings();
  const { data: accounts } = useAdminBankAccounts();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editAccount, setEditAccount] = useState<AdminBankAccount | 'new' | null>(null);
  /** ⚠️ Баримтын зургийг ТОМООР харах — жижиг зурагнаас дүн уншигдахгүй */
  const [zoom, setZoom] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data ?? [];
    return (data ?? []).filter(
      (p) =>
        p.bankReference?.toLowerCase().includes(needle) ||
        p.user?.email.toLowerCase().includes(needle) ||
        p.user?.name?.toLowerCase().includes(needle) ||
        String(p.amount).includes(needle),
    );
  }, [data, q]);

  const approve = async (p: AdminBankPayment) => {
    const ok = await confirm({
      title: `${formatPrice(p.amount)} баталгаажуулах уу?`,
      description: `«${p.bankReference}» гүйлгээ банкны хуулгад ОРСОН эсэхийг шалгасан уу?`,
      bullets: [
        `${p.user?.email ?? '—'} — ${p.plan?.name ?? (p.isWalletTopup ? 'Хэтэвч цэнэглэх' : '—')}`,
        'Баталгаажмагц эрх нь ШУУД нээгдэнэ (буцаах боломжгүй)',
      ],
      confirmLabel: 'Баталгаажуулах',
      tone: 'warning',
    });
    if (!ok) return;

    setBusy(p.id);
    await runMutation(() => api(`/admin/bank/payments/${p.id}/approve`, { method: 'POST' }), {
      success: 'Баталгаажлаа — эрх нээгдэж, хэрэглэгчид мэдэгдэв',
      onDone: () => {
        qc.invalidateQueries({ queryKey: ['admin-bank-payments'] });
        setBusy(null);
      },
    });
  };

  const reject = async (p: AdminBankPayment) => {
    /* ⚠️ Шалтгаан ЗААВАЛ — хэрэглэгчид мэдэгдэл+имэйлээр очно */
    const reason = window.prompt(
      `«${p.bankReference}» төлбөрийг татгалзах шалтгаан:`,
      'Гүйлгээ банкны хуулгад олдсонгүй',
    );
    if (!reason?.trim()) return;

    setBusy(p.id);
    await runMutation(
      () =>
        api(`/admin/bank/payments/${p.id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason: reason.trim() }),
        }),
      {
        success: 'Татгалзлаа — хэрэглэгчид мэдэгдэв',
        onDone: () => {
          qc.invalidateQueries({ queryKey: ['admin-bank-payments'] });
          setBusy(null);
        },
      },
    );
  };

  const removeAccount = async (a: AdminBankAccount) => {
    const ok = await confirm({
      title: `«${a.bankName}» данс устгах уу?`,
      description:
        a._count.payments > 0
          ? `Энэ данс руу ${a._count.payments} төлбөр хийгдсэн тул УСТГАХ БОЛОМЖГҮЙ.`
          : 'Энэ данс руу хараахан төлбөр хийгдээгүй байна.',
      bullets:
        a._count.payments > 0
          ? ['Төлбөрийн түүх алдагдана — оронд нь идэвхгүй болгоно уу']
          : ['Хэрэглэгчид энэ данс харагдахгүй болно'],
      tone: 'danger',
    });
    if (!ok) return;
    await runMutation(() => api(`/admin/bank/accounts/${a.id}`, { method: 'DELETE' }), {
      success: 'Данс устгагдлаа',
      onDone: () => qc.invalidateQueries({ queryKey: ['admin-bank-accounts'] }),
    });
  };

  const toggleAccount = async (a: AdminBankAccount) => {
    await runMutation(
      () =>
        api(`/admin/bank/accounts/${a.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !a.isActive }),
        }),
      {
        success: a.isActive ? 'Идэвхгүй боллоо' : 'Идэвхжлээ',
        onDone: () => qc.invalidateQueries({ queryKey: ['admin-bank-accounts'] }),
      },
    );
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Хуулагдлаа');
    } catch {
      toast.info('Гараар хуулна уу');
    }
  };

  const pendingCount = (data ?? []).filter(
    (p) => p.status === 'PENDING' && p.bankClaimedAt,
  ).length;
  const activeAccounts = (accounts ?? []).filter((a) => a.isActive).length;

  return (
    <AdminShell>
      <AdminTopbar
        title="Дансны төлбөр"
        subtitle={
          settings?.enabled
            ? `${activeAccounts} идэвхтэй данс`
            : 'Дансаар төлөх идэвхгүй байна'
        }
      />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        {/*
          ⚠️⚠️ УНТРААЛТТАЙ ҮЕД ЮУ ХИЙХИЙГ ЗААНА — зөвхөн «унтраалттай»
          гэж хэлэх нь хангалтгүй, админ энэ хуудас юунд зориулагдсаныг
          ойлгохгүй хоосон хүснэгт хараад эргэлзэнэ.
        */}
        {settings && !settings.enabled && (
          <div className="mb-5 rounded-xl border border-premium/30 bg-premium/8 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-premium">
                  Дансаар төлөх боломж унтраалттай байна
                </p>
                <p className="mt-1 text-sm text-foreground/60">
                  {activeAccounts === 0
                    ? 'Эхлээд «Данснууд» табаас банкны данс нэмнэ үү, дараа нь энэ боломжийг асаана.'
                    : 'Тохиргооноос асаахад хэрэглэгчид багцын хуудсанд «Дансаар шилжүүлэх» товч харагдана.'}
                </p>
              </div>
              <button
                onClick={() => (activeAccounts === 0 ? setTab('accounts') : setShowSettings(true))}
                className="shrink-0 rounded-lg bg-premium-solid px-3.5 py-2 text-sm font-bold text-premium-foreground transition-transform hover:scale-[1.02]"
              >
                {activeAccounts === 0 ? 'Данс нэмэх' : 'Асаах'}
              </button>
            </div>

            <div className="mt-3.5 grid gap-2 border-t border-premium/20 pt-3 sm:grid-cols-3">
              {[
                {
                  n: '1',
                  t: 'Хэрэглэгч шилжүүлнэ',
                  d: 'Банкаа сонгоод 6 оронтой гүйлгээний утгаар мөнгө шилжүүлж, баримтаа хавсаргана',
                },
                {
                  n: '2',
                  t: 'Танд мэдэгдэнэ',
                  d: '«Шилжүүлсэн» дармагц энд гарч, Telegram-д мэдэгдэл ирнэ',
                },
                {
                  n: '3',
                  t: 'Та баталгаажуулна',
                  d: 'Баримт + банкны хуулгаас шалгаад «Батлах» дарахад эрх нээгдэж, хэрэглэгчид мэдэгдэнэ',
                },
              ].map((s) => (
                <div key={s.n} className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded bg-premium-solid text-[11px] font-black text-premium-foreground">
                    {s.n}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground/80">{s.t}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg bg-foreground/5 p-1">
            {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  tab === t
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {TAB_LABEL[t]}
                {t === 'pending' && pendingCount > 0 && (
                  <span className="rounded-full bg-premium px-1.5 text-[10px] font-black text-premium-foreground">
                    {pendingCount}
                  </span>
                )}
                {t === 'accounts' && (accounts?.length ?? 0) > 0 && (
                  <span className="rounded-full bg-foreground/12 px-1.5 text-[10px] font-bold text-foreground/60">
                    {accounts?.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab !== 'accounts' && (
            <div className="relative min-w-40 flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Гүйлгээний утга, имэйл, дүнгээр хайх…"
                className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          )}

          {tab === 'accounts' ? (
            <button
              onClick={() => setEditAccount('new')}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
            >
              <Plus size={15} />
              Данс нэмэх
            </button>
          ) : (
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium text-foreground/75 transition-colors hover:border-primary/40"
            >
              <Settings2 size={15} />
              Тохиргоо
            </button>
          )}
        </div>

        {/* ══════════ ДАНСНУУД ══════════ */}
        {tab === 'accounts' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(accounts ?? []).length === 0 ? (
              <div className="col-span-full overflow-hidden rounded-xl border border-foreground/10">
                <TableEmptyState
                  icon={Building2}
                  message="Данс байхгүй байна"
                  description="Банкны данс нэмбэл хэрэглэгчид дансаар шилжүүлж багц авах боломжтой болно."
                />
              </div>
            ) : (
              (accounts ?? []).map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    'rounded-xl border p-4 transition-colors',
                    a.isActive
                      ? 'border-foreground/12 bg-card'
                      : 'border-foreground/8 bg-card/50 opacity-60',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {a.logoUrl ? (
                        <Image
                          src={a.logoUrl}
                          alt={a.bankName}
                          width={36}
                          height={36}
                          className="size-9 shrink-0 rounded-lg bg-white/90 object-contain p-1"
                        />
                      ) : (
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground/8 text-muted-foreground">
                          <Building2 size={16} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-bold text-foreground">{a.bankName}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {a.accountName}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => void toggleAccount(a)}
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold transition-opacity hover:opacity-75',
                        a.isActive
                          ? 'bg-success/15 text-success'
                          : 'bg-foreground/8 text-foreground/40',
                      )}
                    >
                      {a.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </button>
                  </div>

                  <div className="mt-3 space-y-1.5 rounded-lg bg-foreground/4 p-2.5">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Данс
                      </p>
                      <p className="font-mono text-sm font-semibold tabular-nums text-foreground/90">
                        {a.accountNumber}
                      </p>
                    </div>
                    {a.iban && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          IBAN
                        </p>
                        <p className="truncate font-mono text-xs text-foreground/70">{a.iban}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {a._count.payments} төлбөр
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditAccount(a)}
                        aria-label="Засах"
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => void removeAccount(a)}
                        aria-label="Устгах"
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/12 hover:text-destructive"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* ══════════ ТӨЛБӨРҮҮД ══════════ */
          <div className="overflow-hidden rounded-xl border border-foreground/10">
            {isLoading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : isError ? (
              <AdminErrorState error={error} onRetry={() => void refetch()} />
            ) : rows.length === 0 ? (
              <TableEmptyState
                icon={Building2}
                message={
                  q
                    ? 'Хайлтад тохирох төлбөр олдсонгүй'
                    : tab === 'pending'
                      ? 'Шалгах төлбөр байхгүй'
                      : 'Дансны төлбөр байхгүй'
                }
                description={
                  tab === 'pending'
                    ? 'Хэрэглэгч «шилжүүлсэн» гэж мэдэгдсэн төлбөр энд харагдана.'
                    : 'Хэрэглэгчид дансаар шилжүүлбэл энд бүртгэгдэнэ.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-200 text-sm">
                  <thead>
                    <tr className="border-b border-foreground/10 bg-foreground/4 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-semibold">Утга</th>
                      <th className="px-4 py-2.5 font-semibold">Баримт</th>
                      <th className="px-4 py-2.5 font-semibold">Хэрэглэгч</th>
                      <th className="px-4 py-2.5 font-semibold">Юуны төлөө</th>
                      <th className="px-4 py-2.5 font-semibold">Дүн</th>
                      <th className="px-4 py-2.5 font-semibold">Төлөв</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.PENDING;
                      const canAct = p.status === 'PENDING';
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-foreground/6 transition-colors last:border-0 hover:bg-foreground/3"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-base font-bold tabular-nums text-foreground">
                                {p.bankReference}
                              </span>
                              <button
                                onClick={() => void copy(p.bankReference ?? '')}
                                aria-label="Хуулах"
                                className="rounded p-1 text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock size={10} />
                              {p.bankClaimedAt
                                ? `${ago(p.bankClaimedAt)} өмнө мэдэгдсэн`
                                : 'Шилжүүлээгүй'}
                            </p>
                            {p.bankAccount && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                → {p.bankAccount.bankName}
                              </p>
                            )}
                          </td>

                          {/*
                            ⚠️⚠️ БАРИМТЫН ЗУРАГ — админ банкны хуулга
                            уншихгүйгээр дүн/цагийг шууд харна. Дарахад
                            томроно (жижигээр уншигдахгүй).
                          */}
                          <td className="px-4 py-3">
                            {p.receiptUrl ? (
                              <button
                                onClick={() => setZoom(p.receiptUrl)}
                                className="group relative block size-12 overflow-hidden rounded-lg border border-foreground/12"
                              >
                                <Image
                                  src={p.receiptUrl}
                                  alt="Баримт"
                                  fill
                                  sizes="48px"
                                  className="object-cover transition-transform group-hover:scale-110"
                                />
                              </button>
                            ) : (
                              <span
                                title="Хэрэглэгч баримт хавсаргаагүй"
                                className="flex size-12 items-center justify-center rounded-lg border border-dashed border-foreground/15 text-muted-foreground"
                              >
                                <ImageIcon size={15} />
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{p.user?.name ?? '—'}</p>
                            <p className="text-xs text-muted-foreground">{p.user?.email}</p>
                          </td>

                          <td className="px-4 py-3 text-foreground/75">
                            {p.isWalletTopup ? 'Хэтэвч цэнэглэх' : (p.plan?.name ?? '—')}
                            {p.couponCode && (
                              <span className="ml-1.5 rounded bg-foreground/8 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {p.couponCode}
                              </span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="font-bold tabular-nums text-foreground">
                              {formatPrice(p.amount)}
                            </span>
                            {p.originalAmount != null && p.originalAmount > p.amount && (
                              <span className="ml-1.5 text-xs text-muted-foreground line-through">
                                {formatPrice(p.originalAmount)}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', st.cls)}
                            >
                              {st.label}
                            </span>
                            {p.bankRejectReason && (
                              <p className="mt-1 max-w-40 text-[11px] text-destructive">
                                {p.bankRejectReason}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {canAct ? (
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => void approve(p)}
                                  disabled={busy === p.id}
                                  className="flex items-center gap-1 rounded-lg bg-success/15 px-2.5 py-1.5 text-xs font-bold text-success transition-colors hover:bg-success/25 disabled:opacity-50"
                                >
                                  {busy === p.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Check size={12} />
                                  )}
                                  Батлах
                                </button>
                                <button
                                  onClick={() => void reject(p)}
                                  disabled={busy === p.id}
                                  aria-label="Татгалзах"
                                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/12 hover:text-destructive disabled:opacity-50"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <span className="block text-right text-[11px] text-muted-foreground">
                                {p.bankReviewedAt
                                  ? new Date(p.bankReviewedAt).toLocaleDateString('mn-MN')
                                  : ''}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ⚠️ Баримтын ТОМ харагдац — админ дүн/цаг/дансыг уншина */}
      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/85 p-4"
        >
          <Image
            src={zoom}
            alt="Төлбөрийн баримт"
            width={900}
            height={1200}
            className="max-h-[92vh] w-auto rounded-xl object-contain"
          />
          <button
            onClick={() => setZoom(null)}
            aria-label="Хаах"
            className="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white/80 hover:bg-white/20"
          >
            <X size={20} />
          </button>
        </div>
      )}

      <AccountDialog
        account={editAccount}
        onClose={() => setEditAccount(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['admin-bank-accounts'] })}
      />

      <BankSettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['admin-bank-settings'] })}
      />
    </AdminShell>
  );
}

const INPUT =
  'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary';

/** Данс нэмэх/засах цонх */
function AccountDialog({
  account,
  onClose,
  onSaved,
}: {
  account: AdminBankAccount | 'new' | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    bankName: '',
    logoKey: '',
    logoUrl: '',
    accountNumber: '',
    iban: '',
    accountName: '',
    isActive: true,
    order: '0',
  });
  const [saving, setSaving] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  /* ⚠️ Нээгдэх бүрд утгыг шинэчилнэ — өмнөх дансны утга үлдэхээс сэргийлнэ */
  const key = account === 'new' ? 'new' : (account?.id ?? null);
  if (account && key !== loadedId) {
    setLoadedId(key);
    setForm(
      account === 'new'
        ? {
            bankName: '',
            logoKey: '',
            logoUrl: '',
            accountNumber: '',
            iban: '',
            accountName: '',
            isActive: true,
            order: '0',
          }
        : {
            bankName: account.bankName,
            logoKey: account.logoKey ?? '',
            logoUrl: account.logoUrl ?? '',
            accountNumber: account.accountNumber,
            iban: account.iban ?? '',
            accountName: account.accountName,
            isActive: account.isActive,
            order: String(account.order),
          },
    );
  }
  if (!account && loadedId) setLoadedId(null);

  const save = async () => {
    if (!form.bankName.trim() || !form.accountNumber.trim() || !form.accountName.trim()) {
      toast.error('Банк, данс, эзэмшигчийн нэрийг бөглөнө үү');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        bankName: form.bankName,
        logoKey: form.logoKey,
        accountNumber: form.accountNumber,
        iban: form.iban,
        accountName: form.accountName,
        isActive: form.isActive,
        order: Number(form.order) || 0,
      };
      if (account === 'new') {
        await api('/admin/bank/accounts', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Данс нэмэгдлээ');
      } else if (account) {
        await api(`/admin/bank/accounts/${account.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Хадгалагдлаа');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={account !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account === 'new' ? 'Данс нэмэх' : 'Данс засах'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground/70">
              Банкны лого
            </label>
            {/*
              ⚠️ Логотой бол хэрэглэгч дансаа НЭГ ХАРЦААР олно.
              R2 key гараар бичүүлэхгүй — сонгомогц upload, preview.
            */}
            {/* ⚠️ `still` (800px) — лого нь жижиг, `backdrop` (1920px)
                нь дэмий том файл үүсгэнэ */}
            <ImageUpload
              kind="still"
              value={form.logoUrl}
              onChange={(k, url) => setForm((f) => ({ ...f, logoKey: k, logoUrl: url }))}
            />
            {form.logoKey && (
              <button
                onClick={() => setForm({ ...form, logoKey: '', logoUrl: '' })}
                className="mt-1.5 text-[11px] text-destructive hover:underline"
              >
                Лого хасах
              </button>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground/70">
              Банкны нэр *
            </label>
            <input
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              placeholder="Хаан банк"
              className={INPUT}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground/70">
              Дансны дугаар *
            </label>
            <input
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              placeholder="5020959308"
              className={cn(INPUT, 'font-mono')}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground/70">IBAN</label>
            <input
              value={form.iban}
              onChange={(e) => setForm({ ...form, iban: e.target.value })}
              placeholder="MN160005005020959308"
              className={cn(INPUT, 'font-mono')}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              ⚠️ Дансны дугаараас ТУСДАА талбар — хэрэглэгч алийг нь хуулахаа андуурахгүй.
              Зай автоматаар хасагдана.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground/70">
              Эзэмшигчийн нэр *
            </label>
            <input
              value={form.accountName}
              onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              placeholder="БЭСТ ТИВИ ХХК"
              className={INPUT}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground/70">
              Эрэмбэ
            </label>
            <input
              type="number"
              value={form.order}
              onChange={(e) => setForm({ ...form, order: e.target.value })}
              className={INPUT}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Бага нь эхэнд харагдана</p>
          </div>

          <button
            onClick={() => setForm({ ...form, isActive: !form.isActive })}
            className="flex w-full items-center justify-between gap-3 rounded-lg bg-foreground/4 p-3 text-left"
          >
            <span>
              <span className="text-sm font-medium text-foreground/85">Идэвхтэй</span>
              <span className="block text-[11px] text-muted-foreground">
                Унтраавал хэрэглэгчид энэ данс харагдахгүй
              </span>
            </span>
            <span
              className={cn(
                'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                form.isActive ? 'bg-success' : 'bg-foreground/20',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-4 rounded-full bg-white transition-transform',
                  form.isActive ? 'translate-x-4.5' : 'translate-x-0.5',
                )}
              />
            </span>
          </button>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
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
  );
}

/** Нийтлэг тохиргоо */
function BankSettingsDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data } = useAdminBankSettings();
  const [form, setForm] = useState({ enabled: false, note: '', requireReceipt: false });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (open && data && !loaded) {
    setForm(data);
    setLoaded(true);
  }
  if (!open && loaded) setLoaded(false);

  const save = async () => {
    setSaving(true);
    try {
      await api('/admin/bank/settings', { method: 'PATCH', body: JSON.stringify(form) });
      toast.success('Хадгалагдлаа');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Дансаар төлөх тохиргоо</DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground/70">
              Хэрэглэгчид харуулах заавар
            </label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={3}
              className={cn(INPUT, 'resize-none')}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Баталгаажих БОДИТ хугацааг бичих нь гомдол багасгана.
            </p>
          </div>

          <button
            onClick={() => setForm({ ...form, requireReceipt: !form.requireReceipt })}
            className="flex w-full items-center justify-between gap-3 rounded-lg bg-foreground/4 p-3 text-left"
          >
            <span>
              <span className="text-sm font-medium text-foreground/85">Баримт заавал</span>
              <span className="block text-[11px] text-muted-foreground">
                Төлбөрийн зураггүйгээр «шилжүүлсэн» дарж болохгүй болно
              </span>
            </span>
            <span
              className={cn(
                'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                form.requireReceipt ? 'bg-primary' : 'bg-foreground/20',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-4 rounded-full bg-white transition-transform',
                  form.requireReceipt ? 'translate-x-4.5' : 'translate-x-0.5',
                )}
              />
            </span>
          </button>

          <button
            onClick={() => setForm({ ...form, enabled: !form.enabled })}
            className="flex w-full items-center justify-between gap-3 rounded-lg bg-foreground/4 p-3 text-left"
          >
            <span>
              <span className="text-sm font-medium text-foreground/85">
                Дансаар төлөх идэвхтэй
              </span>
              <span className="block text-[11px] text-muted-foreground">
                Унтраавал багцын хуудсанд товч харагдахгүй
              </span>
            </span>
            <span
              className={cn(
                'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                form.enabled ? 'bg-success' : 'bg-foreground/20',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-4 rounded-full bg-white transition-transform',
                  form.enabled ? 'translate-x-4.5' : 'translate-x-0.5',
                )}
              />
            </span>
          </button>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
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
  );
}
