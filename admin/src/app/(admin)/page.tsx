'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  Mail,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  UserPlus,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge, ErrorState, Loading } from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';
import type { AdminOrder, EmailStats } from '@/types/admin';

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Төлсөн',
  PENDING: 'Хүлээгдэж байна',
  FAILED: 'Амжилтгүй',
  REFUNDED: 'Буцаасан',
  CANCELLED: 'Цуцалсан',
};

const STATUS_COLORS: Record<string, string> = {
  PAID: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  REFUNDED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  CANCELLED: 'bg-muted text-muted-foreground',
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

function OrderRow({ order }: { order: AdminOrder }) {
  const date = new Date(order.createdAt).toLocaleDateString('mn-MN', {
    month: 'short',
    day: 'numeric',
  });
  const time = new Date(order.createdAt).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
  const firstItem = order.items[0];
  const extraCount = order.items.length - 1;

  return (
    <Link href="/orders" className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0">
      <span className="shrink-0 inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-foreground min-w-22">
        #{order.id.slice(-8).toUpperCase()}
      </span>
      <div className="min-w-0 w-40 shrink-0 hidden sm:block">
        <p className="text-xs font-medium truncate">{order.user.name ?? '—'}</p>
        <p className="text-[10px] text-muted-foreground truncate">{order.user.email}</p>
      </div>
      <div className="flex-1 min-w-0 hidden md:flex items-center gap-2">
        {firstItem?.product.previewUrl ? (
          <div className="relative h-7 w-7 rounded shrink-0 overflow-hidden bg-muted border border-border">
            <Image
              src={firstItem.product.previewUrl}
              alt={firstItem.product.title}
              fill
              className="object-cover"
              sizes="28px"
              unoptimized={firstItem.product.previewUrl.split('?')[0].toLowerCase().endsWith('.svg')}
            />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{firstItem?.product.title ?? '—'}</p>
          {extraCount > 0 && <p className="text-[10px] text-muted-foreground">+{extraCount} дахин</p>}
        </div>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(order.total)}</span>
      <span className={`shrink-0 hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[order.status] ?? STATUS_COLORS.CANCELLED}`}>
        {STATUS_LABELS[order.status] ?? order.status}
      </span>
      <div className="shrink-0 text-right hidden lg:block w-14">
        <p className="text-[10px] text-muted-foreground">{date}</p>
        <p className="text-[10px] text-muted-foreground">{time}</p>
      </div>
    </Link>
  );
}

function EmailStatsPanel({ stats }: { stats: EmailStats }) {
  const usedPct = Math.round((stats.sentThisMonth / stats.monthlyLimit) * 100);
  const isWarning = usedPct >= 80;
  const isCritical = usedPct >= 95;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Имэйл хяналт</h2>
          {!stats.configured && (
            <Badge variant="secondary" className="text-[10px]">Холбоогүй</Badge>
          )}
        </div>
        {stats.configured ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-amber-500" />
        )}
      </div>

      <div className="p-4 space-y-4">
        {!stats.configured && (
          <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-2">
            RESEND_API_KEY тохируулаагүй байна. Имэйл явуулж чадахгүй.
          </p>
        )}

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Энэ сар ашигласан</span>
            <span className={`text-xs font-bold tabular-nums ${isCritical ? 'text-destructive' : isWarning ? 'text-amber-600' : 'text-foreground'}`}>
              {stats.sentThisMonth.toLocaleString()} / {stats.monthlyLimit.toLocaleString()}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isCritical ? 'bg-destructive' : isWarning ? 'bg-amber-500' : 'bg-primary'}`}
              style={{ width: `${Math.min(usedPct, 100)}%` }}
            />
          </div>
          <p className={`mt-1 text-[11px] ${isCritical ? 'text-destructive' : isWarning ? 'text-amber-600' : 'text-muted-foreground'}`}>
            {isCritical ? '⚠️ Лимит дүүрэхэд ойрхон!' : isWarning ? '⚠️ 80% ашигласан' : `${usedPct}% ашигласан`}
          </p>
        </div>

        {/* Monthly breakdown */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: getMonthLabel(2), value: stats.sentTwoMonthsAgo },
            { label: getMonthLabel(1), value: stats.sentLastMonth },
            { label: getMonthLabel(0), value: stats.sentThisMonth, highlight: true },
          ].map((m) => (
            <div
              key={m.label}
              className={`rounded-lg p-2.5 text-center ${m.highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/40'}`}
            >
              <p className={`text-lg font-bold tabular-nums ${m.highlight ? 'text-primary' : 'text-foreground'}`}>
                {m.value.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Queue */}
        {stats.queueLength > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
            <Zap className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {stats.queueLength} имэйл дарааллаас хүлээж байна
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MonthlyRevenuePanel({ data }: { data: { month: string; revenue: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Сарын орлого</h2>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-end gap-3 h-24">
          {data.map((d) => {
            const pct = (d.revenue / max) * 100;
            const [year, mon] = d.month.split('-');
            return (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1.5">
                <p className="text-[10px] font-semibold text-primary tabular-nums">
                  {(d.revenue / 1000).toFixed(0)}K
                </p>
                <div className="w-full rounded-t-md bg-primary/20 relative overflow-hidden" style={{ height: '56px' }}>
                  <div
                    className="absolute bottom-0 w-full bg-primary rounded-t-md transition-all"
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">{mon}-р сар</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => adminApi.dashboard(),
  });

  if (isLoading) return <Loading label="Хяналтын самбар ачаалж байна..." />;
  if (isError || !data)
    return <ErrorState title="Мэдээлэл ачаалахад алдаа" onRetry={() => refetch()} />;

  const { stats, recentOrders, monthlyRevenue, emailStats } = data;

  const statValues: Record<string, number> = {
    users: stats.users,
    products: stats.products,
    orders: stats.orders,
    revenue: stats.revenue,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Хяналтын самбар</h1>
          <p className="text-sm text-muted-foreground">DigitalGer удирдлагын тойм</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Шууд мэдээлэл</span>
        </div>
      </div>

      {/* Main stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((card) => {
          const raw = statValues[card.key] ?? 0;
          const display = card.isMoney ? formatMoney(raw) : raw.toLocaleString('mn-MN');
          const Icon = card.icon;
          return (
            <Link key={card.key} href={card.href}>
              <div className="group relative rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className={`rounded-lg p-2 ${card.bg}`}>
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>

      {/* Email + Revenue row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <EmailStatsPanel stats={emailStats} />
        <MonthlyRevenuePanel data={monthlyRevenue} />
      </div>

      {/* Recent orders */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <h2 className="font-semibold">Сүүлийн захиалгууд</h2>
          <Link href="/orders" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            Бүгд харах
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-b border-border">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground min-w-22">Дугаар</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground w-44 hidden sm:block">Хэрэглэгч</span>
          <span className="flex-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hidden md:block">Бүтээгдэхүүн</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground shrink-0">Дүн</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground shrink-0 hidden sm:block">Төлөв</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground shrink-0 hidden lg:block w-14 text-right">Огноо</span>
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
