'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Mail,
  Package,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  UserPlus,
  XCircle,
  Zap,
  Gauge,
  Activity,
  MailOpen,
  Eye,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, ErrorState, Loading } from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';
import type { AdminOrder, EmailStats } from '@/types/admin';
import { AnalyticsSection } from '@/components/analytics-section';

// ── Захиалагчийн эх сурвалжийн нэрийг Монголоор харуулах ──
const SUBSCRIBER_SOURCE_LABELS: Record<string, string> = {
  homepage: 'Нүүр хуудас',
  'web-register': 'Веб бүртгэл',
  popup: 'Поп-ап',
  checkout: 'Худалдан авалт',
  import: 'Импорт',
  admin: 'Админ',
  'free-ppt': 'Үнэгүй PPT',
};

function subscriberSourceLabel(source: string): string {
  return SUBSCRIBER_SOURCE_LABELS[source] ?? source;
}

// ── Тренд badge (өмнөх сартай харьцуулсан өсөлт/бууралт) ──
function TrendBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        <Minus className="h-3 w-3" /> шинэ
      </span>
    );
  }
  const up = value > 0;
  const flat = value === 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const cls = flat
    ? 'bg-muted text-muted-foreground'
    : up
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${cls}`}>
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}{value}%
    </span>
  );
}

type StatusInfo = { label: string; cls: string; icon: React.ReactNode };
const STATUS_MAP: Record<string, StatusInfo> = {
  PAID:      { label: 'Төлсөн',           cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   icon: <CheckCircle2 className="h-3 w-3" /> },
  PENDING:   { label: 'Хүлээгдэж байна',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',   icon: <Clock className="h-3 w-3" /> },
  FAILED:    { label: 'Амжилтгүй',        cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           icon: <XCircle className="h-3 w-3" /> },
  REFUNDED:  { label: 'Буцаасан',         cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',       icon: <RotateCcw className="h-3 w-3" /> },
  CANCELLED: { label: 'Цуцалсан',         cls: 'bg-muted text-muted-foreground',                                          icon: <Ban className="h-3 w-3" /> },
};

function formatMoney(value: number | string) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('mn-MN').format(n) + ' ₮';
}

function getMonthLabel(offset: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return `${d.getMonth() + 1}-р сар`;
}

const STAT_CARDS = [
  {
    key: 'users',
    label: 'Хэрэглэгч',
    desc: 'Нийт бүртгэлтэй',
    href: '/users',
    icon: Users,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/40',
  },
  {
    key: 'products',
    label: 'Бүтээгдэхүүн',
    desc: 'Нийт бүтээгдэхүүн',
    href: '/products',
    icon: Package,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-100 dark:bg-violet-900/40',
  },
  {
    key: 'orders',
    label: 'Захиалга',
    desc: 'Нийт захиалга',
    href: '/orders',
    icon: ShoppingCart,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
  },
  {
    key: 'revenue',
    label: 'Орлого',
    desc: 'Төлсөн захиалгаас',
    href: '/orders',
    icon: DollarSign,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/40',
    isMoney: true,
  },
];

function UserAvatar({ user }: { user: AdminOrder['user'] }) {
  const initials = (user.name ?? user.email).charAt(0).toUpperCase();
  if (user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.image} alt={user.name ?? user.email} className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border" referrerPolicy="no-referrer" />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
      {initials}
    </div>
  );
}

function OrderRow({ order }: { order: AdminOrder }) {
  const d = new Date(order.createdAt);
  const dateStr = `${String(d.getFullYear()).slice(2)}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const firstItem = order.items[0];
  const extraCount = order.items.length - 1;
  const statusInfo = STATUS_MAP[order.status] ?? STATUS_MAP.CANCELLED;

  return (
    <Link
      href="/orders"
      className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0 group min-w-0"
    >
      {/* Order ID */}
      <span className="shrink-0 w-28 inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide text-foreground">
        #{order.id.slice(-8).toUpperCase()}
      </span>

      {/* User — only on xl */}
      <div className="hidden xl:flex items-center gap-2 min-w-0 w-48 shrink-0">
        <UserAvatar user={order.user} />
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate leading-tight">{order.user.name ?? '—'}</p>
          <p className="text-[10px] text-muted-foreground truncate">{order.user.email}</p>
        </div>
      </div>

      {/* Product — takes remaining space */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {firstItem?.product.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={firstItem.product.previewUrl} alt={firstItem.product.title}
            className="h-8 w-12 shrink-0 rounded object-cover border border-border bg-muted" referrerPolicy="no-referrer" />
        ) : (
          <div className="h-8 w-12 shrink-0 rounded bg-muted border border-border flex items-center justify-center">
            <Package className="h-3.5 w-3.5 text-muted-foreground/40" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium leading-tight">{firstItem?.product.title ?? '—'}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {firstItem?.product.compareAtPrice && (
              <span className="text-[10px] line-through text-muted-foreground tabular-nums">{formatMoney(firstItem.product.compareAtPrice)}</span>
            )}
            <span className="text-[10px] font-semibold text-primary tabular-nums">{formatMoney(firstItem?.product.price ?? 0)}</span>
            {extraCount > 0 && <span className="text-[10px] text-muted-foreground">+{extraCount}</span>}
          </div>
        </div>
      </div>

      {/* Download count */}
      <div className="shrink-0 w-20 text-right">
        <p className="text-xs tabular-nums text-muted-foreground">{firstItem?.product.downloadCount ?? 0}</p>
      </div>

      {/* Amount */}
      <div className="shrink-0 text-right w-32 pr-6">
        <p className="text-sm font-bold tabular-nums">{formatMoney(order.total)}</p>
      </div>

      {/* Status */}
      <div className="shrink-0 w-28 flex justify-start">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${statusInfo.cls}`}>
          {statusInfo.icon}{statusInfo.label}
        </span>
      </div>

      {/* Date */}
      <div className="shrink-0 text-right w-20">
        <p className="text-[10px] font-medium text-foreground tabular-nums">{dateStr}</p>
        <p className="text-[10px] text-muted-foreground tabular-nums">{timeStr}</p>
      </div>
    </Link>
  );
}

function EmailStatsPanel({ stats }: { stats: EmailStats }) {
  const provider = stats.provider ?? 'AWS SES';

  // ── 24 цагийн (өдрийн) sending quota ──
  // Backend getSendQuota()-аас ирвэл sentToday/dailyLimit ашиглана.
  // Эс бол dailyLimit-ийг monthlyLimit (50000)-аар нөхнө, sentToday мэдэгдэхгүй.
  const dailyLimit = stats.dailyLimit ?? stats.monthlyLimit ?? 50000;
  const sentToday = stats.sentToday ?? null;
  const dayPct = sentToday !== null && dailyLimit > 0
    ? Math.round((sentToday / dailyLimit) * 100)
    : 0;
  const dayWarning = dayPct >= 80;
  const dayCritical = dayPct >= 95;

  // ── Reputation (bounce/complaint) — байвал ──
  const bouncePct = stats.bounceRate != null ? stats.bounceRate * 100 : null;
  const complaintPct = stats.complaintRate != null ? stats.complaintRate * 100 : null;
  // AWS босго: bounce > 5% danger, > 2% warning; complaint > 0.5% danger, > 0.1% warning
  const bounceDanger = bouncePct != null && bouncePct >= 5;
  const bounceWarn = bouncePct != null && bouncePct >= 2;
  const complaintDanger = complaintPct != null && complaintPct >= 0.5;
  const complaintWarn = complaintPct != null && complaintPct >= 0.1;

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">AWS SES хяналт</h2>
          {!stats.configured && (
            <Badge variant="destructive" className="text-[10px]">Холбоогүй</Badge>
          )}
        </div>
        {stats.configured ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-amber-500" />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {!stats.configured && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            AWS түлхүүр тохируулаагүй. Имэйл явуулж чадахгүй.
          </p>
        )}

        {/* ── Өдрийн (24ц) quota — гол үзүүлэлт ── */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" /> Өнөөдөр (24ц)
            </span>
            <span className={`text-xs font-bold tabular-nums ${dayCritical ? 'text-destructive' : dayWarning ? 'text-amber-600' : 'text-foreground'}`}>
              {sentToday !== null ? sentToday.toLocaleString() : '—'} / {dailyLimit.toLocaleString()}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${dayCritical ? 'bg-destructive' : dayWarning ? 'bg-amber-500' : 'bg-primary'}`}
              style={{ width: `${Math.min(dayPct, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {sentToday === null ? 'Тоолуур ачаалж байна…' : `Өдрийн квотын ${dayPct}% ашигласан`}
            {stats.maxSendRate != null && ` · ${stats.maxSendRate}/сек`}
          </p>
        </div>

        {/* ── Reputation: bounce / complaint rate ── */}
        {(bouncePct != null || complaintPct != null) && (
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-lg border p-2 ${bounceDanger ? 'border-destructive/40 bg-destructive/5' : bounceWarn ? 'border-amber-400/40 bg-amber-50 dark:bg-amber-900/20' : 'border-border bg-muted/40'}`}>
              <p className="text-[10px] text-muted-foreground">Bounce</p>
              <p className={`text-base font-bold tabular-nums ${bounceDanger ? 'text-destructive' : bounceWarn ? 'text-amber-600' : 'text-foreground'}`}>
                {bouncePct != null ? `${bouncePct.toFixed(2)}%` : '—'}
              </p>
            </div>
            <div className={`rounded-lg border p-2 ${complaintDanger ? 'border-destructive/40 bg-destructive/5' : complaintWarn ? 'border-amber-400/40 bg-amber-50 dark:bg-amber-900/20' : 'border-border bg-muted/40'}`}>
              <p className="text-[10px] text-muted-foreground">Гомдол</p>
              <p className={`text-base font-bold tabular-nums ${complaintDanger ? 'text-destructive' : complaintWarn ? 'text-amber-600' : 'text-foreground'}`}>
                {complaintPct != null ? `${complaintPct.toFixed(3)}%` : '—'}
              </p>
            </div>
          </div>
        )}

        {/* ── Сүүлийн 3 сарын илгээлт ── */}
        <div className="mt-auto">
          <p className="mb-1 text-[10px] font-medium text-muted-foreground">Сүүлийн 3 сар</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: getMonthLabel(2), value: stats.sentTwoMonthsAgo },
              { label: getMonthLabel(1), value: stats.sentLastMonth },
              { label: getMonthLabel(0), value: stats.sentThisMonth, highlight: true },
            ].map((m) => (
              <div
                key={m.label}
                className={`rounded-lg p-2 text-center ${m.highlight ? 'border border-primary/20 bg-primary/10' : 'bg-muted/40'}`}
              >
                <p className={`text-sm font-bold tabular-nums ${m.highlight ? 'text-primary' : 'text-foreground'}`}>
                  {m.value.toLocaleString()}
                </p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Queue */}
        {stats.queueLength > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 dark:bg-blue-900/20">
            <Zap className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            <p className="text-[11px] text-blue-700 dark:text-blue-300">
              {stats.queueLength} имэйл дараалалд хүлээж байна
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Имэйл маркетингийн ТОВЧ summary (30 хоног) — dashboard 3 баганат мөрөнд ──
// Дэлгэрэнгүй (bulk бүрийн хүснэгт) нь доорх Analytics секцэд харагдана.
function EmailMarketingSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'email', 30],
    queryFn: () => adminApi.getEmailAnalytics(30),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Имэйл маркетинг</h2>
        </div>
        <span className="text-[10px] text-muted-foreground">30 хоног</span>
      </div>

      {isLoading ? (
        <div className="flex-1 animate-pulse p-4">
          <div className="h-full rounded-lg bg-muted/40" />
        </div>
      ) : data && data.totalSent > 0 ? (
        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Гол хос: илгээсэн + нээлтийн хувь */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><Send className="h-3 w-3" />Илгээсэн</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-primary">{data.totalSent.toLocaleString('mn-MN')}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><TrendingUp className="h-3 w-3" />Нээлтийн хувь</p>
              <p className={`mt-0.5 text-xl font-bold tabular-nums ${data.overallOpenRate >= 25 ? 'text-green-600 dark:text-green-400' : data.overallOpenRate >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                {data.overallOpenRate}%
              </p>
            </div>
          </div>

          {/* Нээлт / нээсэн хүн */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border border-border/60 px-2 py-2">
              <p className="text-base font-bold tabular-nums">{data.totalOpensPeriod.toLocaleString('mn-MN')}</p>
              <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><MailOpen className="h-3 w-3" />Нийт нээлт</p>
            </div>
            <div className="rounded-lg border border-border/60 px-2 py-2">
              <p className="text-base font-bold tabular-nums">{data.totalUnique.toLocaleString('mn-MN')}</p>
              <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><Eye className="h-3 w-3" />Нээсэн хүн</p>
            </div>
          </div>

          {/* Сүүлийн илгээлт (хамгийн их sent) — товч */}
          {data.campaigns[0] && (
            <div className="mt-auto rounded-lg bg-muted/30 px-3 py-2">
              <p className="truncate text-[11px] font-medium">{data.campaigns[0].label}</p>
              <p className="text-[10px] text-muted-foreground">
                {data.campaigns[0].sent.toLocaleString('mn-MN')} илгээсэн · {data.campaigns[0].uniqueOpens.toLocaleString('mn-MN')} нээсэн ({data.campaigns[0].openRate}%)
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 p-4 text-center">
          <div className="rounded-full bg-muted p-2.5"><Send className="h-5 w-5 text-muted-foreground" /></div>
          <p className="text-xs font-medium">Илгээлт алга</p>
          <Link href="/subscribers" className="text-[11px] font-medium text-primary hover:underline">
            Имэйл явуулах →
          </Link>
        </div>
      )}
    </div>
  );
}

function MonthlyRevenuePanel({ data }: { data: { month: string; revenue: number }[] }) {
  // Сар бүрийг "N-р сар" болгож, revenue-г мянгад хөрвүүлэн график өгөгдөл бэлдэнэ
  const chartData = data.map((d) => {
    const mon = d.month.split('-')[1];
    return { name: `${Number(mon)}-р сар`, revenue: d.revenue };
  });
  const total = data.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <h2 className="font-semibold">Сарын орлого</h2>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold tabular-nums text-primary">{formatMoney(total)}</p>
          <p className="text-[11px] text-muted-foreground">Сүүлийн 3 сар</p>
        </div>
      </div>
      <div className="p-4">
        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Орлогын мэдээлэл алга байна</p>
        ) : (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#022179" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#022179" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))}
                />
                <RechartsTooltip
                  formatter={(v) => [formatMoney(Number(v)), 'Орлого']}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                  }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#022179"
                  strokeWidth={2}
                  fill="url(#revGradient)"
                  dot={{ r: 3, fill: '#022179' }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => adminApi.dashboard(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  if (isLoading) return <Loading label="Хяналтын самбар ачаалж байна..." />;
  if (isError || !data)
    return <ErrorState title="Мэдээлэл ачаалахад алдаа" onRetry={() => refetch()} />;

  const { stats, trends, recentOrders, monthlyRevenue, emailStats, topDownloaded, subscribersBySource } = data;

  const statValues: Record<string, number> = {
    users: stats.users,
    products: stats.products,
    orders: stats.orders,
    revenue: stats.revenue,
  };

  // Stat карт бүрд харгалзах тренд (нийт users-д шинэ хэрэглэгчийн, orders-д захиалгын,
  // revenue-д орлогын сарын өсөлт). Бүтээгдэхүүнд тренд байхгүй.
  const statTrend: Record<string, number | null | undefined> = {
    users: trends?.users,
    orders: trends?.orders,
    revenue: trends?.revenue,
  };

  // Өнөөдрийн огноо (монголоор)
  const todayLabel = new Date().toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Хяналтын самбар</h1>
          <p className="text-sm text-muted-foreground capitalize">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 self-start rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400 sm:self-auto">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Шууд мэдээлэл
        </div>
      </div>

      {/* Main stat cards — тренд badge-тэй */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((card) => {
          const raw = statValues[card.key] ?? 0;
          const display = card.isMoney ? formatMoney(raw) : raw.toLocaleString('mn-MN');
          const Icon = card.icon;
          const trend = statTrend[card.key];
          return (
            <Link key={card.key} href={card.href}>
              <div className="group relative rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className={`rounded-lg p-2 ${card.bg}`}>
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  {/* Тренд (users/orders/revenue) — байгаа үед badge, эс бол hover сум */}
                  {trend !== undefined ? (
                    <TrendBadge value={trend} />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
                <p className="text-2xl font-bold tracking-tight">{display}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{card.desc}</p>
                  <p className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
                    {card.label}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* This month mini stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div className="rounded-lg bg-amber-100 dark:bg-amber-900/40 p-2 shrink-0">
            <ShoppingCart className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums">{stats.ordersThisMonth.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Энэ сарын захиалга (төлсөн)</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div className="rounded-lg bg-blue-100 dark:bg-blue-900/40 p-2 shrink-0">
            <UserPlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums">{stats.newUsersThisMonth.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Энэ сарын шинэ хэрэглэгч</p>
          </div>
        </div>
        <Link
          href="/orders"
          className={`group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-destructive/40 ${
            (stats.pendingExpiredCount ?? 0) > 0 ? 'border-destructive/30' : 'border-border'
          }`}
        >
          <div className={`rounded-lg p-2 shrink-0 ${(stats.pendingExpiredCount ?? 0) > 0 ? 'bg-destructive/10' : 'bg-muted'}`}>
            <Clock className={`h-4 w-4 ${(stats.pendingExpiredCount ?? 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className={`text-xl font-bold tabular-nums ${(stats.pendingExpiredCount ?? 0) > 0 ? 'text-destructive' : ''}`}>
              {(stats.pendingExpiredCount ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">48ц+ хүлээгдэж буй захиалга</p>
          </div>
        </Link>
      </div>

      {/* ── 3 баганат нэг мөр: Subscriber + Email Marketing + AWS SES ──
          Өргөн: эхнийх жижиг (1fr), дунд дунд (1.1fr), AWS том (1.25fr) — дата хэмжээгээр */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr_1.25fr] items-stretch">
        {/* Багана 1 — Subscriber (нийт + эх сурвалж НЭГ block) */}
        <div className="flex h-full flex-col rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-100 p-1.5 dark:bg-emerald-900/40">
                <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-sm font-semibold">Subscriber</h2>
            </div>
            <Link href="/subscribers" className="text-[11px] text-muted-foreground hover:text-primary">
              Бүгд →
            </Link>
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            {/* Нийт + энэ сар */}
            <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold tabular-nums">{stats.subscribersTotal.toLocaleString()}</p>
                {stats.subscribersThisMonth > 0 && (
                  <span className="inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                    энэ сар +{stats.subscribersThisMonth.toLocaleString()}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Нийт захиалагч</p>
            </div>
            {/* Эх сурвалжийн задаргаа — НЭГ block-д нэгтгэв */}
            <div className="flex flex-1 flex-col">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Эх сурвалжаар</p>
              {subscribersBySource.length === 0 ? (
                <p className="text-xs text-muted-foreground">Захиалагч байхгүй</p>
              ) : (
                <div className="flex flex-wrap content-start gap-1.5">
                  {subscribersBySource.map((s) => (
                    <span
                      key={s.source}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2 py-1 text-[11px]"
                    >
                      <span className="text-muted-foreground">{subscriberSourceLabel(s.source)}</span>
                      <span className="font-semibold tabular-nums">{s.count.toLocaleString()}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Багана 2 — Имэйл маркетинг (товч summary) */}
        <EmailMarketingSummary />

        {/* Багана 3 — AWS SES хяналт (өдрийн квота, reputation, 3 сар) */}
        <EmailStatsPanel stats={emailStats} />
      </div>

      {/* 2 баганат: Сарын орлого (recharts) + Бодит таталт зэрэгцээ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Сарын орлого */}
        <MonthlyRevenuePanel data={monthlyRevenue} />

        {/* Бодит таталтын самбар */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-1.5">
                <Download className="h-4 w-4 text-primary" />
              </div>
              <h2 className="font-semibold">Бодит таталт</h2>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold tabular-nums text-primary">
                {(stats.totalRealDownloads ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">Нийт татагдсан</p>
            </div>
          </div>
          {topDownloaded && topDownloaded.length > 0 ? (
            <div className="divide-y divide-border">
              <p className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                Хамгийн их татагдсан бүтээгдэхүүн
              </p>
              {topDownloaded.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-5 shrink-0 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {p.imageUrl ? (
                      <Image src={p.imageUrl} alt={p.title} fill sizes="44px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Package className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{p.type}</Badge>
                      {p.categoryName && (
                        <span className="text-[11px] text-muted-foreground">{p.categoryName}</span>
                      )}
                      <span className="text-[11px] font-medium text-foreground">{formatMoney(p.price)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="flex items-center gap-1 text-sm font-bold tabular-nums text-primary">
                      <Download className="h-3.5 w-3.5" />
                      {p.realDownloadCount.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">удаа татсан</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty state — зөвлөмжтэй */
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <div className="rounded-full bg-muted p-3">
                <Download className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Одоогоор таталт бүртгэгдээгүй</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Хэрэглэгчид бүтээгдэхүүн татаж эхэлмэгц энд хамгийн их татагдсан бүтээгдэхүүнүүд харагдана.
              </p>
              <Link href="/products" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Бүтээгдэхүүн харах <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Analytics section */}
      <AnalyticsSection />

      {/* Recent orders */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <h2 className="font-semibold">Сүүлийн захиалгууд</h2>
          <Link href="/orders" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            Бүгд харах
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border">
          <span className="shrink-0 w-28 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Дугаар</span>
          <span className="hidden xl:flex shrink-0 w-48 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Хэрэглэгч</span>
          <span className="flex-1 min-w-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Бүтээгдэхүүн</span>
          <span className="shrink-0 w-20 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Таталт</span>
          <span className="shrink-0 w-32 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6">Дүн</span>
          <span className="shrink-0 w-28 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Төлөв</span>
          <span className="shrink-0 w-20 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Огноо</span>
        </div>
        {recentOrders.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Захиалга байхгүй байна</p>
        ) : (
          <div>
            {recentOrders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
