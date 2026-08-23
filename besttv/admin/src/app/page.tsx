'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { StorageUsageCard } from '@/components/storage-usage-card';
import { ContentHealthCard } from '@/components/content-health-card';
import { ServerInsightCard } from '@/components/server-insight-card';
import { TodayCard } from '@/components/dashboard/today-card';
import {
  ArrowRight,
  Clock,
  CreditCard,
  Crown,
  Eye,
  Film,
  Laptop,
  Link2,
  MousePointerClick,
  PlayCircle,
  Search,
  Smartphone,
  Star,
  Ticket,
  TrendingDown,
  TrendingUp,
  Tv,
  Users,
  Wallet,
} from 'lucide-react';
import { cn, formatPrice } from '@besttv/shared';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { api } from '@/lib/api';
import { useDashboard, useContentInsights } from '@/lib/queries';

/**
 * НЭГДСЭН ХЯНАХ САМБАР.
 *
 * ⚠️ Өмнө нь "Хянах самбар" (бизнес) ба "Шинжилгээ" (зан төлөв) гэсэн ХОЁР
 * тусдаа хуудас байсан. Хоёулаа өөрийн range сонголттой байсан тул админ
 * ижил асуултад хариулахын тулд хоёр хуудас хооронд үсэрч, сонголтоо
 * давхар тохируулах шаардлагатай байв.
 *
 * Одоо: НЭГ хуудас, НЭГ range сонголт, 3 таб (Тойм / Орлого / Зан төлөв).
 * Хоёр API-г зэрэг дуудна — таб солиход дахин ачаалахгүй.
 */

const RANGES = [
  { id: 'today', label: 'Өнөөдөр' },
  { id: '7d', label: '7 хоног' },
  { id: '30d', label: 'Сар' },
  { id: '90d', label: '3 сар' },
  { id: '180d', label: '6 сар' },
  { id: '365d', label: 'Жил' },
] as const;

const TABS = [
  { id: 'overview', label: 'Тойм' },
  { id: 'revenue', label: 'Орлого & Багц' },
  { id: 'content', label: 'Контент' },
  { id: 'behavior', label: 'Зан төлөв' },
] as const;

type TabId = (typeof TABS)[number]['id'];

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

