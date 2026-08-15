'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  MousePointerClick,
  Send,
  ShieldOff,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatDate, formatDateTime } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { StatCard } from '@/components/stat-card';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { DataToolbar } from '@/components/data-toolbar';
import { Pagination } from '@/components/pagination';
import { NewBadge } from '@/components/new-badge';
import { api } from '@/lib/api';
import { downloadCsv, filtersToQuery } from '@/lib/export-csv';
import { BulkBar, SelectBox, useBulkSelect } from '@/lib/use-bulk-select';
import { useNewSince } from '@/lib/use-new-since';
import { LifecycleTab } from './lifecycle-tab';

const TABS = [
  { id: 'logs', label: 'Илгээсэн имэйл' },
  { id: 'lifecycle', label: 'Автомат имэйл' },
  { id: 'subscribers', label: 'Бүртгүүлэгчид' },
  { id: 'broadcast', label: 'Олноор илгээх' },
  { id: 'suppressions', label: 'Хориглосон хаяг' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * ⚠️ Backend-ийн 10 загварыг БҮГДИЙГ хамруулна.
 * Өмнө нь 7 л байсан тул `rental-expiring`, `password-reset`,
 * `password-changed` гурав шүүлтийн жагсаалтад ГАРАХГҮЙ, хүснэгтэд
 * түүхий slug-аараа («password-changed») харагддаг байв.
 */
const TEMPLATE_LABEL: Record<string, string> = {
  welcome: 'Тавтай морил',
  verify: 'Баталгаажуулалт',
  payment: 'Төлбөр',
  subscription: 'Багц',
  rental: 'Түрээс',
  'rental-expiring': 'Түрээс дуусах',
  expiring: 'Багц дуусах',
  'password-reset': 'Нууц үг сэргээх',
  'password-changed': 'Нууц үг солигдсон',
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
  /** ⚠️ Хүргэлтийн хяналт — SES Configuration Set асаасан үед л дүүрнэ */
  deliveredAt: string | null;
  openedAt: string | null;
  openCount: number;
  clickedAt: string | null;
  clickCount: number;
  bouncedAt: string | null;
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
        {tab === 'lifecycle' && <LifecycleTab />}
        {tab === 'subscribers' && <SubscribersTab />}
        {tab === 'broadcast' && <BroadcastTab />}
        {tab === 'suppressions' && <SuppressionsTab />}
      </main>
    </AdminShell>
  );
}

// ─── Илгээсэн имэйл ───────────────────────────────────────────────────────────

/** Backend-ийн `insight` объект — хүргэлт/нээлтийн хураангуй */
interface EmailInsight {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number;
  clickRate: number;
  deliveryRate: number;
  /**
   * ⚠️ ХОЁР ӨӨР ХЯНАЛТ:
   *   openTracking     — өөрийн pixel. AWS хэрэггүй, үргэлж ажиллана.
   *                      Зөвхөн МАРКЕТИНГ имэйлд суудаг.
   *   deliveryTracking — AWS SES Configuration Set + SNS. Хүргэгдсэн/
   *                      буцаагдсан эсэхийг мэдэхэд л хэрэгтэй.
   */
  openTracking: boolean;
  deliveryTracking: boolean;
  /** @deprecated `deliveryTracking` ашигла */
  trackingActive: boolean;
}

function LogsTab() {
  const [f, setF] = useState({
    search: '',
    template: 'ALL',
    status: 'ALL',
    /** ⚠️ Нээсэн эсэхээр шүүх — 'ALL' | 'yes' | 'no' */
    opened: 'ALL',
    page: 1,
    limit: 20,
  });

  /* Олноор устгах — тест лог хуримтлагддаг */
  const sel = useBulkSelect({
    endpoint: '/admin/email/logs/bulk-delete',
    invalidate: ['admin-email-logs'],
    label: 'лог',
  });

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
        insight: EmailInsight;
      }>(`/admin/email/logs?${qs}`);
    },
    placeholderData: (p) => p,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch, page: patch.page ?? 1 }));
  const activeCount = useMemo(
    () =>
      (f.template !== 'ALL' ? 1 : 0) + (f.status !== 'ALL' ? 1 : 0) + (f.opened !== 'ALL' ? 1 : 0),
    [f],
  );

  return (
    <>
      {/*
        ⚠️⚠️ ХҮРГЭЛТИЙН ЖИМ — илгээснээс хойш юу болсныг НЭГ ХАРЦААР.
        Өмнө нь зөвхөн «Илгээгдсэн / Амжилтгүй / Хориглосон» гэсэн 3 карт
        байсан тул имэйл ХҮРСЭН эсэх, НЭЭСЭН эсэхийг мэдэх аргагүй байв.

        ⚠️ Тоонууд одоо ШҮҮЛТИЙГ ДАГАНА (backend-д `where` нэмсэн) —
           өмнө нь шүүлт хийсэн ч дэлхийн нийт тоо гардаг байв.
      */}
      <EmailFunnel insight={data?.insight} />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<CheckCircle2 size={17} />}
          label="Илгээгдсэн"
          value={data?.stats?.sent ?? 0}
          tone="success"
        />
        <StatCard
          icon={<XCircle size={17} />}
          label="Амжилтгүй"
          value={data?.stats?.failed ?? 0}
          tone="danger"
        />
        <StatCard
          icon={<ShieldOff size={17} />}
          label="Хориглосон"
          value={data?.stats?.suppressed ?? 0}
          tone="warning"
        />
      </div>

      <DataToolbar
        search={f.search}
        onSearch={(v) => set({ search: v })}
        searchPlaceholder="Имэйл хаяг эсвэл гарчгаар хайх..."
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
          {
            /* ⚠️ Нээгээгүйг шүүх — дахин илгээх/сануулах хэрэглэгчийг олно */
            id: 'opened',
            label: 'Нээлт',
            value: f.opened,
            options: [
              { value: 'ALL', label: 'Бүгд' },
              { value: 'yes', label: 'Нээсэн' },
              { value: 'no', label: 'Нээгээгүй' },
            ],
            onChange: (v) => set({ opened: v }),
          },
        ]}
        limit={f.limit}
        onLimit={(n) => set({ limit: n })}
        activeCount={activeCount}
        onReset={() =>
          setF({ search: '', template: 'ALL', status: 'ALL', opened: 'ALL', page: 1, limit: 20 })
        }
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
              {/* Bulk сонголт — тест имэйл лог их хуримтлагддаг */}
              <th className="w-10 px-4 py-3">
                <SelectBox
                  checked={sel.allChecked((data?.items ?? []).map((l) => l.id))}
                  onChange={() => sel.toggleAll((data?.items ?? []).map((l) => l.id))}
                  ariaLabel="Хуудсан дээрх бүгдийг сонгох"
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold">Хүлээн авагч</th>
              <th className="px-4 py-3 text-left font-semibold">Гарчиг</th>
              <th className="px-4 py-3 text-left font-semibold">Төрөл</th>
              <th className="px-4 py-3 text-left font-semibold">Төлөв</th>
              {/* ⚠️ НЭЭЛТ — хэрэглэгч имэйлийг уншсан эсэх */}
              <th className="px-4 py-3 text-left font-semibold">Нээлт</th>
              <th className="px-4 py-3 text-left font-semibold">Огноо</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.items.map((l) => (
              <tr key={l.id} className="transition-colors hover:bg-accent/40">
                <td className="px-4 py-3">
                  <SelectBox
                    checked={sel.isSelected(l.id)}
                    onChange={() => sel.toggle(l.id)}
                    ariaLabel={l.to + ' лог сонгох'}
                  />
                </td>
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
                  {/*
                    ⚠️ АЛДААНЫ ШАЛТГААН — өмнө нь зөвхөн `title` атрибутад
                    байсан тул хулганаа удаан барихгүй бол ХАРАГДАХГҮЙ.
                    Админ яагаад очоогүйг (буруу хаяг / bounce / SES хязгаар)
                    шууд мэдэх ёстой.
                  */}
                  {l.error && (
                    <p
                      className="mt-1 line-clamp-2 max-w-[260px] text-[11px] leading-tight text-destructive/80"
                      title={l.error}
                    >
                      {l.error}
                    </p>
                  )}
                </td>

                {/*
                  ⚠️⚠️ НЭЭЛТИЙН НҮД — таны хүссэн «нээсэн / нээгээгүй».

                  Гурван төлөв:
                    • Нээсэн   — хэзээ нээсэн + хэдэн удаа (hover-д)
                    • Хүрсэн   — хүргэгдсэн ч хараахан нээгээгүй
                    • Буцсан   — хаяг байхгүй / спам гэж мэдээлсэн

                  ⚠️ Хяналт асаагүй эсвэл илгээгдээгүй мөрөнд «—» гаргана
                     — «нээгээгүй» гэж ХУДАЛ харуулахгүй.
                */}
                <td className="px-4 py-3">
                  <EmailOpenCell log={l} />
                </td>

                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDateTime(l.createdAt)}
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
      <BulkBar {...sel.bar} />
    </>
  );
}

