'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CreditCard,
  Crown,
  Film,
  Star,
  TrendingDown,
  TrendingUp,
  Tv,
  Users,
  Wallet,
} from 'lucide-react';
import { formatPrice, cn } from '@besttv/shared';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { useDashboard } from '@/lib/queries';

/** Хугацааны сонголт — backend-ийн RANGE_DAYS-тэй тааруулсан */
const RANGES = [
  { id: 'today', label: 'Өнөөдөр' },
  { id: '7d', label: '7 хоног' },
  { id: '30d', label: 'Сар' },
  { id: '90d', label: '3 сар' },
  { id: '365d', label: 'Жил' },
] as const;

export default function DashboardPage() {
  const [range, setRange] = useState<string>('30d');
  const { data, isLoading, isFetching } = useDashboard(range);
  const rangeLabel = RANGES.find((r) => r.id === range)?.label ?? '';

  return (
    <AdminShell>
      <AdminTopbar title="Хянах самбар" subtitle={`${rangeLabel}-ийн үзүүлэлт`} />

      <main className="p-4 sm:p-8">
        {/* ── Хугацааны шүүлт ── */}
        <div className="mb-5 flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={cn(
                'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
                range === r.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {isLoading || !data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="admin-skeleton h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className={cn('transition-opacity', isFetching && 'opacity-60')}>
            {/* ── Гол үзүүлэлт (мужид харьяалагдана) ── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label={`Орлого (${rangeLabel})`}
                value={formatPrice(data.revenue)}
                growth={data.revenueGrowth}
                icon={<CreditCard size={17} />}
                tone="success"
                hint={`${data.paidCount.toLocaleString()} гүйлгээ`}
              />
              <Metric
                label={`Шинэ хэрэглэгч (${rangeLabel})`}
                value={`+${data.newUsers.toLocaleString()}`}
                growth={data.newUsersGrowth}
                icon={<TrendingUp size={17} />}
                hint={`нийт ${data.totalUsers.toLocaleString()}`}
              />
              <Metric
                label={`Шинэ захиалга (${rangeLabel})`}
                value={`+${data.newSubscriptions.toLocaleString()}`}
                growth={data.newSubscriptionsGrowth}
                icon={<Crown size={17} />}
                tone="premium"
                hint={`идэвхтэй ${data.activeSubscriptions.toLocaleString()}`}
              />
              <Metric
                label="Дундаж чек"
                value={formatPrice(data.avgOrder)}
                icon={<Wallet size={17} />}
                hint={`түрээс ${data.rentals.toLocaleString()}`}
              />
            </div>

            {/* ── Нийт үзүүлэлт (муж хамаарахгүй) ── */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Нийт орлого"
                value={formatPrice(data.totalRevenue)}
                icon={<CreditCard size={17} />}
                tone="success"
              />
              <Metric
                label="Нийт хэрэглэгч"
                value={data.totalUsers.toLocaleString()}
                icon={<Users size={17} />}
              />
              <Metric
                label="Нийт контент"
                value={data.totalTitles.toLocaleString()}
                icon={<Film size={17} />}
              />
              <Metric
                label="Кино / Олон ангит"
                value={`${data.totalMovies} / ${data.totalSeries}`}
                icon={<Tv size={17} />}
              />
            </div>

            {/* ── График: орлого + шинэ хэрэглэгч ── */}
            {data.series.length > 1 && <TrendChart series={data.series} />}

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              {/* ── Багцын задаргаа ── */}
              <section className="admin-card rounded-xl p-5">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                  <Crown size={16} className="text-premium" /> Багцын идэвхтэй захиалагч
                </h2>
                <div className="space-y-2">
                  {data.planBreakdown.map((p) => {
                    const max = Math.max(...data.planBreakdown.map((x) => x.activeCount), 1);
                    return (
                      <div key={p.id} className="flex items-center gap-3 text-sm">
                        <span className="w-40 shrink-0 truncate text-foreground">
                          {p.isVip && <Crown size={11} className="mr-1 inline text-premium" />}
                          {p.name}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              p.isVip ? 'bg-premium' : 'bg-primary',
                            )}
                            style={{ width: `${(p.activeCount / max) * 100}%` }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right font-semibold text-foreground">
                          {p.activeCount}
                        </span>
                      </div>
                    );
                  })}
                  {data.planBreakdown.length === 0 && (
                    <p className="text-sm text-muted-foreground">Багц байхгүй</p>
                  )}
                </div>
              </section>

              {/* ── Эрэлттэй контент ── */}
              <section className="admin-card rounded-xl p-5">
                <h2 className="mb-4 font-semibold text-foreground">Эрэлттэй контент</h2>
                <div className="space-y-1">
                  {data.topTitles.map((t, i) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-accent/50"
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold',
                          i < 3 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate text-foreground">{t.title}</span>
                      {t.rating && (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          <Star size={11} className="fill-premium text-premium" />{' '}
                          {t.rating.toFixed(1)}
                        </span>
                      )}
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t.views.toLocaleString()} үзэлт
                      </span>
                    </div>
                  ))}
                  {data.topTitles.length === 0 && (
                    <p className="px-2 py-3 text-sm text-muted-foreground">Мэдээлэл байхгүй</p>
                  )}
                </div>
              </section>
            </div>

            {/* ── Сүүлийн төлбөрүүд ── */}
            <section className="admin-card mt-5 rounded-xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Сүүлийн төлбөрүүд</h2>
                <Link
                  href="/payments"
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Бүгдийг үзэх <ArrowRight size={12} />
                </Link>
              </div>
              <div className="space-y-1">
                {data.recentPayments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-accent/50"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                      {(p.user.name?.[0] ?? p.user.email[0]).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {p.user.name ?? p.user.email}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {p.isWalletTopup ? (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <Wallet size={11} /> Хэтэвч
                        </span>
                      ) : (
                        (p.plan?.name ?? '—')
                      )}
                    </span>
                    <span className="shrink-0 font-semibold text-success">
                      {formatPrice(p.amount)}
                    </span>
                  </div>
                ))}
                {data.recentPayments.length === 0 && (
                  <p className="px-2 py-3 text-sm text-muted-foreground">Төлбөр байхгүй байна</p>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </AdminShell>
  );
}