export default function DashboardPage() {
  const [range, setRange] = useState<string>('30d');
  const [tab, setTab] = useState<TabId>('overview');

  const { data, isLoading, isFetching } = useDashboard(range);
  const { data: ins, isFetching: insFetching } = useQuery({
    queryKey: ['admin-insights', range],
    queryFn: () => api<Insights>(`/admin/analytics/insights?range=${range}`),
    staleTime: 60_000,
    placeholderData: (p) => p,
  });
  /* Контент insight — зөвхөн тэр таб идэвхтэй үед татна (хүнд query) */
  const { data: content, isFetching: contentFetching } = useContentInsights(tab === 'content');

  const rangeLabel = RANGES.find((r) => r.id === range)?.label ?? '';
  /* ⚠️ contentFetching-ийг busy-д ОРУУЛАХГҮЙ — Content таб дээр биш байхад
     тэр fetch болвол бүх контент бүдгэрэх нь эвгүй. Content таб өөрийн
     skeleton-той. */
  const busy = isFetching || insFetching;

  return (
    <AdminShell>
      <AdminTopbar title="Хянах самбар" subtitle={`${rangeLabel} · бизнес ба зан төлөв`} />

      <main className="p-4 sm:p-8">
        {/*
          ⚠️ Хугацаа + таб НЭГ мөрөнд, sticky — доош гүйхэд ч сонголт
          гараас гарахгүй (урт хуудсанд буцаж гүйлгэх шаардлагагүй).
        */}
        {/*
          ⚠️⚠️ «ӨНӨӨДӨР» КАРТ — МУЖИЙН СОНГОЛТООС ДЭЭР.

          БОДИТ ЭНДҮҮРЭЛ: доор байрлуулахад админ «Сар» дарчихаад
          дээрх «Өнөөдөр» тоог хараад «муж ажиллахгүй байна» гэж
          ойлгож байв. Мужийн сонголтоос ДЭЭР байрлуулснаар түүнд
          ХАМААРАХГҮЙ нь бүтцээрээ илэрхий болно.

          ⚠️ Эрэмбэ: ӨНӨӨДӨР → [муж сонголт] → мужийн үзүүлэлт →
          систем. Админ өдөр бүр хардаг зүйл нь бизнес.
        */}
        <TodayCard />

        {/*
          ⚠️ RESPONSIVE: мобайлд range + tab нэг flex-wrap дотор 10 товч
          2-3 мөр болж sticky өндөр хэт өсдөг байв. Одоо:
            • Range — хэвтээ scroll (нэг мөр, snap), гүйлгэж сонгоно
            • Tab   — доод мөрөнд БҮРЭН ӨРГӨН segmented control
            • sm-ээс дээш л нэг мөрөнд (ml-auto зөвхөн sm)
        */}
        <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur sm:-mx-8 sm:px-8 sm:py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
            {/* Range — мобайлд хэвтээ scroll (нэг мөр) */}
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  aria-pressed={range === r.id}
                  className={cn(
                    'shrink-0 snap-start rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    range === r.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-accent/60 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Tab — мобайлд бүрэн өргөн, sm-д баруун талд */}
            <div className="flex w-full gap-1 rounded-lg bg-accent/60 p-1 sm:ml-auto sm:w-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-pressed={tab === t.id}
                  className={cn(
                    'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors sm:flex-none sm:px-3',
                    tab === t.id
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/*
          ⚠️ МУЖИЙН ХИЛИЙГ ИЛ ХЭЛНЭ — «Сар» гэдэг нь ЯГ хэдэн өдөр,
          ямар огнооноос эхэлж байгааг админ таамаглах ёсгүй.
          Дээрх «Өнөөдөр» картаас ялгарна.
        */}
        {data && (
          <p className="mb-3 text-xs text-muted-foreground">
            <b className="text-foreground">{rangeLabel}</b> — сүүлийн {data.days} хоног
            {data.days > 1 && (
              <>
                {' '}
                ({new Date(Date.now() - data.days * 86400_000).toLocaleDateString('mn-MN', {
                  month: 'numeric',
                  day: 'numeric',
                })}{' '}
                – өнөөдөр)
              </>
            )}
          </p>
        )}

        {isLoading || !data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="admin-skeleton h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className={cn('transition-opacity', busy && 'opacity-60')}>
            {/* ─── ТОЙМ ─────────────────────────────────────────────────── */}
            {tab === 'overview' && (
              <>
                {/* Хамгийн чухал 4 тоо — мужид харьяалагдана */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    label={`Орлого · ${rangeLabel}`}
                    value={formatPrice(data.revenue)}
                    growth={data.revenueGrowth}
                    icon={<CreditCard size={17} />}
                    tone="success"
                    hint={`${data.paidCount.toLocaleString()} гүйлгээ`}
                  />
                  <Metric
                    label={`Шинэ хэрэглэгч · ${rangeLabel}`}
                    value={`+${data.newUsers.toLocaleString()}`}
                    growth={data.newUsersGrowth}
                    icon={<TrendingUp size={17} />}
                    hint={`нийт ${data.totalUsers.toLocaleString()}`}
                  />
                  <Metric
                    label={`Шинэ захиалга · ${rangeLabel}`}
                    value={`+${data.newSubscriptions.toLocaleString()}`}
                    growth={data.newSubscriptionsGrowth}
                    icon={<Crown size={17} />}
                    tone="premium"
                    hint={`идэвхтэй ${data.activeSubscriptions.toLocaleString()}`}
                  />
                  <Metric
                    label={`Хандалт · ${rangeLabel}`}
                    value={(ins?.traffic.pageViews ?? 0).toLocaleString()}
                    icon={<Eye size={17} />}
                    hint={`${(ins?.traffic.uniqueSessions ?? 0).toLocaleString()} сесс`}
                  />
                </div>

                {data.series.length > 1 ? (
                  <TrendChart series={data.series} />
                ) : (
                  <div className="admin-card mt-5 flex items-center justify-center rounded-xl px-5 py-8 text-center text-sm text-muted-foreground">
                    Чиг хандлагын график харахын тулд хамгийн багадаа{' '}
                    <span className="mx-1 font-semibold text-foreground">7 хоног</span> сонгоно уу
                  </div>
                )}

                {/* Юүлүүр — үзсэн → тоглуулсан → дуусгасан */}
                {ins && <FunnelCard funnel={ins.funnel} />}

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <ListCard
                    title="Эрэлттэй контент"
                    empty="Мэдээлэл байхгүй"
                    items={data.topTitles.map((t) => ({
                      key: t.id,
                      label: t.title,
                      value: `${t.views.toLocaleString()} үзэлт`,
                      extra:
                        // ⚠️ Үнэлгээ 0 бол харуулахгүй (оруулаагүй гэсэн үг)
                        t.rating && t.rating > 0 ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Star size={11} className="fill-premium text-premium" />
                            {t.rating.toFixed(1)}
                          </span>
                        ) : null,
                    }))}
                    ranked
                  />
                  <ListCard
                    title="Сүүлийн төлбөрүүд"
                    empty="Төлбөр байхгүй байна"
                    href="/payments"
                    items={data.recentPayments.map((p) => ({
                      key: p.id,
                      label: p.user.name ?? p.user.email,
                      value: formatPrice(p.amount),
                      valueTone: 'success' as const,
                      extra: (
                        <span className="text-xs text-muted-foreground">
                          {p.isWalletTopup ? (
                            <span className="inline-flex items-center gap-1 text-primary">
                              <Wallet size={11} /> Хэтэвч
                            </span>
                          ) : (
                            (p.plan?.name ?? '—')
                          )}
                        </span>
                      ),
                    }))}
                  />
                </div>
              </>
            )}

            {/* ─── ОРЛОГО & БАГЦ ────────────────────────────────────────── */}
            {tab === 'revenue' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    label={`Орлого · ${rangeLabel}`}
                    value={formatPrice(data.revenue)}
                    growth={data.revenueGrowth}
                    icon={<CreditCard size={17} />}
                    tone="success"
                    hint={`${data.paidCount.toLocaleString()} гүйлгээ`}
                  />
                  <Metric
                    label="Дундаж чек"
                    value={formatPrice(data.avgOrder)}
                    icon={<Wallet size={17} />}
                    hint={`түрээс ${data.rentals.toLocaleString()}`}
                  />
                  <Metric
                    label="Нийт орлого"
                    value={formatPrice(data.totalRevenue)}
                    icon={<CreditCard size={17} />}
                    tone="success"
                    hint="бүх хугацаа"
                  />
                  <Metric
                    label="Идэвхтэй захиалга"
                    value={data.activeSubscriptions.toLocaleString()}
                    icon={<Crown size={17} />}
                    tone="premium"
                    hint={`+${data.newSubscriptions} шинэ`}
                  />
                </div>

                {data.series.length > 1 ? (
                  <TrendChart series={data.series} />
                ) : (
                  <div className="admin-card mt-5 flex items-center justify-center rounded-xl px-5 py-8 text-center text-sm text-muted-foreground">
                    Чиг хандлагын график харахын тулд хамгийн багадаа{' '}
                    <span className="mx-1 font-semibold text-foreground">7 хоног</span> сонгоно уу
                  </div>
                )}

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <section className="admin-card rounded-xl p-5">
                    <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                      <Crown size={16} className="text-premium" /> Багцын гүйцэтгэл
                    </h2>
                    {data.planBreakdown.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Багц байхгүй</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[420px] text-sm">
                          <thead>
                            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                              <th className="pb-2 text-left font-semibold">Багц</th>
                              <th className="pb-2 text-right font-semibold">Идэвхтэй</th>
                              <th className="pb-2 text-right font-semibold">Зарагдсан</th>
                              <th className="pb-2 text-right font-semibold">Орлого</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {[...data.planBreakdown]
                              .sort((a, b) => b.revenue - a.revenue)
                              .map((p) => (
                                <tr key={p.id}>
                                  <td className="py-2.5 pr-2">
                                    <span className="flex items-center gap-1 text-foreground">
                                      {p.isVip && <Crown size={11} className="text-premium" />}
                                      <span className="truncate">{p.name}</span>
                                    </span>
                                  </td>
                                  <td className="py-2.5 text-right font-semibold text-foreground tabular-nums">
                                    {p.activeCount}
                                    {p.expiredCount > 0 && (
                                      <span
                                        className="ml-1 text-xs font-normal text-muted-foreground"
                                        title="Дууссан (сунгаж болно)"
                                      >
                                        +{p.expiredCount}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 text-right text-muted-foreground tabular-nums">
                                    {p.totalSold}
                                  </td>
                                  <td className="py-2.5 text-right font-semibold text-success tabular-nums">
                                    {formatPrice(p.revenue)}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-border text-sm font-semibold">
                              <td className="pt-2.5 text-foreground">Нийт</td>
                              <td className="pt-2.5 text-right text-foreground tabular-nums">
                                {data.planBreakdown.reduce((s, p) => s + p.activeCount, 0)}
                              </td>
                              <td className="pt-2.5 text-right text-muted-foreground tabular-nums">
                                {data.planBreakdown.reduce((s, p) => s + p.totalSold, 0)}
                              </td>
                              <td className="pt-2.5 text-right text-success tabular-nums">
                                {formatPrice(
                                  data.planBreakdown.reduce((s, p) => s + p.revenue, 0),
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                        <p className="mt-2 text-xs text-muted-foreground">
                          «Идэвхтэй» = одоо эрхтэй · <span className="text-muted-foreground">+N</span> = дууссан (сунгаж болно) · Орлого = топапгүй
                        </p>
                      </div>
                    )}
                  </section>

                  <ListCard
                    title="Сүүлийн төлбөрүүд"
                    empty="Төлбөр байхгүй байна"
                    href="/payments"
                    items={data.recentPayments.map((p) => ({
                      key: p.id,
                      label: p.user.name ?? p.user.email,
                      value: formatPrice(p.amount),
                      valueTone: 'success' as const,
                      extra: (
                        <span className="text-xs text-muted-foreground">
                          {p.isWalletTopup ? (
                            <span className="inline-flex items-center gap-1 text-primary">
                              <Wallet size={11} /> Хэтэвч
                            </span>
                          ) : (
                            (p.plan?.name ?? '—')
                          )}
                        </span>
                      ),
                    }))}
                  />
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                    label="Кино"
                    value={`${data.totalMovies} / ${data.totalSeries}`}
                    icon={<Tv size={17} />}
                  />
                  <Metric
                    label={`Түрээс · ${rangeLabel}`}
                    value={data.rentals.toLocaleString()}
                    icon={<PlayCircle size={17} />}
                  />
                </div>
              </>
            )}

            {/* ─── КОНТЕНТ ──────────────────────────────────────────────── */}
            {tab === 'content' && (
              <>
                {!content ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="admin-card h-64 animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Түрээсийн хураангуй — 2 карт */}
                    <div className="mb-5 grid gap-3 grid-cols-1 sm:grid-cols-2">
                      <Metric
                        icon={<Ticket size={17} />}
                        label="Кино түрээсийн орлого"
                        value={formatPrice(content.rentalTotal.revenue)}
                        hint={`${content.rentalTotal.count.toLocaleString()} түрээс`}
                        tone="success"
                      />
                      <Metric
                        icon={<Film size={17} />}
                        label="Түрээслэгдсэн кино"
                        value={content.topRented.length.toLocaleString()}
                        hint="өөр гарчиг"
                      />
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      {/* Хамгийн их түрээслэгдсэн */}
                      <section className="admin-card rounded-xl p-5">
                        <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                          <Ticket size={16} className="text-success" /> Хамгийн их түрээслэгдсэн
                        </h2>
                        {content.topRented.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Түрээс байхгүй байна</p>
                        ) : (
                          <div className="space-y-3">
                            {content.topRented.map((t, i) => {
                              const max = content.topRented[0]?.count || 1;
                              return (
                                <div key={t.id} className="text-sm">
                                  {/* Дээд мөр: rank + нэр + тоо/орлого */}
                                  <div className="mb-1 flex items-baseline gap-2">
                                    <span className="w-5 shrink-0 text-right text-xs font-semibold text-muted-foreground tabular-nums">
                                      {i + 1}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-foreground">
                                      {t.title}
                                    </span>
                                    <span className="shrink-0 font-semibold text-foreground tabular-nums">
                                      {t.count}
                                    </span>
                                    <span className="shrink-0 text-xs text-success tabular-nums">
                                      {formatPrice(t.revenue)}
                                    </span>
                                  </div>
                                  {/* Доод мөр: bar бүтэн өргөн (мобайлд ч уншигдана) */}
                                  <div className="ml-7 h-2 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-success transition-all"
                                      style={{ width: `${(t.count / max) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>

                      {/* Жанр бүрийн орлого */}
                      <section className="admin-card rounded-xl p-5">
                        <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                          <TrendingUp size={16} className="text-primary" /> Жанрын түрээсийн орлого
                        </h2>
                        {content.byGenre.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Мэдээлэл байхгүй</p>
                        ) : (
                          <div className="space-y-3">
                            {content.byGenre.slice(0, 10).map((g) => {
                              const max = content.byGenre[0]?.revenue || 1;
                              return (
                                <div key={g.name} className="text-sm">
                                  <div className="mb-1 flex items-baseline gap-2">
                                    <span className="min-w-0 flex-1 truncate text-foreground">
                                      {g.name}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                      {g.count} түрээс
                                    </span>
                                    <span className="shrink-0 font-semibold text-foreground tabular-nums">
                                      {formatPrice(g.revenue)}
                                    </span>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-primary transition-all"
                                      style={{ width: `${(g.revenue / max) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    </div>

                    {/* Хамгийн их үзэгдсэн */}
                    <section className="admin-card mt-5 rounded-xl p-5">
                      <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                        <Eye size={16} className="text-premium" /> Хамгийн их үзэгдсэн
                      </h2>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {content.topViewed.map((t, i) => (
                          <div
                            key={t.id}
                            className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                          >
                            <span className="w-5 text-right text-xs font-semibold text-muted-foreground tabular-nums">
                              {i + 1}
                            </span>
                            <span className="flex-1 truncate text-foreground">{t.title}</span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                              <Eye size={11} /> {t.views.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </>
            )}

            {/* ─── ЗАН ТӨЛӨВ ────────────────────────────────────────────── */}
            {/* ⚠️ Behavior таб — ins бэлэн болтол ХООСОН дэлгэц үзүүлдэг байв.
                Одоо skeleton (KPI + section) — «эвдэрсэн» мэт харагдахаас сэргийлнэ. */}
            {tab === 'behavior' && !ins && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="admin-card h-24 animate-pulse rounded-xl" />
                  ))}
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="admin-card h-56 animate-pulse rounded-xl" />
                  ))}
                </div>
              </>
            )}

            {tab === 'behavior' && ins && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    label={`Хандалт · ${rangeLabel}`}
                    value={ins.traffic.pageViews.toLocaleString()}
                    icon={<Eye size={17} />}
                  />
                  <Metric
                    label="Сесс"
                    value={ins.traffic.uniqueSessions.toLocaleString()}
                    icon={<MousePointerClick size={17} />}
                    hint={`${ins.traffic.pagesPerSession} хуудас/сесс`}
                  />
                  <Metric
                    label="Нэвтэрсэн хэрэглэгч"
                    value={ins.traffic.uniqueUsers.toLocaleString()}
                    icon={<Users size={17} />}
                  />
                  <Metric
                    label="Идэвхтэй цаг"
                    value={`${ins.traffic.peakHour}:00`}
                    icon={<Clock size={17} />}
                    hint="хамгийн их зочилдог"
                  />
                </div>

                <FunnelCard funnel={ins.funnel} />

                {/* Цагийн хуваарилалт */}
                <section className="admin-card mt-5 rounded-xl p-5">
                  <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                    <Clock size={16} className="text-primary" /> Өдрийн турших хандалт
                  </h2>
                  <HourBars hours={ins.traffic.byHour} peak={ins.traffic.peakHour} />
                </section>

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <ListCard
                    title="Хамгийн их үзсэн"
                    empty="Мэдээлэл байхгүй"
                    ranked
                    items={ins.topViewed.map((t) => ({
                      key: t.titleId,
                      label: t.title,
                      value: t.count.toLocaleString(),
                    }))}
                  />
                  <ListCard
                    title="Хамгийн их тоглуулсан"
                    empty="Мэдээлэл байхгүй"
                    ranked
                    items={ins.topPlayed.map((t) => ({
                      key: t.titleId,
                      label: t.title,
                      value: t.count.toLocaleString(),
                    }))}
                  />
                  <ListCard
                    title="Хамгийн их хайсан"
                    empty="Хайлт байхгүй"
                    icon={<Search size={15} />}
                    items={ins.searches.map((s, i) => ({
                      key: `${s.query}-${i}`,
                      label: s.query,
                      value: s.count.toLocaleString(),
                    }))}
                  />
                  {/* ⚠️ Контентын ЦООРХОЙ — хайсан ч олдоогүй зүйл */}
                  <ListCard
                    title="Олдоогүй хайлт"
                    subtitle="Эдгээр контентыг нэмэх боломж"
                    empty="Бүх хайлт үр дүнтэй"
                    tone="warning"
                    items={ins.noResultSearches.map((s, i) => ({
                      key: `${s.query}-${i}`,
                      label: s.query,
                      value: s.count.toLocaleString(),
                    }))}
                  />
                  <ListCard
                    title="Түгээмэл хуудас"
                    empty="Мэдээлэл байхгүй"
                    items={ins.topPages.map((p, i) => ({
                      key: `${p.path}-${i}`,
                      label: p.path,
                      value: p.count.toLocaleString(),
                    }))}
                  />
                  <ListCard
                    title="Хаанаас ирсэн"
                    empty="Шууд хандалт л байна"
                    icon={<Link2 size={15} />}
                    items={ins.referrers.map((r, i) => ({
                      key: `${r.source}-${i}`,
                      label: r.source,
                      value: r.count.toLocaleString(),
                    }))}
                  />
                </div>

                {/* Төхөөрөмж */}
                {ins.devices.length > 0 && (
                  <section className="admin-card mt-5 rounded-xl p-5">
                    <h2 className="mb-4 font-semibold text-foreground">Төхөөрөмж</h2>
                    <div className="flex flex-wrap gap-4">
                      {ins.devices.map((d) => {
                        const total = ins.devices.reduce((s, x) => s + x.count, 0) || 1;
                        const pct = Math.round((d.count / total) * 100);
                        return (
                          <div key={d.device} className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
                              {d.device === 'mobile' ? (
                                <Smartphone size={16} />
                              ) : (
                                <Laptop size={16} />
                              )}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {pct}%{' '}
                                <span className="font-normal text-muted-foreground">
                                  {d.device}
                                </span>
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {d.count.toLocaleString()} хандалт
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
        {/*
          ⚠️ СИСТЕМИЙН ТӨЛӨВ — хамгийн доор, БҮХ табд.

          Диск дүүрэх / CPU ачаалал / хөрвүүлэлт гацах зэрэг нь
          ӨДӨР БҮР харах зүйл БИШ, харин асуудал гарсан үед ЗААВАЛ
          хэрэгтэй. Эхний дэлгэцээс зайлуулснаар бизнесийн тоо
          тэргүүн байрт гарна.

          ⚠️ Хугацааны мужаас ХАМААРАХГҮЙ (одоогийн бодит төлөв).
        */}
        <div className="mt-6 space-y-4 border-t border-border pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Систем ба контентын төлөв
          </p>
          <ContentHealthCard />
          <ServerInsightCard />
          <StorageUsageCard />
        </div>
      </main>
    </AdminShell>
  );
}

/* ─── Дахин ашиглагдах блокууд ──────────────────────────────────────────── */

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
 * ⚠️ НЭГ жагсаалтын карт — өмнө нь ижил бүтэц 8 газарт хуулагдсан байсан.
 * Одоо нэг компонент: эрэмбэ, гарчиг, хоосон төлөв, "бүгдийг үзэх" бүгд энд.
 */
function ListCard({
  title,
  subtitle,
  items,
  empty,
  href,
  ranked,
  icon,
  tone,
}: {
  title: string;
  subtitle?: string;
  items: {
    key: string;
    label: string;
    value: string;
    valueTone?: 'success';
    extra?: React.ReactNode;
  }[];
  empty: string;
  href?: string;
  ranked?: boolean;
  icon?: React.ReactNode;
  tone?: 'warning';
}) {
  return (
    <section className="admin-card rounded-xl p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            className={cn(
              'flex items-center gap-1.5 font-semibold',
              tone === 'warning' ? 'text-warning' : 'text-foreground',
            )}
          >
            {icon}
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Бүгд <ArrowRight size={12} />
          </Link>
        )}
      </div>

      <div className="space-y-0.5">
        {items.map((it, i) => (
          <div
            key={it.key}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent/50"
          >
            {ranked && (
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold',
                  i < 3 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {i + 1}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-foreground">{it.label}</span>
            {it.extra}
            <span
              className={cn(
                'shrink-0 text-xs font-semibold',
                it.valueTone === 'success' ? 'text-success' : 'text-muted-foreground',
              )}
            >
              {it.value}
            </span>
          </div>
        ))}
        {items.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">{empty}</p>
        )}
      </div>
    </section>
  );
}

/** Үзсэн → Тоглуулсан → Дуусгасан юүлүүр */
function FunnelCard({ funnel }: { funnel: Insights['funnel'] }) {
  const steps = [
    { label: 'Үзсэн', value: funnel.views, pct: 100, tone: 'bg-primary' },
    { label: 'Тоглуулсан', value: funnel.plays, pct: funnel.playRate, tone: 'bg-success' },
    { label: 'Дуусгасан', value: funnel.completes, pct: funnel.completeRate, tone: 'bg-premium' },
  ];

  return (
    <section className="admin-card mt-5 rounded-xl p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <PlayCircle size={16} className="text-primary" /> Хөрвүүлэлтийн юүлүүр
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Контент нээснээс тоглуулж, дуустал
        </p>
      </div>
      <div className="space-y-3">
        {steps.map((s) => (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-semibold text-foreground">
                {s.value.toLocaleString()}
                <span className="ml-1.5 font-normal text-muted-foreground">{s.pct}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-all', s.tone)}
                style={{ width: `${Math.max(s.pct, 1)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 24 цагийн хандалтын багана */
function HourBars({ hours, peak }: { hours: number[]; peak: number }) {
  const max = Math.max(...hours, 1);
  return (
    <>
      {/*
        ⚠️ Багана ХАРАГДАХГҮЙ байсан: дотоод div-д `height: %` өгсөн ч
        эцэг элемент (flex item) нь тодорхой өндөргүй тул хувь тооцох
        суурь байхгүй байв. `h-full` нэмснээр эцэг нь 112px (h-28) болж,
        хувь зөв тооцогдоно.
      */}
      <div className="flex h-28 items-end gap-0.5">
        {hours.map((v, h) => (
          <div
            key={h}
            className="group relative flex h-full flex-1 items-end"
            title={`${h}:00 — ${v.toLocaleString()} хандалт`}
          >
            <div
              className={cn(
                'w-full rounded-t transition-colors',
                h === peak ? 'bg-primary' : 'bg-primary/35 group-hover:bg-primary/60',
              )}
              style={{ height: `${Math.max((v / max) * 100, 2)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </>
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
