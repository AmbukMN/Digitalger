'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  Eye,
  Laptop,
  Link2,
  MousePointerClick,
  PlayCircle,
  Search,
  Smartphone,
  TrendingUp,
  Users,
} from 'lucide-react';
import { cn } from '@besttv/shared';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { api } from '@/lib/api';

const RANGES = [
  { id: 'today', label: 'Өнөөдөр' },
  { id: '7d', label: '7 хоног' },
  { id: '30d', label: 'Сар' },
  { id: '90d', label: '3 сар' },
] as const;

interface Insights {
  range: string;
  days: number;
  traffic: {
    pageViews: number;
    uniqueSessions: number;
    uniqueUsers: number;
    pagesPerSession: number;
    peakHour: number;
    byHour: number[];
  };
  devices: { device: string; count: number }[];
  topPages: { path: string; count: number }[];
  referrers: { source: string; count: number }[];
  funnel: {
    views: number;
    plays: number;
    completes: number;
    playRate: number;
    completeRate: number;
  };
  topViewed: { titleId: string; title: string; count: number }[];
  topPlayed: { titleId: string; title: string; count: number }[];
  topCompleted: { titleId: string; title: string; count: number }[];
  searches: { query: string; count: number }[];
  noResultSearches: { query: string; count: number }[];
}