/** Үзүүлэлтийн карт — өсөлтийн хувьтай */
function Metric({
  label,
  value,
  growth,
  icon,
  tone,
  hint,
}: {
  label: string;
  value: string;
  growth?: number | null;
  icon: React.ReactNode;
  tone?: 'success' | 'premium';
  hint?: string;
}) {
  return (
    <div className="admin-card rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-black text-foreground">{value}</p>
        </div>
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            tone === 'success' && 'bg-success/12 text-success',
            tone === 'premium' && 'bg-premium/12 text-premium',
            !tone && 'bg-primary/12 text-primary',
          )}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px]">
        {growth != null && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-semibold',
              growth >= 0 ? 'text-success' : 'text-destructive',
            )}
          >
            {growth >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {growth > 0 ? '+' : ''}
            {growth}%
          </span>
        )}
        {hint && <span className="truncate text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

/**
 * Орлого/хэрэглэгчийн чиг хандлага.
 * ⚠️ Гадаад график сан ашиглахгүй — цэвэр SVG (bundle хөнгөн).
 */
function TrendChart({ series }: { series: { date: string; revenue: number; users: number }[] }) {
  const maxRevenue = Math.max(...series.map((s) => s.revenue), 1);
  const maxUsers = Math.max(...series.map((s) => s.users), 1);
  const W = 1000;
  const H = 160;

  const path = (key: 'revenue' | 'users', max: number) =>
    series
      .map((s, i) => {
        const x = (i / Math.max(series.length - 1, 1)) * W;
        const y = H - (s[key] / max) * (H - 12) - 6;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const fmt = (d: string) => {
    const [, m, day] = d.split('-');
    return `${Number(m)}/${Number(day)}`;
  };

  return (
    <section className="admin-card mt-5 rounded-xl p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-foreground">Чиг хандлага</h2>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-0.5 w-4 rounded bg-success" /> Орлого
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-0.5 w-4 rounded bg-primary" /> Шинэ хэрэглэгч
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" preserveAspectRatio="none">
        <path
          d={path('revenue', maxRevenue)}
          fill="none"
          stroke="var(--success)"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path('users', maxUsers)}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeDasharray="5 4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{fmt(series[0].date)}</span>
        <span>{fmt(series[Math.floor(series.length / 2)].date)}</span>
        <span>{fmt(series[series.length - 1].date)}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">
          Хамгийн их өдрийн орлого:{' '}
          <strong className="text-foreground">{formatPrice(maxRevenue)}</strong>
        </span>
        <span className="text-muted-foreground">
          Хамгийн их шинэ хэрэглэгч: <strong className="text-foreground">{maxUsers}</strong>
        </span>
      </div>
    </section>
  );
}
