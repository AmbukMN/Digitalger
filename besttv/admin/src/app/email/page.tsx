'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  MousePointerClick,
  Search,
  Send,
  ShieldOff,
  UserPlus,
  FolderOpen,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatDate, formatDateTime } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { StatCard } from '@/components/stat-card';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { AdminErrorState } from '@/components/admin-error-state';
import { DATE_PRESETS, DataToolbar, presetRange } from '@/components/data-toolbar';
import { Pagination } from '@/components/pagination';
import { NewBadge } from '@/components/new-badge';
import { AddSubscribersDialog } from '@/components/add-subscribers-dialog';
import { EmailBatchDialog } from '@/components/email-batch-dialog';
import { RichEditor } from '@/components/rich-editor';
import { api } from '@/lib/api';
import { useSiteUrl } from '@/lib/site-store';
import { uploadImage } from '@/lib/upload';
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
  /**
   * ⚠️ `SES_CONFIGURATION_SET` env тохируулагдсан эсэх — дата байгаа
   * эсэхээс ӨӨР. Тохируулагдсан атлаа дата 0 бол «үүсгэ» гэж зөвлөх
   * нь ХУДАЛ (2026-09-09 бодит төөрөгдөл).
   */
  deliveryConfigured: boolean;
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
    /** ⚠️ Огнооны муж — UB өдрийн хилээр (backend `ubRangeFilter`) */
    from: '',
    to: '',
    page: 1,
    limit: 20,
  });

  /* Олноор устгах — тест лог хуримтлагддаг */
  /** ⚠️ Нээгдсэн имэйлийн лог ID — modal харуулна */
  const [previewId, setPreviewId] = useState<string | null>(null);
  /** Идэвхтэй bulk фолдер (batchId) — модал */
  const [openBatch, setOpenBatch] = useState<string | null>(null);
  const sel = useBulkSelect({
    endpoint: '/admin/email/logs/bulk-delete',
    invalidate: ['admin-email-logs'],
    label: 'лог',
  });

  /**
   * ⚠️ BULK ФОЛДЕРУУД — кино реклам/broadcast нэг «фолдер» болж
   * харагдана (500 имэйл тус тусдаа мөр болж пагинаци тэсэлгэхгүй).
   */
  const { data: grouped } = useQuery({
    queryKey: ['admin-email-folders'],
    queryFn: () =>
      api<{
        folders: {
          batchId: string;
          label: string;
          total: number;
          sent: number;
          opened: number;
          createdAt: string;
        }[];
      }>('/admin/email/logs/grouped?limit=1'),
    staleTime: 30_000,
  });

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
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

      {/* ⚠️ BULK / КАМПАНИТ ФОЛДЕРУУД — кино реклам, broadcast.
          Нэг фолдер = нэг илгээлт. Дарж дэлгэрэнгүйг модалд харна
          (пагинаци тэсэлгэхгүй). */}
      {!!grouped?.folders?.length && (
        <div className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Бөөн илгээлтүүд ({grouped.folders.length})
          </h3>
          {/*
            ⚠️⚠️ НЭГ ЭГНЭЭНД ХЭВТЭЭ ГҮЙЛГЭНЭ — өмнө нь `grid` байсан тул
            кампанит ажил олон болоход ДООШ сунаж хуудсыг эзэлдэг байв
            (7 илгээлт = 3 мөр). Backend нь `createdAt desc`-ээр өгдөг
            тул СҮҮЛД илгээсэн нь ЭХЭНД харагдана.

            ⚠️ `shrink-0 w-[17.5rem]` — эс бөгөөс карт шахагдаж гарчиг
               уншигдахгүй болно.
            ⚠️ `snap-x` — гар утсанд картаар нь таслаж зогсоно.
            ⚠️ `pb-1` — scrollbar карттай наалдахгүй.
          */}
          <div className="flex snap-x gap-2 overflow-x-auto pb-1">
            {grouped.folders.map((fo) => {
              const rate = fo.total ? Math.round((fo.opened / fo.total) * 100) : 0;
              return (
                <button
                  key={fo.batchId}
                  onClick={() => setOpenBatch(fo.batchId)}
                  className="flex w-[17.5rem] shrink-0 snap-start items-start gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
                >
                  <span className="mt-0.5 shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
                    <FolderOpen size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {fo.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {fo.total.toLocaleString()} имэйл · {rate}% нээлт
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground/70">
                      {formatDate(fo.createdAt)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {openBatch && (
        <EmailBatchDialog batchId={openBatch} onClose={() => setOpenBatch(null)} />
      )}

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

      {/* ⚠️ Огноо солиход `page:1` — эс бөгөөс 5-р хуудсанд байхад
          шүүхэд хоосон харагдана */}
      <DataToolbar
        search={f.search}
        onSearch={(v) => set({ search: v })}
        searchPlaceholder="Имэйл хаяг эсвэл гарчгаар хайх..."
        from={f.from}
        to={f.to}
        onDateRange={(from, to) => set({ from, to, page: 1 })}
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
          setF({
            search: '', template: 'ALL', status: 'ALL', opened: 'ALL',
            /* ⚠️ Огноог Ч цэвэрлэнэ — эс бөгөөс «Цэвэрлэх» дарсан ч
               шүүлт үлдэж, админ эргэлзэнэ */
            from: '', to: '',
            page: 1, limit: 20,
          })
        }
      />

      {/* ⚠️ АЛДААНЫ ТӨЛӨВ — API унахад «имэйл байхгүй» гэж ХУДАЛ
          мэдээлдэг байсан. Админ бодит шалтгааныг харах ёстой. */}
      {isError && <AdminErrorState error={error} onRetry={() => void refetch()} />}

      {/**
       * ⚠️ SKELETON — ЗӨВХӨН кэшгүй АНХНЫ ачаалалтад.
       *
       * Өмнө нь зөвхөн `opacity-60` байсан тул анхны ачаалалтад ХООСОН
       * хүснэгт харагдаж, дараа нь гэнэт дүүрдэг байв (төслийн «spinner
       * БИШ skeleton» дүрэм — `coupons`, `faqs`, `plans` бүгд ингэсэн).
       *
       * ⚠️ Хуудас/шүүлт солиход `isFetching` л асах тул хүснэгт
       * байрандаа үлдэж, skeleton гэнэт үсэрч гарахгүй.
       */}
      {isLoading && !isError && (
        <div className="admin-card mt-5 rounded-xl p-4">
          <TableSkeleton rows={8} />
        </div>
      )}

<div
        className={cn(
          'admin-card mt-5 overflow-x-auto rounded-xl transition-opacity',
          isFetching && 'opacity-60',
          /* ⚠️ Skeleton харагдаж байхад хүснэгт ДАВХАР гарахгүй */
          isLoading && !isError && 'hidden',
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
              <tr
                key={l.id}
                /* ⚠️ Мөр дээр дарахад бодит илгээсэн имэйл нээгдэнэ */
                onClick={() => setPreviewId(l.id)}
                className="cursor-pointer transition-colors hover:bg-accent/40"
                title="Илгээсэн имэйлийг харах"
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
        {!data?.items.length && !isFetching && !isError && (
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

      {/* ⚠️ Бодит илгээсэн имэйлийг харах */}
      {previewId && (
        <EmailPreviewModal id={previewId} onClose={() => setPreviewId(null)} />
      )}
    </>
  );
}

// ─── Бүртгүүлэгчид ────────────────────────────────────────────────────────────

function SubscribersTab() {
  // Сүүлийн үзэлтээс хойш шинээр бүртгүүлсэн хүмүүсийг тэмдэглэнэ
  const isNew = useNewSince('subscribers');
  const [f, setF] = useState({
    q: '', status: 'ALL', source: 'ALL',
    /** ⚠️ «Сүүлийн 3 өдөр хэд нэмэгдсэн» — UB өдрийн хилээр */
    from: '', to: '',
    page: 1, limit: 20,
  });
  const [exporting, setExporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const qc = useQueryClient();

  /* Олноор устгах — тест бүртгэл цэвэрлэх */
  const sel = useBulkSelect({
    endpoint: '/admin/email/subscribers/bulk-delete',
    invalidate: ['admin-subscribers'],
    label: 'бүртгүүлэгч',
  });

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
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
        from={f.from}
        to={f.to}
        onDateRange={(from, to) => set({ from, to, page: 1 })}
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
        onReset={() =>
          /* ⚠️ Огноог Ч цэвэрлэнэ */
          setF({ q: '', status: 'ALL', source: 'ALL', from: '', to: '', page: 1, limit: 20 })
        }
        actions={
          <div className="flex gap-2">
            {/* ⚠️ Дутуу нэгтгэх — данс нээсэн ч Subscriber-т ороогүй
                (хуучин/OAuth) баталгаажсан хэрэглэгчдийг нэгтгэнэ */}
            <button
              onClick={async () => {
                try {
                  const res = await api<{ added: number; scanned: number }>(
                    '/admin/email/subscribers/backfill',
                    { method: 'POST' },
                  );
                  toast.success(
                    res.added
                      ? `${res.added} дутуу хэрэглэгч нэгтгэгдлээ`
                      : 'Дутуу хэрэглэгч алга — бүгд нэгдсэн',
                  );
                  qc.invalidateQueries({ queryKey: ['admin-subscribers'] });
                  qc.invalidateQueries({ queryKey: ['admin-email-audience-counts'] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Нэгтгэж чадсангүй');
                }
              }}
              className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              title="Данс нээсэн ч жагсаалтад ороогүй хэрэглэгчдийг нэгтгэх"
            >
              <Users size={15} /> Дутуу нэгтгэх
            </button>
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <UserPlus size={15} /> Имэйл нэмэх
            </button>
          </div>
        }
      />

      {adding && (
        <AddSubscribersDialog
          onClose={() => {
            setAdding(false);
            qc.invalidateQueries({ queryKey: ['admin-subscribers'] });
          }}
        />
      )}

      {/* ⚠️ АЛДААНЫ ТӨЛӨВ — API унахад «имэйл байхгүй» гэж ХУДАЛ
          мэдээлдэг байсан. Админ бодит шалтгааныг харах ёстой. */}
      {isError && <AdminErrorState error={error} onRetry={() => void refetch()} />}

      {/**
       * ⚠️ SKELETON — ЗӨВХӨН кэшгүй АНХНЫ ачаалалтад.
       *
       * Өмнө нь зөвхөн `opacity-60` байсан тул анхны ачаалалтад ХООСОН
       * хүснэгт харагдаж, дараа нь гэнэт дүүрдэг байв (төслийн «spinner
       * БИШ skeleton» дүрэм — `coupons`, `faqs`, `plans` бүгд ингэсэн).
       *
       * ⚠️ Хуудас/шүүлт солиход `isFetching` л асах тул хүснэгт
       * байрандаа үлдэж, skeleton гэнэт үсэрч гарахгүй.
       */}
      {isLoading && !isError && (
        <div className="admin-card mt-5 rounded-xl p-4">
          <TableSkeleton rows={8} />
        </div>
      )}

<div
        className={cn(
          'admin-card mt-5 overflow-x-auto rounded-xl transition-opacity',
          isFetching && 'opacity-60',
          /* ⚠️ Skeleton харагдаж байхад хүснэгт ДАВХАР гарахгүй */
          isLoading && !isError && 'hidden',
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
        {!data?.items.length && !isFetching && !isError && (
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
  /** ⚠️ Сонгосон сайтын нэр — preview дэх hardcode «BestTV»-г орлоно */
  const { label: siteLabel } = useSiteUrl();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    subject: '',
    heading: '',
    body: '',
    ctaText: '',
    ctaUrl: '',
    audience: 'subscribers',
    /* ⚠️ Илгээгчийн НЭР (хаяг БИШ — MAIL_FROM хэвээр) */
    senderName: '',
  });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  /* ⚠️ Хадгалсан загварууд — сүүлд ашигласан нь эхэнд */
  const { data: templates } = useQuery({
    queryKey: ['admin-email-templates'],
    queryFn: () =>
      api<
        {
          id: string;
          name: string;
          subject: string;
          heading: string;
          bodyHtml: string;
          ctaText: string | null;
          ctaUrl: string | null;
          senderName: string | null;
        }[]
      >('/admin/email/templates'),
    staleTime: 30_000,
  });

  /**
   * ⚠️⚠️ ЗУРАГ — `/uploads/email-image` (энгийн `/uploads/image` БИШ).
   *
   * Тэр нь WebP болгодог бөгөөс Outlook (Windows) нь WebP-г ОГТ
   * дэмждэггүй — зураг харагдахгүй болно. Имэйлийн endpoint нь JPEG
   * болгож, БАЙНГЫН URL буцаана.
   */

  /** Загвараа хадгалах — нэр асууна */
  const saveTemplate = async () => {
    if (!form.subject.trim() || !form.heading.trim() || !form.body.trim()) {
      return toast.error('Гарчиг, толгой, агуулга заавал');
    }
    const name = window.prompt('Загварын нэр:', form.subject.slice(0, 40));
    if (!name?.trim()) return;
    try {
      await api('/admin/email/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          subject: form.subject,
          heading: form.heading,
          bodyHtml: form.body,
          ctaText: form.ctaText || undefined,
          ctaUrl: form.ctaUrl || undefined,
          senderName: form.senderName || undefined,
        }),
      });
      void qc.invalidateQueries({ queryKey: ['admin-email-templates'] });
      toast.success('Загвар хадгалагдлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Хадгалж чадсангүй');
    }
  };

  /**
   * ⚠️⚠️ УРЬДЧИЛАН ХАРАХ — илгээхийн ӨМНӨ ЗААВАЛ.
   * Илгээсэн имэйлийг БУЦААХ БОЛОМЖГҮЙ.
   */
  const openPreview = async () => {
    if (!form.heading.trim() || !form.body.trim()) {
      return toast.error('Толгой ба агуулга заавал');
    }
    try {
      const r = await api<{ html: string }>('/admin/email/preview', {
        method: 'POST',
        body: JSON.stringify({
          subject: form.subject || '(гарчиггүй)',
          heading: form.heading,
          bodyHtml: form.body,
          ctaText: form.ctaText || undefined,
          ctaUrl: form.ctaUrl || undefined,
          senderName: form.senderName || undefined,
        }),
      });
      setPreview(r.html);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Урьдчилан харж чадсангүй');
    }
  };

  /** Хүлээн авагчийн бодит тоо — аль сонголт хэдэн хүнд очих */
  const { data: counts } = useQuery({
    queryKey: ['admin-email-audience-counts'],
    queryFn: () =>
      api<{ subscribers: number; users: number; both: number }>(
        '/admin/email/audience-counts',
      ),
    staleTime: 60_000,
  });
  const audienceCount =
    form.audience === 'subscribers'
      ? counts?.subscribers
      : form.audience === 'users'
        ? counts?.users
        : counts?.both;

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
          /* ⚠️ Дамжуулахгүй бол админы бичсэн нэр ЧИМЭЭГҮЙ алдагдана */
          senderName: form.senderName || undefined,
          audience: form.audience,
        }),
      });
      toast.success(`${res.queued} хаяг руу дараалалд орлоо`);
      qc.invalidateQueries({ queryKey: ['admin-email-logs'] });
      /* ⚠️ `senderName`, `audience` нь ҮЛДЭНЭ — ижил илгээгч/сонсогчид
         дараалан хэд хэдэн имэйл явуулах нь түгээмэл */
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
            <option value="subscribers">
              Зөвхөн имэйл өгсөн (бүртгүүлэгч){counts ? ` — ${counts.subscribers}` : ''}
            </option>
            <option value="users">
              Данс нээсэн хэрэглэгчид{counts ? ` — ${counts.users}` : ''}
            </option>
            <option value="both">Хоёулаа{counts ? ` — ${counts.both}` : ''}</option>
          </select>
          {/* ⚠️ Ялгааг ТОДОРХОЙ тайлбарлана — «хэрэглэгч» vs «бүртгүүлэгч»
              андуурагдахгүй. Тоо нь opt-out хасагдсаны ДАРААХ бодит хүн. */}
          <span className="mt-1.5 block text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Хэрэглэгч</strong> = сайтад данс нээж нэвтэрдэг ·{' '}
            <strong className="text-foreground">Бүртгүүлэгч</strong> = зөвхөн имэйлээ өгсөн (данс нээгээгүй)
            {typeof audienceCount === 'number' && (
              <>
                {' · '}
                <strong className="text-primary">{audienceCount.toLocaleString()} хүнд очно</strong>
              </>
            )}
          </span>
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

        {/* ⚠️ Илгээгчийн НЭР — хаяг нь MAIL_FROM хэвээр (SES
            баталгаажуулалт шаарддаг тул энд солих боломжгүй) */}
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Илгээгчийн нэр (заавал биш — өгөгдмөл «BestTV»)
          </span>
          <input
            value={form.senderName}
            onChange={(e) => setForm({ ...form, senderName: e.target.value })}
            placeholder="BestTV"
            maxLength={60}
            className="admin-input"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Хаяг нь хэвээр үлдэнэ — зөвхөн харагдах нэр солигдоно
          </span>
        </label>

        <div className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Агуулга — Word шиг форматлана (тод, өнгө, жагсаалт, зураг)
          </span>

          {/**
           * ⚠️⚠️ TipTap — блог/хуудастай ИЖИЛ редактор.
           *
           * Гаралт нь HTML. Backend нь `toEmailHtml()`-ээр имэйлд
           * тохируулан хувиргана: имэйлийн клиент CSS класс ачаалдаггүй
           * тул inline `style` болгож, бараан карт дээр уншигдах өнгө
           * тавина.
           *
           * ⚠️ Урьдчилан харах нь ЯГ ТЭР хувиргалтаар дамждаг тул
           * админы харсан зүйл хүлээн авагчийнхтай ИЖИЛ.
           */}
          <RichEditor
            value={form.body}
            onChange={(html) => setForm((f) => ({ ...f, body: html }))}
            placeholder="Сайн байна уу! Энэ долоо хоногт…"
            minHeight={260}
            /* ⚠️⚠️ `email` — 600px JPEG. Анхдагч `gallery` нь 1920px
               WebP бөгөөс Outlook (Windows) нь WebP-г ОГТ дэмждэггүй
               тул имэйлд зураг харагдахгүй болно. */
            imageKind="email"
          />

          <span className="mt-1 block text-[11px] text-muted-foreground">
            ⚠️ Илгээхийн өмнө «Урьдчилан харах» дарж шалгаарай — илгээсэн
            имэйлийг буцаах боломжгүй
          </span>
        </div>

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

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={send}
            disabled={busy}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Илгээх
          </button>

          {/* ⚠️⚠️ УРЬДЧИЛАН ХАРАХ — илгээсэн имэйлийг БУЦААХ
              БОЛОМЖГҮЙ тул заавал шалгах ёстой */}
          <button
            onClick={() => void openPreview()}
            type="button"
            className="btn-secondary flex items-center gap-2"
          >
            <MailOpen size={15} />
            Урьдчилан харах
          </button>

          <button
            onClick={() => void saveTemplate()}
            type="button"
            className="btn-secondary flex items-center gap-2"
          >
            <FolderOpen size={15} />
            Загвар болгож хадгалах
          </button>
        </div>

        {/* ⚠️ Хадгалсан загварууд — сонгоход маягт дүүрнэ.
            Сүүлд ашигласан нь эхэнд. */}
        {!!templates?.length && (
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Хадгалсан загвар ({templates.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-1 rounded-md bg-secondary pl-2.5 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        subject: t.subject,
                        heading: t.heading,
                        body: t.bodyHtml,
                        ctaText: t.ctaText ?? '',
                        ctaUrl: t.ctaUrl ?? '',
                        senderName: t.senderName ?? '',
                      }));
                      toast.success(`«${t.name}» ачааллаа`);
                    }}
                    className="py-1.5 font-medium text-foreground hover:text-primary"
                  >
                    {t.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`${t.name} устгах`}
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Загвар устгах уу?',
                        description: `«${t.name}» устгагдана. Илгээсэн имэйлийн түүхэд НӨЛӨӨЛӨХГҮЙ.`,
                        confirmLabel: 'Устгах',
                        tone: 'danger',
                      });
                      if (!ok) return;
                      try {
                        await api(`/admin/email/templates/${t.id}`, { method: 'DELETE' });
                        void qc.invalidateQueries({ queryKey: ['admin-email-templates'] });
                        toast.success('Устгагдлаа');
                      } catch {
                        toast.error('Устгаж чадсангүй');
                      }
                    }}
                    className="px-1.5 py-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ⚠️ Урьдчилан харах — sandbox iframe (скрипт ажиллуулахгүй) */}
      {preview !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="admin-card flex max-h-[85vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {form.subject || '(гарчиггүй)'}
                </p>
                {/* ⚠️ `siteLabel` — hardcode «BestTV» байсан. Энэ нь буцаах
                    БОЛОМЖГҮЙ илгээлтийн ӨМНӨХ сүүлчийн шалгалт тул
                    BestFilm-ийн кампанит ажлыг «BestTV»-ээс ирэх мэт
                    харуулж, админыг андуурна. */}
                <p className="text-xs text-muted-foreground">
                  Илгээгч: {form.senderName || siteLabel}
                </p>
              </div>
              <button
                onClick={() => setPreview(null)}
                aria-label="Хаах"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
              >
                <X size={16} />
              </button>
            </div>
            <iframe
              srcDoc={preview}
              sandbox=""
              title="Имэйлийн урьдчилан харах"
              className="h-[70vh] w-full border-0 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Хориглосон хаяг ──────────────────────────────────────────────────────────

function SuppressionsTab() {
  // Шинээр нэмэгдсэн bounce/complaint — SES нэр хүндэд аюултай, шуурхай харах
  const isNew = useNewSince('email-issues');
  /**
   * ⚠️ SERVER талын хуудаслалт + хайлт — bounce/complaint удаан хугацаанд
   * хэдэн зуу, мянга болдог тул client-д бүгдийг татах боломжгүй
   * (coupons/logs таб-тай ижил pattern).
   */
  const LIMIT = 20;
  const [q, setQ] = useState('');
  /** ⚠️ Огнооны муж — «сүүлийн 7 хоногт хэд хоригдсон» гэх шүүлтэд */
  const [range, setRange] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);

  /* ⚠️ Хайлтыг debounce — үсэг бүрд сервер рүү очихгүй */
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  /* ⚠️ Хайлт солиход эхний хуудас руу буцах (хоосон хуудсанд гацахгүй) */
  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['admin-suppressions', { page, search: debouncedQ, ...range }],
    queryFn: () => {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('limit', String(LIMIT));
      if (debouncedQ) qs.set('search', debouncedQ);
      /* ⚠️ UB өдрийн хилээр — backend `ubRangeFilter` */
      if (range.from) qs.set('from', range.from);
      if (range.to) qs.set('to', range.to);
      return api<{
        items: { id: string; email: string; reason: string; subType: string | null; createdAt: string }[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/admin/email/suppressions?${qs}`);
    },
    placeholderData: (prev) => prev,
    staleTime: 0,
  });
  const rows = data?.items ?? [];

  /**
   * ⚠️⚠️ СТАТИСТИК — админ хэдэн хаяг хориглогдсоныг ОГТ мэдэхгүй байв.
   * Bounce хэт өсөх нь SES-ийн нэр хүндэд ШУУД аюул: доошилвол БҮХ
   * имэйл спам руу орно. Тиймээс нэг харцаар харагдана.
   *
   * ⚠️ Хайлтаас ХАМААРАХГҮЙ — нийт зураглал үргэлж ижил байх ёстой.
   */
  const stats = useQuery({
    queryKey: ['admin-suppression-stats'],
    queryFn: () =>
      api<{
        total: number;
        last7: number;
        last30: number;
        byReason: Record<string, number>;
        bySubType: { subType: string; count: number }[];
      }>('/admin/email/suppressions/stats'),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      {/* ⚠️ Сүүлийн 7 хоног нь ХАМГИЙН чухал — гэнэт өсвөл асуудал */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<ShieldOff size={17} />}
          label="Нийт хориглосон"
          value={stats.data?.total ?? 0}
          tone="warning"
        />
        <StatCard
          icon={<XCircle size={17} />}
          label="Bounce (буцсан)"
          value={stats.data?.byReason?.bounce ?? 0}
          tone="danger"
        />
        <StatCard
          icon={<AlertTriangle size={17} />}
          label="Гомдол"
          value={
            (stats.data?.byReason?.complaint ?? 0) +
            (stats.data?.byReason?.manual ?? 0)
          }
          tone="danger"
        />
        <StatCard
          icon={<Clock size={17} />}
          label="Сүүлийн 7 хоног"
          value={stats.data?.last7 ?? 0}
          tone={(stats.data?.last7 ?? 0) > 50 ? 'danger' : 'default'}
        />
      </div>

      {/* ⚠️ Дэд төрөл — «OnAccountSuppressionList» нь AWS-ийн дотоод
          жагсаалт бөгөөс жинхэнэ буруу хаягаас ЯЛГААТАЙ. Админ
          шалтгааныг ялгаж ойлгох ёстой. */}
      {!!stats.data?.bySubType?.length && (
        <div className="admin-card flex flex-wrap gap-2 rounded-xl p-3">
          {stats.data.bySubType.map((x) => (
            <span
              key={x.subType}
              className="rounded-md bg-secondary px-2.5 py-1 text-xs text-muted-foreground"
            >
              {x.subType} <span className="font-bold text-foreground">{x.count}</span>
            </span>
          ))}
        </div>
      )}

    <div className="admin-card overflow-hidden rounded-xl">
      <p className="border-b border-border p-4 text-xs text-muted-foreground">
        Bounce/complaint ирсэн хаягууд — эдгээр рүү дахин илгээхгүй. Ингэснээр SES-ийн нэр хүнд
        (reputation) хамгаалагдаж, бусад имэйл спам болохоос сэргийлнэ.
      </p>
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Имэйл хаягаар хайх…"
            aria-label="Хориглосон хаяг хайх"
            className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>

        {/*
          ⚠️ ОГНООНЫ ХУРДАН СОНГОЛТ — «сүүлийн 7 хоногт хэд хоригдсон»
          гэх асуултад шууд хариулна. `DataToolbar`-тай ИЖИЛ preset.
          ⚠️ Огноо солиход `page:1` — эс бөгөөс хоосон харагдана.
        */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Хугацаа
          </span>
          {DATE_PRESETS.map((p) => {
            const r = presetRange(p.days, p.offset);
            const active = range.from === r.from && range.to === r.to;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setRange(r);
                  setPage(1);
                }}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-accent/60 text-muted-foreground hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            );
          })}
          {(range.from || range.to) && (
            <button
              onClick={() => {
                setRange({ from: '', to: '' });
                setPage(1);
              }}
              className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Цэвэрлэх
            </button>
          )}
        </div>
      </div>
      {/* ⚠️ АЛДААНЫ ТӨЛӨВ — API унахад «имэйл байхгүй» гэж ХУДАЛ
          мэдээлдэг байсан. Админ бодит шалтгааныг харах ёстой. */}
      {isError && <AdminErrorState error={error} onRetry={() => void refetch()} />}

      {/**
       * ⚠️ SKELETON — ЗӨВХӨН кэшгүй АНХНЫ ачаалалтад.
       *
       * Өмнө нь зөвхөн `opacity-60` байсан тул анхны ачаалалтад ХООСОН
       * хүснэгт харагдаж, дараа нь гэнэт дүүрдэг байв (төслийн «spinner
       * БИШ skeleton» дүрэм — `coupons`, `faqs`, `plans` бүгд ингэсэн).
       *
       * ⚠️ Хуудас/шүүлт солиход `isFetching` л асах тул хүснэгт
       * байрандаа үлдэж, skeleton гэнэт үсэрч гарахгүй.
       */}
      {isLoading && !isError && (
        <div className="admin-card mt-5 rounded-xl p-4">
          <TableSkeleton rows={8} />
        </div>
      )}

<div className={cn('overflow-x-auto', isLoading && !isError && 'hidden')}>
        <table className={cn('w-full text-sm transition-opacity', isFetching && 'opacity-60')}>
          <thead className="bg-accent/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Имэйл</th>
              <th className="px-4 py-3 text-left font-semibold">Шалтгаан</th>
              <th className="px-4 py-3 text-left font-semibold">Огноо</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((s) => (
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
      </div>
      {!rows.length && !isFetching && !isError && (
        /* ⚠️ Хайлтын хоосон үр дүн БА огт хориглосон хаяггүй хоёрыг ЯЛГАНА */
        <TableEmptyState
          icon={ShieldOff}
          message={debouncedQ ? 'Хайлтад тохирох хаяг олдсонгүй' : 'Хориглосон хаяг байхгүй — сайн байна 👍'}
        />
      )}

      <Pagination
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        total={data?.total}
        limit={LIMIT}
        onPage={(p) => setPage(p)}
      />
    </div>
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
      {/*
        ⚠️⚠️ ХОЁР ӨӨР ШАЛТГААНЫГ ЯЛГАНА — өмнө нь хольсон.

        БОДИТ ТӨӨРӨГДӨЛ (2026-09-09): BestFilm-д амжилттай илгээсэн
        имэйл 0 байсан тул «Configuration Set ҮҮСГЭ» гэж зөвлөсөн.
        Гэтэл тэр нь аль хэдийн үүссэн, ажиллаж байсан — админ
        байхгүй асуудлыг засах гэж AWS дээр дэмий ажил хийх байлаа.
      */}
      {!insight.deliveryTracking &&
        (insight.deliveryConfigured ? (
          <p className="mt-3 flex items-start gap-1.5 border-t border-border pt-2.5 text-xs text-muted-foreground">
            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
            <span>
              <span className="text-foreground/80">Хяналт бүрэн тохируулагдсан.</span>{' '}
              «Хүрсэн / Дарсан» багана нь энэ сайтаас имэйл амжилттай илгээгдмэгц
              бөглөгдөнө — одоогоор илгээсэн имэйл алга.
            </span>
          </p>
        ) : (
          <p className="mt-3 flex items-start gap-1.5 border-t border-border pt-2.5 text-xs text-muted-foreground">
            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-premium" />
            <span>
              <span className="text-foreground/80">Нээлтийн хяналт ажиллаж байна.</span>{' '}
              «Хүрсэн / Дарсан» багана хоосон — AWS SES-д Configuration Set үүсгээд{' '}
              <code className="rounded bg-foreground/10 px-1">SES_CONFIGURATION_SET</code>{' '}
              тохируулбал нэмэгдэнэ.
            </span>
          </p>
        ))}

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
/**
 * ⚠️⚠️ БОДИТ ИЛГЭЭСЭН ИМЭЙЛИЙГ ХАРУУЛАХ MODAL.
 *
 * Админ гомдол шалгахад «хэрэглэгчид ЯГ ЮУ очсон» бэ гэдгийг харах
 * ёстой. Өмнө нь зөвхөн хаяг, гарчиг л харагддаг тул загвар зөв
 * эсэхийг таамаглах шаардлагатай байв.
 *
 * ⚠️ `srcDoc`-той iframe — гадаад скрипт ажиллуулахгүй (sandbox),
 * гэхдээ имэйлийн CSS/зураг бүрэн харагдана.
 */
function EmailPreviewModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-email-html', id],
    queryFn: () =>
      api<{
        found: boolean;
        to?: string;
        subject?: string;
        template?: string;
        status?: string;
        html?: string | null;
        createdAt?: string;
      }>(`/admin/email/logs/${id}/html`),
    enabled: !!id,
  });

  /* Esc дарахад хаана */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {data?.subject ?? 'Имэйл'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {data?.to}
              {data?.createdAt ? ` · ${formatDateTime(data.createdAt)}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Хаах"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-white">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Ачаалж байна…
            </div>
          ) : data?.html ? (
            /* ⚠️ sandbox — имэйл доторх скрипт ХЭЗЭЭ Ч ажиллахгүй */
            <iframe
              srcDoc={data.html}
              sandbox=""
              title="Имэйлийн урьдчилан харах"
              className="h-[70vh] w-full border-0"
            />
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-sm font-medium text-foreground">Агуулга хадгалагдаагүй</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Энэ имэйл нь HTML хадгалах боломж нэмэгдэхээс ӨМНӨ илгээгдсэн байна.
                Үүнээс хойш илгээгдсэн имэйлүүд бүрэн харагдана.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
