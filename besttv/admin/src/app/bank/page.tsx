'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Check,
  Clock,
  Copy,
  Loader2,
  Search,
  Settings2,
  X,
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
  useAdminBankPayments,
  useAdminBankSettings,
  type AdminBankPayment,
} from '@/lib/queries';

/**
 * ДАНСНЫ ТӨЛБӨР — ГАРААР БАТАЛГААЖУУЛАХ.
 *
 * ⚠️⚠️ ХЭРЭГЛЭГЧ МӨНГӨӨ ШИЛЖҮҮЛЧИХСЭН ХҮЛЭЭЖ БАЙНА. Энэ хуудас нь
 * хурдан ажиллах ёстой: гүйлгээний утга нь ХАМГИЙН ТОД, баталгаажуулах
 * товч нэг дарахад ажиллана.
 *
 * ⚠️ Хүлээгдэж буй (claimed) төлбөр нь ЭХЭНД — тэдгээр нь хүн хүлээж
 * байгаа гэсэн үг.
 */

type Tab = 'pending' | 'waiting' | 'all';

const TAB_LABEL: Record<Tab, string> = {
  pending: 'Шалгах хүлээж буй',
  waiting: 'Шилжүүлээгүй',
  all: 'Бүгд',
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Хүлээгдэж буй', cls: 'bg-premium/15 text-premium' },
  PAID: { label: 'Баталгаажсан', cls: 'bg-success/15 text-success' },
  CANCELLED: { label: 'Татгалзсан', cls: 'bg-destructive/12 text-destructive' },
  EXPIRED: { label: 'Хугацаа дууссан', cls: 'bg-foreground/8 text-foreground/40' },
  FAILED: { label: 'Амжилтгүй', cls: 'bg-destructive/12 text-destructive' },
};

/** Хэдэн хугацааны өмнө мэдэгдсэн — хүлээлт хэр урт болохыг харуулна */
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
    tab === 'all' ? undefined : tab,
  );
  const { data: settings } = useAdminBankSettings();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

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
      success: 'Баталгаажлаа — эрх нээгдлээ',
      onDone: () => {
        qc.invalidateQueries({ queryKey: ['admin-bank-payments'] });
        setBusy(null);
      },
    });
  };

  const reject = async (p: AdminBankPayment) => {
    /* ⚠️ Шалтгаан ЗААВАЛ — хэрэглэгчид имэйлээр очно, «яагаад» гэдгийг
       мэдэхгүй бол дэмжлэг рүү залгана */
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

  return (
    <AdminShell>
      <AdminTopbar
        title="Дансны төлбөр"
        subtitle={
          settings?.enabled
            ? `${settings.bankName} · ${settings.accountNumber}`
            : 'Дансаар төлөх идэвхгүй байна'
        }
      />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        {/*
          ⚠️ УНТРААЛТТАЙ бол ХАМГИЙН ЭХЭНД анхааруулна — админ энэ
          хуудас руу орж «яагаад төлбөр ирэхгүй байна» гэж гайхахаас
          сэргийлнэ.
        */}
        {settings && !settings.enabled && (
          /*
            ⚠️⚠️ УНТРААЛТТАЙ ҮЕД ЮУ ХИЙХИЙГ ЗААНА.
            Зөвхөн «унтраалттай» гэж хэлэх нь хангалтгүй — админ энэ
            хуудас юунд зориулагдсаныг ойлгохгүй, хоосон хүснэгт хараад
            эргэлзэнэ. Урсгалыг 3 алхмаар тайлбарлана.
          */
          <div className="mb-5 rounded-xl border border-premium/30 bg-premium/8 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-premium">
                  Дансаар төлөх боломж унтраалттай байна
                </p>
                <p className="mt-1 text-sm text-foreground/60">
                  Асаахын тулд банк, дансны дугаар, эзэмшигчийн нэрээ бөглөнө үү. Асаасны
                  дараа хэрэглэгчид багцын хуудсанд «Дансаар шилжүүлэх» товч харагдана.
                </p>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="shrink-0 rounded-lg bg-premium-solid px-3.5 py-2 text-sm font-bold text-premium-foreground transition-transform hover:scale-[1.02]"
              >
                Дансаа тохируулах
              </button>
            </div>

            <div className="mt-3.5 grid gap-2 border-t border-premium/20 pt-3 sm:grid-cols-3">
              {[
                {
                  n: '1',
                  t: 'Хэрэглэгч шилжүүлнэ',
                  d: 'Багц сонгоод «Дансаар шилжүүлэх» дарж, гарсан гүйлгээний утгаар мөнгө шилжүүлнэ',
                },
                {
                  n: '2',
                  t: 'Танд мэдэгдэнэ',
                  d: '«Шилжүүлсэн» товч дармагц энэ хуудсанд гарч, Telegram-д мэдэгдэл ирнэ',
                },
                {
                  n: '3',
                  t: 'Та баталгаажуулна',
                  d: 'Банкны хуулгаас гүйлгээний утгаар шалгаад «Батлах» дарахад эрх нээгдэнэ',
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
          {/* ─── Табууд ─── */}
          <div className="flex gap-1 rounded-lg bg-foreground/5 p-1">
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
              </button>
            ))}
          </div>

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

          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium text-foreground/75 transition-colors hover:border-primary/40"
          >
            <Settings2 size={15} />
            Тохиргоо
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-foreground/10">
          {isLoading ? (
            <TableSkeleton rows={5} cols={5} />
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
                  : 'Хэрэглэгчид багц авахдаа «Дансаар шилжүүлэх» сонговол энд бүртгэгдэнэ.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-180 text-sm">
                <thead>
                  <tr className="border-b border-foreground/10 bg-foreground/4 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-semibold">Гүйлгээний утга</th>
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
                        {/*
                          ⚠️ ГҮЙЛГЭЭНИЙ УТГА нь эхний багана, monospace,
                          хуулах товчтой — админ банкны хуулгаас хайхдаа
                          үүнийг хуулж буулгана.
                        */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-foreground">
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
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[11px] font-bold',
                              st.cls,
                            )}
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
      </main>

      <BankSettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['admin-bank-settings'] })}
      />
    </AdminShell>
  );
}

/** Дансны тохиргооны цонх */
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
  const [form, setForm] = useState({
    enabled: false,
    bankName: '',
    accountNumber: '',
    accountName: '',
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /* ⚠️ Нээгдэх бүрд СЕРВЕРИЙН утгыг ачаална — өөр админ засвал
     хуучин утга дээр бичихээс сэргийлнэ */
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
          <DialogTitle>Дансны тохиргоо</DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground/70">Банк</label>
            <input
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              placeholder="Хаан банк"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground/70">
              Дансны дугаар
            </label>
            <input
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              placeholder="5000123456"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground/70">
              Эзэмшигчийн нэр
            </label>
            <input
              value={form.accountName}
              onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              placeholder="БЭСТ ТИВИ ХХК"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground/70">
              Нэмэлт заавар
            </label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={2}
              className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Хэрэглэгчид модалд харагдана. Баталгаажих БОДИТ хугацааг бичих нь гомдол
              багасгана.
            </p>
          </div>

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
