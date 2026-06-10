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
  GraduationCap, PlayCircle, CheckCircle2, Clock, Mail, MailOpen,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

const DAYS_OPTIONS = [
  { label: '1 хоног', value: 1 },
  { label: '3 хоног', value: 3 },
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

// Секундийг "Xм Yс" / "Xц Yм" болгон уншихад ойлгомжтой болгоно.
function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return '0с';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}ц ${m}м`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

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

  const { data: lessons, isLoading: lessonsLoading } = useQuery({
    queryKey: ['analytics', 'lessons', days],
    queryFn: () => adminApi.getLessonAnalytics(days),
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: email, isLoading: emailLoading } = useQuery({
    queryKey: ['analytics', 'email', days],
    queryFn: () => adminApi.getEmailAnalytics(days),
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-bold">Сайтын аналитик</h2>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
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
                      formatter={(v) => [Number(v).toLocaleString(), 'Views']}
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
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold">Төхөөрөмж</p>
                {data.deviceStats.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Нийт{' '}
                    <span className="font-bold tabular-nums text-foreground">
                      {data.deviceStats.reduce((s, x) => s + x.count, 0).toLocaleString()}
                    </span>
                  </span>
                )}
              </div>
              {data.deviceStats.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie data={data.deviceStats} dataKey="count" nameKey="device" cx="50%" cy="50%" outerRadius={55} strokeWidth={0}>
                        {data.deviceStats.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [Number(v).toLocaleString(), 'Орсон']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
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
                          <div className="flex items-center gap-2">
                            <span className="tabular-nums text-muted-foreground">{d.count.toLocaleString()}</span>
                            <span className="font-semibold tabular-nums w-9 text-right">{total > 0 ? Math.round((d.count / total) * 100) : 0}%</span>
                          </div>
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
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [Number(v), 'Хайлт']} />
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

      {/* ─── Хичээлийн аналитик (курс дуусгалт / dropoff) ─────────────────── */}
      <div className="flex items-center gap-2 pt-2">
        <GraduationCap className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-bold">Хичээлийн аналитик</h2>
      </div>

      {lessonsLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-44 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : lessons ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Курс дуусгалт % — gauge / том тоо */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
            <p className="text-sm font-semibold mb-4">Курс дуусгалт</p>
            <div className="flex-1 flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Дууссан', value: lessons.completionRate },
                      { name: 'Үлдсэн', value: Math.max(0, 100 - lessons.completionRate) },
                    ]}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={62}
                    startAngle={90}
                    endAngle={-270}
                    strokeWidth={0}
                  >
                    <Cell fill="#022179" />
                    <Cell fill="currentColor" className="text-muted/40" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="-mt-25 mb-9 text-center pointer-events-none">
                <p className="text-3xl font-bold tracking-tight tabular-nums text-primary">{lessons.completionRate}%</p>
                <p className="text-[11px] text-muted-foreground">дуусгалт</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="rounded-lg bg-muted/30 px-3 py-2">
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><PlayCircle className="h-3 w-3" />Эхэлсэн</p>
                <p className="text-sm font-bold tabular-nums">{lessons.totalStarted.toLocaleString('mn-MN')}</p>
              </div>
              <div className="rounded-lg bg-muted/30 px-3 py-2">
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><CheckCircle2 className="h-3 w-3" />Дууссан</p>
                <p className="text-sm font-bold tabular-nums">{lessons.totalCompleted.toLocaleString('mn-MN')}</p>
              </div>
            </div>
          </div>

          {/* Lesson dropoff — started vs completed BarChart */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold">Хичээлийн dropoff (эхэлсэн vs дууссан)</p>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />Дундаж үзэлт: <span className="font-bold text-foreground">{formatDuration(lessons.avgWatchSeconds)}</span>
              </span>
            </div>
            {lessons.topDropoff.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={lessons.topDropoff} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} vertical={false} />
                  <XAxis
                    dataKey="title"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    tickFormatter={(v: string) => (v.length > 10 ? v.slice(0, 10) + '…' : v)}
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v, name) => [Number(v).toLocaleString(), name === 'started' ? 'Эхэлсэн' : 'Дууссан']}
                    labelFormatter={(l) => `Хичээл: ${l}`}
                  />
                  <Bar dataKey="started" fill="#022179" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="completed" fill="#ffbe00" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-55 flex items-center justify-center text-sm text-muted-foreground">Хичээлийн өгөгдөл байхгүй байна</div>
            )}
            {lessons.topDropoff.length > 0 && (
              <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#022179' }} />Эхэлсэн</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#ffbe00' }} />Дууссан</span>
                <span className="ml-auto">Хамгийн их орхилт: <span className="font-semibold text-foreground">{lessons.topDropoff[0]?.dropoffRate}%</span></span>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ─── Имэйл маркетинг (илгээлт + нээлтийн хувь) ─────────────────────── */}
      <div className="flex items-center gap-2 pt-2">
        <Mail className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-bold">Имэйл маркетинг</h2>
        <span className="text-xs text-muted-foreground">({days} хоног)</span>
      </div>

      {emailLoading ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : email ? (
        <>
          {/* ── Дээд эгнээ: нийт үзүүлэлт (явсан / нээсэн / unique / open rate) ── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Нийт илгээсэн имэйл"
              value={email.totalSent}
              sub={email.totalDelivered > 0 ? `Хүргэгдсэн: ${email.totalDelivered.toLocaleString('mn-MN')}` : undefined}
              icon={<Mail className="h-4 w-4" />}
            />
            <StatCard
              label="Нийт нээлт"
              value={email.totalOpensPeriod}
              sub="Бүх нээлтийн тоо (давхардалтай)"
              icon={<MailOpen className="h-4 w-4" />}
            />
            <StatCard
              label="Нээсэн хүн (unique)"
              value={email.totalUnique}
              sub="Давхардалгүй хүний тоо"
              icon={<Eye className="h-4 w-4" />}
            />
            <StatCard
              label="Нээлтийн хувь (open rate)"
              value={`${email.overallOpenRate}%`}
              sub="Нээсэн хүн / Илгээсэн"
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </div>

          {/* ── Кампанит ажил бүрийн дэлгэрэнгүй хүснэгт ── */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Илгээлт бүрийн задаргаа</p>
              <span className="text-[11px] text-muted-foreground">
                Bulk бүр өөр мөр — явсан / нээсэн / нээлтийн хувь
              </span>
            </div>
            {email.campaigns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Кампанит ажил</th>
                      <th className="px-3 py-2.5 font-medium text-right">Илгээсэн</th>
                      <th className="px-3 py-2.5 font-medium text-right">Хүргэгдсэн</th>
                      <th className="px-3 py-2.5 font-medium text-right">Нээлт</th>
                      <th className="px-3 py-2.5 font-medium text-right">Нээсэн хүн</th>
                      <th className="px-4 py-2.5 font-medium text-right">Нээлтийн хувь</th>
                    </tr>
                  </thead>
                  <tbody>
                    {email.campaigns.map((c) => {
                      // Open rate-ийн өнгө: ≥25% сайн (ногоон), ≥10% дунд (амбер), <10% бага (саарал)
                      const rateColor =
                        c.openRate >= 25
                          ? 'text-green-600 dark:text-green-400'
                          : c.openRate >= 10
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground';
                      const isBulk = c.key.startsWith('bulk-') || c.key.startsWith('broadcast-');
                      return (
                        <tr key={c.key} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${isBulk ? 'bg-primary' : 'bg-amber-400'}`} />
                              <span className="font-medium">{c.label}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{c.sent.toLocaleString('mn-MN')}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                            {c.delivered > 0 ? c.delivered.toLocaleString('mn-MN') : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{c.openedPeriod.toLocaleString('mn-MN')}</td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-primary">{c.uniqueOpens.toLocaleString('mn-MN')}</td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                                <div
                                  className={`h-full rounded-full ${c.openRate >= 25 ? 'bg-green-500' : c.openRate >= 10 ? 'bg-amber-500' : 'bg-muted-foreground/40'}`}
                                  style={{ width: `${Math.min(c.openRate, 100)}%` }}
                                />
                              </div>
                              <span className={`w-12 font-bold tabular-nums ${rateColor}`}>{c.openRate}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Нийт мөр */}
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="px-4 py-2.5">Нийт</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{email.totalSent.toLocaleString('mn-MN')}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {email.totalDelivered > 0 ? email.totalDelivered.toLocaleString('mn-MN') : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{email.totalOpensPeriod.toLocaleString('mn-MN')}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-primary">{email.totalUnique.toLocaleString('mn-MN')}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{email.overallOpenRate}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                <div className="rounded-full bg-muted p-3"><Mail className="h-6 w-6 text-muted-foreground" /></div>
                <p className="text-sm font-medium">Энэ хугацаанд имэйл илгээгээгүй</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Subscriber → «Имэйл явуулах»-аар bulk кампанит ажил илгээмэгц энд илгээлт бүрийн нээлтийн статистик харагдана.
                </p>
              </div>
            )}
            <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground/70">
              <span className="font-medium">Нээлтийн хувь</span> = давхардалгүй нээсэн хүн ÷ илгээсэн имэйл. Нээлтийг имэйл доторх pixel-ээр бүртгэнэ (зарим имэйл клиент зураг блоклодог тул бодит нээлт арай өндөр байж болно).
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
