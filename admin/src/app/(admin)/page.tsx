'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { Badge, ErrorState, Loading } from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';
import type { AdminOrder } from '@/types/admin';

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

  const products = order.items
    .map((i) => i.product.title)
    .join(', ');

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0">
      {/* Order ID */}
      <span className="shrink-0 inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-foreground min-w-22">
        #{order.id.slice(-8).toUpperCase()}
      </span>

      {/* User */}
      <div className="min-w-0 w-44 shrink-0 hidden sm:block">
        <p className="text-xs font-medium truncate">{order.user.name ?? '—'}</p>
        <p className="text-[10px] text-muted-foreground truncate">{order.user.email}</p>
      </div>

      {/* Products */}
      <p className="flex-1 truncate text-xs text-muted-foreground hidden md:block">
        {products}
      </p>

      {/* Amount */}
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {formatMoney(order.total)}
      </span>

      {/* Status */}
      <span
        className={`shrink-0 hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[order.status] ?? STATUS_COLORS.CANCELLED}`}
      >
        {STATUS_LABELS[order.status] ?? order.status}
      </span>

      {/* Date */}
      <span className="shrink-0 text-[10px] text-muted-foreground hidden lg:block w-14 text-right">
        {date}
      </span>
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

  const { stats, recentOrders } = data;

  const statValues: Record<string, number> = {
    users: stats.users,
    products: stats.products,
    orders: stats.orders,
    revenue: stats.revenue,
  };

  return (
    <div className="space-y-8">
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

      {/* Stat cards */}
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

      {/* Recent orders */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <h2 className="font-semibold">Сүүлийн захиалгууд</h2>
          <Link
            href="/orders"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Бүгд харах
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-b border-border">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground min-w-22">
            Дугаар
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground w-44 hidden sm:block">
            Хэрэглэгч
          </span>
          <span className="flex-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hidden md:block">
            Бүтээгдэхүүн
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground shrink-0">
            Дүн
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground shrink-0 hidden sm:block">
            Төлөв
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground shrink-0 hidden lg:block w-14 text-right">
            Огноо
          </span>
        </div>

        {recentOrders.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Захиалга байхгүй байна
          </p>
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
