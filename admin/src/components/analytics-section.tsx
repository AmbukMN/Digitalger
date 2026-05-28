'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import {
  Activity, TrendingUp, TrendingDown, Minus,
  Eye, MousePointerClick, ShoppingCart, CreditCard,
  Search, Monitor, Smartphone, Tablet,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

const DAYS_OPTIONS = [
  { label: '7 хоног', value: 7 },
  { label: '30 хоног', value: 30 },
  { label: '90 хоног', value: 90 },
];

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  desktop: <Monitor className="h-4 w-4" />,
  mobile: <Smartphone className="h-4 w-4" />,
  tablet: <Tablet className="h-4 w-4" />,
  unknown: <Activity className="h-4 w-4" />,
};

const CHART_COLORS = ['#022179', '#ffbe00', '#0d47a1', '#1565c0', '#1976d2'];

function StatCard({ label, value, sub, icon, trend }: {
  label: string; value: number | string; sub?: string;
  icon: React.ReactNode; trend?: number | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
        {trend != null && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend > 0 ? 'text-green-600 dark:text-green-400' : trend < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {trend > 0 ? <TrendingUp className="h-3 w-3" /> : trend < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {trend > 0 ? `+${trend}%` : trend < 0 ? `${trend}%` : '±0%'}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold tracking-tight tabular-nums">{typeof value === 'number' ? value.toLocaleString('mn-MN') : value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}

export function AnalyticsSection() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'dashboard', days],
    queryFn: () => adminApi.getAnalyticsDashboard(days),
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-bold">Сайтын аналитик</h2>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
          {DAYS_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setDays(o.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${days === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Overview cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={`Нийт views (${days} хоног)`}
              value={data.overview.totalViews}
              icon={<Eye className="h-4 w-4" />}
            />
            <StatCard
              label="Өнөөдрийн views"
              value={data.overview.todayViews}
              sub={`Өчигдөр: ${data.overview.yesterdayViews}`}
              icon={<TrendingUp className="h-4 w-4" />}
              trend={data.overview.growthPercent}
            />
            <StatCard
              label="Бүтээгдэхүүн харалт"
              value={data.funnel.view}
              icon={<MousePointerClick className="h-4 w-4" />}
            />
            <StatCard
              label="Худалдан авалт"
              value={data.funnel.purchase}
              sub={data.funnel.view > 0 ? `Conversion: ${((data.funnel.purchase / data.funnel.view) * 100).toFixed(1)}%` : undefined}
              icon={<CreditCard className="h-4 w-4" />}
            />
          </div>

          {/* Charts row */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Daily views chart */}
            <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-4">Өдөр тутмын зочлолт</p>
              {data.dailyViews.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.dailyViews} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#022179" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#022179" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number) => [v.toLocaleString(), 'Views']}
                      labelFormatter={(l) => `Огноо: ${l}`}
                    />
                    <Area type="monotone" dataKey="count" stroke="#022179" strokeWidth={2} fill="url(#viewsGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
                  Өгөгдөл байхгүй байна
                </div>
              )}
            </div>

            {/* Device breakdown */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-4">Төхөөрөмж</p>
              {data.deviceStats.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie data={data.deviceStats} dataKey="count" nameKey="device" cx="50%" cy="50%" outerRadius={55} strokeWidth={0}>
                        {data.deviceStats.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Views']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1.5">
                    {data.deviceStats.map((d, i) => {
                      const total = data.deviceStats.reduce((s, x) => s + x.count, 0);
                      return (
                        <div key={d.device} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="flex items-center gap-1 text-muted-foreground capitalize">
                              {DEVICE_ICONS[d.device]}{d.device}
                            </span>
                          </div>
                          <span className="font-semibold tabular-nums">{total > 0 ? Math.round((d.count / total) * 100) : 0}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="h-[130px] flex items-center justify-center text-sm text-muted-foreground">Өгөгдөл байхгүй</div>
              )}
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Funnel */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-4">Худалдааны funnel</p>
              <div className="space-y-2">
                {[
                  { label: 'Харалт', value: data.funnel.view, icon: <Eye className="h-3.5 w-3.5" />, color: 'bg-blue-500' },
                  { label: 'Click', value: data.funnel.click, icon: <MousePointerClick className="h-3.5 w-3.5" />, color: 'bg-violet-500' },
                  { label: 'Сагс', value: data.funnel.cart, icon: <ShoppingCart className="h-3.5 w-3.5" />, color: 'bg-amber-500' },
                  { label: 'Худалдан авалт', value: data.funnel.purchase, icon: <CreditCard className="h-3.5 w-3.5" />, color: 'bg-green-500' },
                ].map((f) => {
                  const pct = data.funnel.view > 0 ? Math.round((f.value / data.funnel.view) * 100) : 0;
                  return (
                    <div key={f.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{f.icon}{f.label}</span>
                        <span className="text-xs font-bold tabular-nums">{f.value.toLocaleString()} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${f.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top products */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-4">Их харагдсан бүтээгдэхүүн</p>
              {data.topProducts.length > 0 ? (
                <div className="space-y-2">
                  {data.topProducts.map((p, i) => (
                    <div key={p.slug} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.slug}</p>
                        <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((p.views / (data.topProducts[0]?.views || 1)) * 100)}%` }} />
                        </div>
                      </div>
                      <span className="text-xs font-bold tabular-nums shrink-0">{p.views.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Өгөгдөл байхгүй</p>
              )}
            </div>

            {/* Top searches */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <Search className="h-4 w-4 text-muted-foreground" />Хайлтын үгс
              </p>
              {data.topSearches.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.topSearches.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="query" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [v, 'Хайлт']} />
                    <Bar dataKey="count" fill="#ffbe00" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Өгөгдөл байхгүй</p>
              )}
            </div>
          </div>

          {/* Top pages */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold mb-3">Их зочилсон хуудсууд</p>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {data.topPages.slice(0, 9).map((p, i) => (
                <div key={p.path} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
                  <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <span className="text-xs font-mono truncate flex-1 text-foreground/80">{p.path}</span>
                  <span className="text-xs font-bold tabular-nums shrink-0">{p.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
