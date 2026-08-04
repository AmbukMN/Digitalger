'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  Send,
  ShieldOff,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { DataToolbar } from '@/components/data-toolbar';
import { Pagination } from '@/components/pagination';
import { NewBadge } from '@/components/new-badge';
import { api } from '@/lib/api';
import { useNewSince } from '@/lib/use-new-since';

const TABS = [
  { id: 'logs', label: 'Илгээсэн имэйл' },
  { id: 'subscribers', label: 'Бүртгүүлэгчид' },
  { id: 'broadcast', label: 'Олноор илгээх' },
  { id: 'suppressions', label: 'Хориглосон хаяг' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TEMPLATE_LABEL: Record<string, string> = {
  welcome: 'Тавтай морил',
  verify: 'Баталгаажуулалт',
  payment: 'Төлбөр',
  subscription: 'Багц',
  rental: 'Түрээс',
  expiring: 'Дуусах сануулга',
  marketing: 'Маркетинг',
};

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: string;
  error: string | null;
  createdAt: string;
}

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  source: string | null;
  status: string;
  createdAt: string;
}

export default function EmailPage() {
  const [tab, setTab] = useState<TabId>('logs');

  return (
    <AdminShell>
      <AdminTopbar title="Имэйл" subtitle="Илгээлт, бүртгүүлэгчид, кампанит ажил" />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                tab === t.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'logs' && <LogsTab />}
        {tab === 'subscribers' && <SubscribersTab />}
        {tab === 'broadcast' && <BroadcastTab />}
        {tab === 'suppressions' && <SuppressionsTab />}
      </main>
    </AdminShell>
  );
}

// ─── Илгээсэн имэйл ───────────────────────────────────────────────────────────

function LogsTab() {
  const [f, setF] = useState({ search: '', template: 'ALL', status: 'ALL', page: 1, limit: 20 });

  const { data, isFetching } = useQuery({
    queryKey: ['admin-email-logs', f],
    queryFn: () => {
      const qs = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => {
        if (v && v !== 'ALL') qs.set(k, String(v));
      });
      return api<{
        items: EmailLog[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        stats: Record<string, number>;
      }>(`/admin/email/logs?${qs}`);
    },
    placeholderData: (p) => p,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch, page: patch.page ?? 1 }));
  const activeCount = useMemo(
    () => (f.template !== 'ALL' ? 1 : 0) + (f.status !== 'ALL' ? 1 : 0),
    [f],
  );

  return (
    <>
      <div className="mb-5 grid gap-3 grid-cols-1 sm:grid-cols-3">
        <MiniStat
          icon={<CheckCircle2 size={17} />}
          label="Илгээгдсэн"
          value={data?.stats?.sent ?? 0}
          tone="success"
        />
        <MiniStat
          icon={<XCircle size={17} />}
          label="Амжилтгүй"
          value={data?.stats?.failed ?? 0}
          tone="danger"
        />
        <MiniStat
          icon={<ShieldOff size={17} />}
          label="Хориглосон"
          value={data?.stats?.suppressed ?? 0}
          tone="warning"
        />
      </div>

      <DataToolbar
        search={f.search}
        onSearch={(v) => set({ search: v })}
        searchPlaceholder="Имэйл хаягаар хайх..."
        selects={[
          {
            id: 'template',
            label: 'Төрөл',
            value: f.template,
            options: [
              { value: 'ALL', label: 'Бүгд' },
              ...Object.entries(TEMPLATE_LABEL).map(([value, label]) => ({ value, label })),
            ],
            onChange: (v) => set({ template: v }),
          },
          {
            id: 'status',
            label: 'Төлөв',
            value: f.status,
            options: [
              { value: 'ALL', label: 'Бүгд' },
              { value: 'sent', label: 'Илгээгдсэн' },
              { value: 'failed', label: 'Амжилтгүй' },
              { value: 'suppressed', label: 'Хориглосон' },
            ],
            onChange: (v) => set({ status: v }),
          },
        ]}
        limit={f.limit}
        onLimit={(n) => set({ limit: n })}
        activeCount={activeCount}
        onReset={() => setF({ search: '', template: 'ALL', status: 'ALL', page: 1, limit: 20 })}
      />

      <div
        className={cn(
          'admin-card mt-5 overflow-x-auto rounded-xl transition-opacity',
          isFetching && 'opacity-60',
        )}
      >
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-accent/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Хүлээн авагч</th>
              <th className="px-4 py-3 text-left font-semibold">Гарчиг</th>
              <th className="px-4 py-3 text-left font-semibold">Төрөл</th>
              <th className="px-4 py-3 text-left font-semibold">Төлөв</th>
              <th className="px-4 py-3 text-left font-semibold">Огноо</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.items.map((l) => (
              <tr key={l.id} className="transition-colors hover:bg-accent/40">
                <td className="px-4 py-3 text-foreground">{l.to}</td>
                <td className="max-w-[280px] truncate px-4 py-3 text-muted-foreground">
                  {l.subject}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {TEMPLATE_LABEL[l.template] ?? l.template}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-medium',
                      l.status === 'sent' && 'bg-success/15 text-success',
                      l.status === 'failed' && 'bg-destructive/15 text-destructive',
                      l.status === 'suppressed' && 'bg-warning/15 text-warning',
                    )}
                    title={l.error ?? undefined}
                  >
                    {l.status === 'sent'
                      ? 'Илгээгдсэн'
                      : l.status === 'failed'
                        ? 'Амжилтгүй'
                        : 'Хориглосон'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(l.createdAt).toLocaleString('mn-MN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.items.length && !isFetching && (
          <TableEmptyState icon={Mail} message="Имэйл илгээгээгүй байна" />
        )}
      </div>

      <Pagination
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        total={data?.total}
        limit={f.limit}
        onPage={(p) => setF((s) => ({ ...s, page: p }))}
      />
    </>
  );
}