export default function InsightsPage() {
  const [range, setRange] = useState<string>('30d');
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-insights', range],
    queryFn: () => api<Insights>(`/admin/analytics/insights?range=${range}`),
    staleTime: 60_000,
    placeholderData: (p) => p,
  });

  const rangeLabel = RANGES.find((r) => r.id === range)?.label ?? '';

  return (
    <AdminShell>
      <AdminTopbar title="Хэрэглэгчийн шинжилгээ" subtitle={`${rangeLabel} · зан төлөв, эрэлт`} />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
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
          <div className={cn('space-y-5 transition-opacity', isFetching && 'opacity-60')}>
            {/* ── Хандалт ── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                icon={<Eye size={17} />}
                label="Хуудасны үзэлт"
                value={data.traffic.pageViews.toLocaleString()}
                hint={`${data.traffic.pagesPerSession} хуудас/сешн`}
              />
              <Stat
                icon={<Users size={17} />}
                label="Зочилсон сешн"
                value={data.traffic.uniqueSessions.toLocaleString()}
                hint={`${data.traffic.uniqueUsers} нэвтэрсэн`}
              />
              <Stat
                icon={<PlayCircle size={17} />}
                label="Тоглуулсан"
                value={data.funnel.plays.toLocaleString()}
                hint={`${data.funnel.playRate}% нээснээс`}
                tone="success"
              />
              <Stat
                icon={<Clock size={17} />}
                label="Идэвхтэй цаг"
                value={`${data.traffic.peakHour}:00`}
                hint="хамгийн их зочилдог"
                tone="premium"
              />
            </div>

            {/* ── Үзэлтийн юүлүүр ── */}
            <section className="admin-card rounded-xl p-5">
              <h2 className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                <TrendingUp size={16} className="text-primary" /> Үзэлтийн юүлүүр
              </h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Хаана хэрэглэгч орхиж байгааг харуулна — доогуур хувь бол тэр алхамд асуудал бий
              </p>
              <div className="space-y-3">
                <FunnelBar
                  label="Дэлгэрэнгүй нээсэн"
                  value={data.funnel.views}
                  max={data.funnel.views}
                  color="bg-primary"
                />
                <FunnelBar
                  label="Тоглуулсан"
                  value={data.funnel.plays}
                  max={data.funnel.views}
                  color="bg-success"
                  rate={data.funnel.playRate}
                />
                <FunnelBar
                  label="Дуустал үзсэн"
                  value={data.funnel.completes}
                  max={data.funnel.views}
                  color="bg-premium"
                  rate={data.funnel.completeRate}
                  rateLabel="тоглуулснаас"
                />
              </div>
            </section>

            {/* ── Цагийн хуваарилалт ── */}
            <section className="admin-card rounded-xl p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                <Clock size={16} className="text-primary" /> Өдрийн хандалтын хуваарилалт
              </h2>
              <div className="flex h-24 items-end gap-0.5">
                {data.traffic.byHour.map((n, h) => {
                  const max = Math.max(...data.traffic.byHour, 1);
                  return (
                    <div
                      key={h}
                      className="group relative flex-1"
                      title={`${h}:00 — ${n} үзэлт`}
                    >
                      <div
                        className={cn(
                          'w-full rounded-t transition-colors',
                          h === data.traffic.peakHour ? 'bg-primary' : 'bg-primary/30',
                        )}
                        style={{ height: `${Math.max((n / max) * 96, 2)}px` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* ── Хамгийн их үзсэн контент ── */}
              <RankList
                title="Хамгийн их нээсэн"
                icon={<Eye size={16} />}
                items={data.topViewed.map((t) => ({ label: t.title, count: t.count }))}
                unit="удаа"
              />
              <RankList
                title="Хамгийн их тоглуулсан"
                icon={<PlayCircle size={16} />}
                items={data.topPlayed.map((t) => ({ label: t.title, count: t.count }))}
                unit="удаа"
                tone="success"
              />
              <RankList
                title="Хамгийн их дуустал үзсэн"
                icon={<TrendingUp size={16} />}
                items={data.topCompleted.map((t) => ({ label: t.title, count: t.count }))}
                unit="удаа"
                tone="premium"
                hint="Жинхэнэ таалагдсан контент"
              />
              <RankList
                title="Хамгийн их зочилсон хуудас"
                icon={<MousePointerClick size={16} />}
                items={data.topPages.map((p) => ({ label: p.path, count: p.count }))}
                unit="үзэлт"
                mono
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* ── Хайлт ── */}
              <RankList
                title="Хамгийн их хайсан"
                icon={<Search size={16} />}
                items={data.searches.map((s) => ({ label: s.query, count: s.count }))}
                unit="удаа"
              />
              {/* ⚠️ ХАМГИЙН ҮНЭТЭЙ — ямар контент дутуу байгааг шууд харуулна */}
              <RankList
                title="Хайсан ч ОЛДООГҮЙ"
                icon={<Search size={16} />}
                items={data.noResultSearches.map((s) => ({ label: s.query, count: s.count }))}
                unit="удаа"
                tone="danger"
                hint="Эдгээр контентыг нэмбэл шууд эрэлттэй"
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* ── Төхөөрөмж ── */}
              <section className="admin-card rounded-xl p-5">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                  <Smartphone size={16} className="text-primary" /> Төхөөрөмж
                </h2>
                <div className="space-y-2.5">
                  {data.devices.map((d) => {
                    const total = data.devices.reduce((s, x) => s + x.count, 0) || 1;
                    const pct = Math.round((d.count / total) * 100);
                    return (
                      <div key={d.device} className="flex items-center gap-3 text-sm">
                        <span className="flex w-24 shrink-0 items-center gap-1.5 text-foreground">
                          {d.device === 'mobile' ? <Smartphone size={13} /> : <Laptop size={13} />}
                          {d.device === 'mobile'
                            ? 'Гар утас'
                            : d.device === 'desktop'
                              ? 'Компьютер'
                              : d.device === 'tablet'
                                ? 'Таблет'
                                : d.device}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                  {data.devices.length === 0 && (
                    <p className="text-sm text-muted-foreground">Мэдээлэл байхгүй</p>
                  )}
                </div>
              </section>

              {/* ── Эх сурвалж ── */}
              <RankList
                title="Хаанаас орж ирсэн"
                icon={<Link2 size={16} />}
                items={data.referrers.map((r) => ({ label: r.source, count: r.count }))}
                unit="зочин"
              />
            </div>
          </div>
        )}
      </main>
    </AdminShell>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'success' | 'premium';
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
      {hint && <p className="mt-2 truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FunnelBar({
  label,
  value,
  max,
  color,
  rate,
  rateLabel,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  rate?: number;
  rateLabel?: string;
}) {
  const pct = max ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="flex items-baseline gap-2">
          <span className="font-semibold text-foreground">{value.toLocaleString()}</span>
          {rate != null && (
            <span
              className={cn(
                'text-xs font-medium',
                rate >= 50 ? 'text-success' : rate >= 20 ? 'text-warning' : 'text-destructive',
              )}
            >
              {rate}% {rateLabel ?? 'нээснээс'}
            </span>
          )}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RankList({
  title,
  icon,
  items,
  unit,
  tone,
  hint,
  mono,
}: {
  title: string;
  icon: React.ReactNode;
  items: { label: string; count: number }[];
  unit: string;
  tone?: 'success' | 'premium' | 'danger';
  hint?: string;
  mono?: boolean;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <section className="admin-card rounded-xl p-5">
      <h2 className="flex items-center gap-2 font-semibold text-foreground">
        <span
          className={cn(
            tone === 'success' && 'text-success',
            tone === 'premium' && 'text-premium',
            tone === 'danger' && 'text-destructive',
            !tone && 'text-primary',
          )}
        >
          {icon}
        </span>
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}

      <div className="mt-3 space-y-1.5">
        {items.map((it, i) => (
          <div key={`${it.label}-${i}`} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                'min-w-0 flex-1 truncate',
                mono ? 'font-mono text-xs text-muted-foreground' : 'text-foreground',
              )}
              title={it.label}
            >
              {it.label}
            </span>
            <div className="hidden h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted sm:block">
              <div
                className={cn(
                  'h-full rounded-full',
                  tone === 'success' && 'bg-success',
                  tone === 'premium' && 'bg-premium',
                  tone === 'danger' && 'bg-destructive',
                  !tone && 'bg-primary',
                )}
                style={{ width: `${(it.count / max) * 100}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
              {it.count.toLocaleString()} {unit}
            </span>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Мэдээлэл байхгүй</p>}
      </div>
    </section>
  );
}