// ─── Бүртгүүлэгчид ────────────────────────────────────────────────────────────

function SubscribersTab() {
  // Сүүлийн үзэлтээс хойш шинээр бүртгүүлсэн хүмүүсийг тэмдэглэнэ
  const isNew = useNewSince('subscribers');
  const [f, setF] = useState({ q: '', status: 'ALL', source: 'ALL', page: 1, limit: 20 });
  const [exporting, setExporting] = useState(false);

  /* Олноор устгах — тест бүртгэл цэвэрлэх */
  const sel = useBulkSelect({
    endpoint: '/admin/email/subscribers/bulk-delete',
    invalidate: ['admin-subscribers'],
    label: 'бүртгүүлэгч',
  });

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

  /**
   * ⚠️⚠️ ХАРАГДАЖ БУЙ ШҮҮЛТҮҮРИЙГ ЯГ ДАГАНА.
   *
   * БОДИТ АЛДАА: зөвхөн `status` дамждаг байв. Админ эх сурвалж + хайлт
   * шүүж 40 мөр хараад CSV дарахад МЯНГА МЯНГАН мөр татагддаг. Дээр нь
   * «12,000 мөр татагдлаа» гэсэн toast гарах тул анзаарахгүй өнгөрч,
   * зөвшөөрөөгүй хүмүүст сурталчилгаа явуулах эрсдэлтэй.
   */
  const exportCsv = async () => {
    setExporting(true);
    const qs = filtersToQuery(f);
    await downloadCsv(
      `/admin/email/subscribers/export${qs ? `?${qs}` : ''}`,
      'subscribers',
    );
    setExporting(false);
  };

  return (
    <>
      <div className="mb-5 grid gap-3 grid-cols-1 sm:grid-cols-3">
        <StatCard
          icon={<Users size={17} />}
          label="Идэвхтэй"
          value={data?.stats?.ACTIVE ?? 0}
          tone="success"
        />
        <StatCard
          icon={<XCircle size={17} />}
          label="Цуцалсан"
          value={data?.stats?.UNSUBSCRIBED ?? 0}
        />
        <StatCard
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
              {/* Bulk сонголт — тест бүртгэл цэвэрлэх */}
              <th className="w-10 px-4 py-3">
                <SelectBox
                  checked={sel.allChecked((data?.items ?? []).map((x) => x.id))}
                  onChange={() => sel.toggleAll((data?.items ?? []).map((x) => x.id))}
                  ariaLabel="Хуудсан дээрх бүгдийг сонгох"
                />
              </th>
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
                <td className="px-4 py-3">
                  <SelectBox
                    checked={sel.isSelected(s.id)}
                    onChange={() => sel.toggle(s.id)}
                    ariaLabel={s.email + ' сонгох'}
                  />
                </td>
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
                  {formatDate(s.createdAt)}
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
      <BulkBar {...sel.bar} />
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
                {formatDate(s.createdAt)}
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


/**
 * ХҮРГЭЛТИЙН ЖИМ — илгээснээс хойш юу болсныг харуулна.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: өмнө нь «Илгээгдсэн 14» гэж харагддаг ч
 * тэдгээрийн хэд нь хүнд ХҮРСЭН, хэд нь НЭЭСЭН нь огт мэдэгддэггүй
 * байв. Маркетингийн имэйл үр дүнтэй эсэхийг хэмжих боломжгүй байсан.
 *
 * ⚠️ Хяналт (SES Configuration Set) АСААГҮЙ үед «0%» гэж ХУДАЛ
 *    харуулахгүй — оронд нь тохируулах зааврыг өгнө.
 */
function EmailFunnel({ insight }: { insight?: EmailInsight }) {
  if (!insight) {
    return <div className="mb-4 h-[92px] animate-pulse rounded-xl bg-foreground/5" />;
  }

  /**
   * ⚠️⚠️ ЖИМИЙГ ҮРГЭЛЖ ХАРУУЛНА — өмнө нь бүхэлд нь нуудаг байв.
   *
   * БОДИТ АЛДАА: `trackingActive` нэг л туг байсан тул AWS
   * тохируулаагүй үед «Хүргэлтийн хяналт идэвхгүй» гэсэн анхааруулга
   * гарч, БҮХ статистик нуугддаг байв. Гэтэл нээлтийн хяналт
   * (өөрийн pixel) нь AWS-гүйгээр АЖИЛЛАДАГ — админ «нээлт хянахад
   * AWS хэрэгтэй» гэж БУРУУ ойлгоно.
   *
   * Одоо: жим үргэлж харагдана, зөвхөн ДУТУУ багана дээр тэмдэглэгээ.
   */
  const steps = [
    {
      icon: Send,
      label: 'Илгээсэн',
      value: insight.sent,
      pct: null,
      tone: 'text-foreground/70',
      off: false,
    },
    {
      icon: Inbox,
      label: 'Хүрсэн',
      value: insight.delivered,
      pct: insight.deliveryRate,
      tone: 'text-success',
      /* AWS SES Configuration Set хэрэгтэй */
      off: !insight.deliveryTracking,
    },
    {
      icon: MailOpen,
      label: 'Нээсэн',
      value: insight.opened,
      pct: insight.openRate,
      tone: 'text-primary',
      off: false,
    },
    {
      icon: MousePointerClick,
      label: 'Дарсан',
      value: insight.clicked,
      pct: insight.clickRate,
      tone: 'text-premium',
      /* Дарсныг хянахад ч SES хэрэгтэй (линк дамжуулалт) */
      off: !insight.deliveryTracking,
    },
  ];

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4">
      {/* ⚠️ Мобайлд 2×2, десктопт 4 багана — жижиг дэлгэцэд шахагдахгүй */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {steps.map((s) => (
          <div key={s.label} className={cn('min-w-0', s.off && 'opacity-45')}>
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <s.icon size={12} className={s.tone} /> {s.label}
            </p>
            {s.off ? (
              /**
               * ⚠️ «0%» гэж ХУДАЛ харуулахгүй — хяналт байхгүй гэдэг нь
               * «хэн ч хүрээгүй» гэсэн үг БИШ. Оронд нь «—».
               */
              <p className="mt-1 text-xl font-bold text-foreground/30" title="AWS SES хяналт тохируулаагүй">
                —
              </p>
            ) : (
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-bold tabular-nums text-foreground">{s.value}</span>
                {s.pct != null && (
                  <span className={cn('text-xs font-semibold tabular-nums', s.tone)}>{s.pct}%</span>
                )}
              </p>
            )}
            {/* Явцын зураас — харьцааг нүдээр шууд ойлгуулна */}
            {!s.off && s.pct != null && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/8">
                <div
                  className={cn(
                    'h-full rounded-full',
                    s.label === 'Хүрсэн' ? 'bg-success' : s.label === 'Нээсэн' ? 'bg-primary' : 'bg-premium',
                  )}
                  style={{ width: `${Math.min(100, s.pct)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/*
        ⚠️ Хүргэлтийн хяналт дутуу үед л энэ мөр гарна — НЭЭЛТ нь
        өөрийн pixel-ээр АЖИЛЛАЖ БАЙГААГ тодорхой хэлнэ. Өмнө нь
        «нээсэн эсэхийг мэдэхийн тулд AWS хэрэгтэй» гэж ХУДАЛ бичсэн
        байв — үнэндээ хэрэггүй.
      */}
      {!insight.deliveryTracking && (
        <p className="mt-3 flex items-start gap-1.5 border-t border-border pt-2.5 text-xs text-muted-foreground">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-premium" />
          <span>
            <span className="text-foreground/80">Нээлтийн хяналт ажиллаж байна.</span>{' '}
            «Хүрсэн / Дарсан» багана хоосон — AWS SES-д Configuration Set үүсгээд{' '}
            <code className="rounded bg-foreground/10 px-1">SES_CONFIGURATION_SET</code> тохируулбал
            нэмэгдэнэ.
          </span>
        </p>
      )}

      {/* ⚠️ Буцаагдсан нь 0-ээс их үед л харагдана — эрүүл үед анхаарал сарниулахгүй */}
      {insight.bounced > 0 && (
        <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-2.5 text-xs text-destructive">
          <AlertTriangle size={12} />
          {insight.bounced} имэйл буцаагдсан / спам гэж мэдээлэгдсэн — хаяг нь автоматаар хоригдов
        </p>
      )}
    </div>
  );
}

/**
 * Нэг имэйлийн НЭЭЛТИЙН төлөв.
 *
 * ⚠️ «Нээгээгүй» гэж ХУДАЛ харуулахгүй: хяналт (SES Configuration Set)
 * асаагүй үед бүх мөрөнд `deliveredAt=null` байх тул тэднийг
 * «нээгээгүй» гэвэл админ буруу дүгнэлт хийнэ. Ийм үед «—».
 */
function EmailOpenCell({ log }: { log: EmailLog }) {
  /* Илгээгдээгүй имэйлд нээлт ярих утгагүй */
  if (log.status !== 'sent') {
    return <span className="text-xs text-muted-foreground/50">—</span>;
  }

  if (log.bouncedAt) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive"
        title={`Буцаагдсан: ${formatDateTime(log.bouncedAt)}`}
      >
        <AlertTriangle size={11} /> Буцсан
      </span>
    );
  }

  if (log.openedAt) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
        title={
          `Нээсэн: ${formatDateTime(log.openedAt)}` +
          (log.openCount > 1 ? ` · ${log.openCount} удаа` : '') +
          (log.clickedAt ? ` · холбоос дарсан (${log.clickCount})` : '')
        }
      >
        <MailOpen size={11} /> Нээсэн
        {log.openCount > 1 && <span className="tabular-nums opacity-70">×{log.openCount}</span>}
        {/* Холбоос дарсан нь нээснээс ЧУУХАЛ дохио — тусад нь тэмдэглэнэ */}
        {log.clickedAt && <MousePointerClick size={11} className="text-premium" />}
      </span>
    );
  }

  if (log.deliveredAt) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-foreground/8 px-2 py-0.5 text-xs text-muted-foreground"
        title={`Хүрсэн: ${formatDateTime(log.deliveredAt)} · хараахан нээгээгүй`}
      >
        <Inbox size={11} /> Хүрсэн
      </span>
    );
  }

  /**
   * ⚠️ Хяналтын мэдээлэл алга — «нээгээгүй» гэж ТААМАГЛАХГҮЙ.
   *
   * Гурван шалтгаан байж болно:
   *   1. Гүйлгээний имэйл (нууц үг, OTP, төлбөр) — pixel ЗОРИУД суудаггүй
   *      (шүүлтүүр сэжиглэж спам руу явуулах эрсдэлтэй)
   *   2. Маркетинг имэйл, гэхдээ хараахан нээгээгүй
   *   3. Шуудангийн клиент зураг блоклосон (Gmail-д түгээмэл)
   */
  const isMarketing = log.template === 'marketing';
  return (
    <span
      className="text-xs text-muted-foreground/50"
      title={
        isMarketing
          ? 'Хараахан нээгээгүй (эсвэл клиент зураг блоклосон)'
          : 'Гүйлгээний имэйл — нээлт хянадаггүй'
      }
    >
      —
    </span>
  );
}