// ─── Бүртгүүлэгчид ────────────────────────────────────────────────────────────

function SubscribersTab() {
  // Сүүлийн үзэлтээс хойш шинээр бүртгүүлсэн хүмүүсийг тэмдэглэнэ
  const isNew = useNewSince('subscribers');
  const [f, setF] = useState({ q: '', status: 'ALL', source: 'ALL', page: 1, limit: 20 });
  const [exporting, setExporting] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ['admin-subscribers', f],
    queryFn: () => {
      const qs = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => {
        if (v && v !== 'ALL') qs.set(k, String(v));
      });
      return api<{
        items: Subscriber[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        stats: Record<string, number>;
      }>(`/admin/email/subscribers?${qs}`);
    },
    placeholderData: (p) => p,
    staleTime: 0,
  });

  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch, page: patch.page ?? 1 }));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await api<{ csv: string; count: number }>(
        `/admin/email/subscribers/export?status=${f.status}`,
      );
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${res.count} мөр татагдлаа`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="mb-5 grid gap-3 grid-cols-1 sm:grid-cols-3">
        <MiniStat
          icon={<Users size={17} />}
          label="Идэвхтэй"
          value={data?.stats?.ACTIVE ?? 0}
          tone="success"
        />
        <MiniStat
          icon={<XCircle size={17} />}
          label="Цуцалсан"
          value={data?.stats?.UNSUBSCRIBED ?? 0}
        />
        <MiniStat
          icon={<AlertTriangle size={17} />}
          label="Bounce"
          value={data?.stats?.BOUNCED ?? 0}
          tone="danger"
        />
      </div>

      <DataToolbar
        search={f.q}
        onSearch={(v) => set({ q: v })}
        searchPlaceholder="Имэйл, нэрээр хайх..."
        tabs={[
          { id: 'ALL', label: 'Бүгд', count: data?.total },
          { id: 'ACTIVE', label: 'Идэвхтэй', count: data?.stats?.ACTIVE },
          { id: 'UNSUBSCRIBED', label: 'Цуцалсан', count: data?.stats?.UNSUBSCRIBED },
        ]}
        activeTab={f.status}
        onTab={(id) => set({ status: id })}
        selects={[
          {
            id: 'source',
            label: 'Эх сурвалж',
            value: f.source,
            options: [
              { value: 'ALL', label: 'Бүгд' },
              { value: 'footer', label: 'Хөлийн форм' },
              { value: 'register', label: 'Бүртгэл' },
              { value: 'homepage', label: 'Нүүр хуудас' },
              { value: 'admin', label: 'Админ' },
            ],
            onChange: (v) => set({ source: v }),
          },
        ]}
        limit={f.limit}
        onLimit={(n) => set({ limit: n })}
        onExport={exportCsv}
        exporting={exporting}
        activeCount={f.source !== 'ALL' ? 1 : 0}
        onReset={() => setF({ q: '', status: 'ALL', source: 'ALL', page: 1, limit: 20 })}
      />

      <div
        className={cn(
          'admin-card mt-5 overflow-x-auto rounded-xl transition-opacity',
          isFetching && 'opacity-60',
        )}
      >
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-accent/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Имэйл</th>
              <th className="px-4 py-3 text-left font-semibold">Нэр</th>
              <th className="px-4 py-3 text-left font-semibold">Эх сурвалж</th>
              <th className="px-4 py-3 text-left font-semibold">Төлөв</th>
              <th className="px-4 py-3 text-left font-semibold">Бүртгүүлсэн</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.items.map((s) => (
              <tr key={s.id} className="transition-colors hover:bg-accent/40">
                <td className="px-4 py-3 text-foreground">
                  <span className="flex items-center gap-1.5">
                    {s.email}
                    {isNew(s.createdAt) && <NewBadge />}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{s.name ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{s.source ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-medium',
                      s.status === 'ACTIVE' && 'bg-success/15 text-success',
                      s.status === 'UNSUBSCRIBED' && 'bg-muted text-muted-foreground',
                      s.status === 'BOUNCED' && 'bg-destructive/15 text-destructive',
                    )}
                  >
                    {s.status === 'ACTIVE'
                      ? 'Идэвхтэй'
                      : s.status === 'UNSUBSCRIBED'
                        ? 'Цуцалсан'
                        : 'Bounce'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(s.createdAt).toLocaleDateString('mn-MN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.items.length && !isFetching && (
          <TableEmptyState icon={Users} message="Бүртгүүлэгч байхгүй байна" />
        )}
      </div>

      <Pagination
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        total={data?.total}
        limit={f.limit}
        onPage={(p) => setF((s) => ({ ...s, page: p }))}
      />
    </>
  );
}

// ─── Олноор илгээх ────────────────────────────────────────────────────────────

function BroadcastTab() {
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    subject: '',
    heading: '',
    body: '',
    ctaText: '',
    ctaUrl: '',
    audience: 'subscribers',
  });
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!form.subject.trim() || !form.heading.trim() || !form.body.trim()) {
      return toast.error('Гарчиг, толгой, агуулга заавал');
    }
    const ok = await confirm({
      title: 'Имэйл олноор илгээх үү?',
      description: 'Бүх хүлээн авагч руу илгээгдэнэ. Буцаах боломжгүй.',
      bullets: [
        `Хүлээн авагч: ${form.audience === 'subscribers' ? 'Бүртгүүлэгчид' : form.audience === 'users' ? 'Хэрэглэгчид' : 'Хоёулаа'}`,
        'Дараалалаар илгээгдэнэ (SES хязгаар хамгаална)',
      ],
      confirmLabel: 'Илгээх',
      tone: 'warning',
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await api<{ queued: number }>('/admin/email/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          subject: form.subject,
          heading: form.heading,
          bodyHtml: form.body
            .split('\n\n')
            .map(
              (para) =>
                `<p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#c8c8ce">${para.replace(/\n/g, '<br/>')}</p>`,
            )
            .join(''),
          ctaText: form.ctaText || undefined,
          ctaUrl: form.ctaUrl || undefined,
          audience: form.audience,
        }),
      });
      toast.success(`${res.queued} хаяг руу дараалалд орлоо`);
      qc.invalidateQueries({ queryKey: ['admin-email-logs'] });
      setForm({ ...form, subject: '', heading: '', body: '', ctaText: '', ctaUrl: '' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-card max-w-3xl rounded-xl p-6">
      <p className="mb-4 rounded-lg border border-warning/30 bg-warning/8 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Анхаар:</strong> Илгээсэн имэйлийг буцаах боломжгүй.
        Bounce/complaint ирсэн хаяг руу автоматаар илгээхгүй (SES-ийн нэр хүнд хамгаална).
      </p>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Хүлээн авагч</span>
          <select
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
            className="admin-select"
          >
            <option value="subscribers">Мэдээллийн товхимол бүртгүүлэгчид</option>
            <option value="users">Бүртгэлтэй хэрэглэгчид (баталгаажсан)</option>
            <option value="both">Хоёулаа</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Имэйлийн гарчиг</span>
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Шинэ кино нэмэгдлээ!"
            className="admin-input"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Толгой (имэйл дотор)</span>
          <input
            value={form.heading}
            onChange={(e) => setForm({ ...form, heading: e.target.value })}
            placeholder="Энэ долоо хоногийн шинэ кинонууд 🎬"
            className="admin-input"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Агуулга (хоосон мөрөөр догол мөр тусгаарлана)
          </span>
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={8}
            placeholder="Сайн байна уу!&#10;&#10;Энэ долоо хоногт..."
            className="admin-textarea"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Товчны текст (заавал биш)</span>
            <input
              value={form.ctaText}
              onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
              placeholder="Одоо үзэх"
              className="admin-input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Товчны холбоос</span>
            <input
              value={form.ctaUrl}
              onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })}
              placeholder="https://besttv.us/movies"
              className="admin-input"
            />
          </label>
        </div>

        <button
          onClick={send}
          disabled={busy}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          Илгээх
        </button>
      </div>
    </div>
  );
}

