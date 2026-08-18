'use client';

/**
 * ⚠️⚠️ ӨНӨӨДРИЙН ТОЙМ — хуудасны ХАМГИЙН ЭХЭНД.
 *
 * ЯАГААД ТУСДАА КАРТ ВЭ: доорх бүх үзүүлэлт нь `range` сонголтод
 * (анхдагч 30 хоног) баригддаг тул админ «өнөөдөр юу болж байна»
 * гэдгийг харахын тулд мужаа сольж, дараа нь буцааж сольдог байв.
 * Энэ карт нь `range`-ээс ХАМААРАХГҮЙ — үргэлж ӨНӨӨДРИЙНХ.
 *
 * ⚠️ Хоёр API-г зэрэг дуудна (dashboard = мөнгө, insights = хандалт).
 * Нэг нь унасан ч нөгөө нь харагдана.
 */

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CreditCard,
  Eye,
  PlayCircle,
  TrendingDown,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { cn, formatPrice } from '@besttv/shared';
import { api } from '@/lib/api';

interface TodayDash {
  revenue: number;
  paidCount: number;
  newUsers: number;
  rentals: number;
  activeSubscriptions: number;
}

interface TodayIns {
  traffic: {
    pageViews: number;
    uniqueSessions: number;
    uniqueUsers: number;
    peakHour: number;
    byHour: number[];
  };
  funnel: { plays: number; completes: number };
}

export function TodayCard() {
  const { data: d, isLoading: l1 } = useQuery({
    queryKey: ['dash-today'],
    queryFn: () => api<TodayDash>('/admin/analytics/dashboard?range=today'),
    /* ⚠️ Өнөөдрийн тоо байнга хөдөлдөг тул шинэ байх ёстой */
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const { data: i, isLoading: l2 } = useQuery({
    queryKey: ['ins-today'],
    queryFn: () => api<TodayIns>('/admin/analytics/insights?range=today'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  /**
   * ⚠️ ӨЧИГДӨРТЭЙ ХАРЬЦУУЛАХ: «52,700₮» гэдэг нь сайн уу муу юу гэдгийг
   * харьцуулалтгүйгээр мэдэх боломжгүй. 2 хоногийн мужаас өнөөдрийг
   * хасаж өчигдрийг гаргана (backend-д `2d` муж нэмсэн).
   */
  const { data: y } = useQuery({
    queryKey: ['dash-2d'],
    queryFn: () => api<TodayDash>('/admin/analytics/dashboard?range=2d'),
    staleTime: 300_000,
  });

  const yRevenue = y && d ? Math.max(0, y.revenue - d.revenue) : null;
  const yUsers = y && d ? Math.max(0, y.newUsers - d.newUsers) : null;

  const pct = (now: number, prev: number | null): number | null => {
    if (prev == null) return null;
    /* ⚠️ 0-ээс өссөнийг «∞%» гэж харуулахгүй — утгагүй */
    if (prev === 0) return null;
    return Math.round(((now - prev) / prev) * 100);
  };

  if (l1 || l2) return <div className="admin-skeleton mb-5 h-[190px] rounded-2xl" />;

  const hours = i?.traffic.byHour ?? [];
  const maxHour = Math.max(1, ...hours);
  const nowHour = new Date().getHours();

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 sm:px-5">
        <p className="flex items-center gap-2 text-sm font-bold">
          {/* ⚠️ Цохилт — өгөгдөл амьд гэдгийн шинж */}
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Өнөөдөр
        </p>
        <p className="text-[11px] text-muted-foreground">
          {new Date().toLocaleDateString('mn-MN', {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
        <Cell
          icon={<CreditCard size={14} />}
          label="Орлого"
          value={formatPrice(d?.revenue ?? 0)}
          sub={`${(d?.paidCount ?? 0).toLocaleString()} гүйлгээ`}
          growth={pct(d?.revenue ?? 0, yRevenue)}
          tone="success"
        />
        <Cell
          icon={<Eye size={14} />}
          label="Зочилсон"
          value={(i?.traffic.uniqueSessions ?? 0).toLocaleString()}
          sub={`${(i?.traffic.pageViews ?? 0).toLocaleString()} хуудас үзэлт`}
        />
        <Cell
          icon={<UserPlus size={14} />}
          label="Шинэ хэрэглэгч"
          value={`+${(d?.newUsers ?? 0).toLocaleString()}`}
          sub={`${(i?.traffic.uniqueUsers ?? 0).toLocaleString()} нэвтэрсэн`}
          growth={pct(d?.newUsers ?? 0, yUsers)}
        />
        <Cell
          icon={<PlayCircle size={14} />}
          label="Тоглуулалт"
          value={(i?.funnel.plays ?? 0).toLocaleString()}
          sub={`${(i?.funnel.completes ?? 0).toLocaleString()} дуустал үзсэн`}
        />
        <Cell
          icon={<Activity size={14} />}
          label="Түрээс"
          value={(d?.rentals ?? 0).toLocaleString()}
          sub={`идэвхтэй багц ${(d?.activeSubscriptions ?? 0).toLocaleString()}`}
        />
      </div>

      {/* ── Цагийн хандалт ── */}
      {hours.length === 24 && (
        <div className="border-t border-border px-4 pb-3 pt-2.5 sm:px-5">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Цагийн хандалт</span>
            <span>
              Оргил{' '}
              <b className="text-foreground">
                {String(i?.traffic.peakHour ?? 0).padStart(2, '0')}:00
              </b>
            </span>
          </div>
          <div className="flex h-10 items-end gap-[2px]">
            {hours.map((c, h) => (
              <div
                key={h}
                title={`${String(h).padStart(2, '0')}:00 — ${c} үзэлт`}
                className={cn(
                  'flex-1 rounded-sm transition-colors',
                  /* ⚠️ Одоогийн цагийг ТОДРУУЛНА — «яг одоо хэр идэвхтэй» */
                  h === nowHour ? 'bg-primary' : c > 0 ? 'bg-primary/35' : 'bg-accent',
                )}
                style={{ height: `${Math.max(6, (c / maxHour) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Cell({
  icon,
  label,
  value,
  sub,
  growth,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  growth?: number | null;
  tone?: 'success';
}) {
  return (
    <div className="px-4 py-3">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className={tone === 'success' ? 'text-success' : 'text-primary'}>{icon}</span>
        {label}
      </p>
      <p className="text-xl font-bold leading-none tabular-nums">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
        {sub && <span>{sub}</span>}
        {growth != null && growth !== 0 && (
          <span
            className={cn(
              'flex items-center gap-0.5 font-semibold',
              growth > 0 ? 'text-success' : 'text-destructive',
            )}
          >
            {growth > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(growth)}%
            <span className="font-normal text-muted-foreground">өчигдрөөс</span>
          </span>
        )}
      </div>
    </div>
  );
}