// ─── Хориглосон хаяг ──────────────────────────────────────────────────────────

function SuppressionsTab() {
  // Шинээр нэмэгдсэн bounce/complaint — SES нэр хүндэд аюултай, шуурхай харах
  const isNew = useNewSince('email-issues');
  const { data, isFetching } = useQuery({
    queryKey: ['admin-suppressions'],
    queryFn: () =>
      api<{ id: string; email: string; reason: string; subType: string | null; createdAt: string }[]>(
        '/admin/email/suppressions',
      ),
    staleTime: 0,
  });

  return (
    <div className="admin-card overflow-hidden rounded-xl">
      <p className="border-b border-border p-4 text-xs text-muted-foreground">
        Bounce/complaint ирсэн хаягууд — эдгээр рүү дахин илгээхгүй. Ингэснээр SES-ийн нэр хүнд
        (reputation) хамгаалагдаж, бусад имэйл спам болохоос сэргийлнэ.
      </p>
      <table className={cn('w-full text-sm transition-opacity', isFetching && 'opacity-60')}>
        <thead className="bg-accent/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Имэйл</th>
            <th className="px-4 py-3 text-left font-semibold">Шалтгаан</th>
            <th className="px-4 py-3 text-left font-semibold">Огноо</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data?.map((s) => (
            <tr key={s.id} className="transition-colors hover:bg-accent/40">
              <td className="px-4 py-3 text-foreground">
                <span className="flex items-center gap-1.5">
                  {s.email}
                  {isNew(s.createdAt) && <NewBadge />}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {s.reason}
                {s.subType && ` · ${s.subType}`}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {new Date(s.createdAt).toLocaleDateString('mn-MN')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data?.length && !isFetching && (
        <TableEmptyState icon={ShieldOff} message="Хориглосон хаяг байхгүй — сайн байна 👍" />
      )}
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'success' | 'danger' | 'warning';
}) {
  return (
    <div className="admin-card flex items-center gap-3 rounded-xl p-3.5">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          tone === 'success' && 'bg-success/12 text-success',
          tone === 'danger' && 'bg-destructive/12 text-destructive',
          tone === 'warning' && 'bg-warning/12 text-warning',
          !tone && 'bg-primary/12 text-primary',
        )}
      >
        {icon}
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}
