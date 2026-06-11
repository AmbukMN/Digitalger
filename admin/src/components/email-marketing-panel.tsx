'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Mail, MailOpen, Eye, Send, TrendingUp, ChevronLeft, ChevronRight,
  Check, X, MousePointerClick,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';

// Нэг хуудсанд харуулах кампанит мөрийн тоо.
const PAGE_SIZE = 10;
// Modal доторх хаягийн жагсаалтын нэг хуудасны тоо (backend pageSize=50).
const RECIPIENT_PAGE_SIZE = 50;

// Огноог "2026-06-11 14:32" хэлбэрээр (товч).
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// EmailLog.status → Монгол текст + badge өнгө.
function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'delivered':
      return { label: 'Хүргэгдсэн', cls: 'bg-green-500/15 text-green-600 dark:text-green-400' };
    case 'sent':
      return { label: 'Илгээсэн', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' };
    case 'bounced':
      return { label: 'Буцсан', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' };
    case 'complained':
      return { label: 'Гомдол', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' };
    case 'failed':
      return { label: 'Амжилтгүй', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' };
    case 'queued':
      return { label: 'Дараалалд', cls: 'bg-muted text-muted-foreground' };
    default:
      return { label: status, cls: 'bg-muted text-muted-foreground' };
  }
}

/**
 * Нэг кампанит ажлын ХААЯГ БҮРИЙН илгээлтийн жагсаалт (modal).
 * Аль хаяг руу, ямар имэйл, status, нээсэн эсэх, хэзээ.
 * key === 'transactional' бол нээлт байхгүй (pixel-гүй) — opened баганыг нуухгүй,
 * харин бүгд ✗ гарна.
 */
function CampaignRecipientsDialog({
  campaign,
  days,
  onClose,
}: {
  campaign: { key: string; label: string } | null;
  days: number;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const key = campaign?.key;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'email-campaign', key, days, page],
    queryFn: () => adminApi.getEmailCampaignRecipients(key!, days, page),
    enabled: !!key,
    staleTime: 30_000,
  });

  const isTransactional = key === 'transactional';
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / RECIPIENT_PAGE_SIZE));

  return (
    <Dialog open={!!campaign} onOpenChange={(o) => { if (!o) { onClose(); setPage(1); } }}>
      <DialogContent className="max-w-5xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            {campaign?.label ?? 'Илгээлт'}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Хаяг бүрийн илгээлт · {total.toLocaleString('mn-MN')} нийт
            {isTransactional && ' · ⚠️ Гүйлгээний имэйлд нээлт хянадаггүй (зөвхөн маркетинг имэйлд)'}
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="rounded-full bg-muted p-3">
              <Send className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Илгээлт алга</p>
          </div>
        ) : (
          <>
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Хаяг</th>
                    <th className="px-3 py-2 font-medium">Гарчиг</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Статус</th>
                    {/* Нээсэн багана зөвхөн МАРКЕТИНГ имэйлд (transactional-д pixel байхгүй) */}
                    {!isTransactional && <th className="px-3 py-2 font-medium text-center whitespace-nowrap">Нээсэн</th>}
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Огноо</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => {
                    const sb = statusBadge(r.status);
                    return (
                      <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                        {/* Хаяг — бүтэн харуулна (таслахгүй) */}
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{r.to}</td>
                        {/* Гарчиг — бүтэн харуулна (таслахгүй); урт бол доош мөр шилжинэ */}
                        <td className="px-3 py-2 text-muted-foreground min-w-[16rem]">{r.subject}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${sb.cls}`}>
                            {sb.label}
                          </span>
                        </td>
                        {!isTransactional && (
                          <td className="px-3 py-2 text-center">
                            {r.opened ? (
                              <span
                                className="inline-flex items-center gap-1 text-green-600 dark:text-green-400"
                                title={r.openedAt ? `Нээсэн: ${fmtDateTime(r.openedAt)}` : undefined}
                              >
                                <Check className="h-4 w-4" />
                              </span>
                            ) : (
                              <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                          {fmtDateTime(r.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground">
                  {(page - 1) * RECIPIENT_PAGE_SIZE + 1}–{Math.min(page * RECIPIENT_PAGE_SIZE, total)} / {total}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 text-xs font-medium tabular-nums">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value, sub, icon, valueClass }: {
  label: string; value: number | string; sub?: string;
  icon: React.ReactNode; valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 rounded-lg bg-primary/10 p-2 w-fit text-primary">{icon}</div>
      <p className={`text-2xl font-bold tracking-tight tabular-nums ${valueClass ?? ''}`}>
        {typeof value === 'number' ? value.toLocaleString('mn-MN') : value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground/60">{sub}</p>}
    </div>
  );
}

/**
 * Имэйл маркетингийн бүрэн самбар (dashboard-д):
 * - 4 summary карт (илгээсэн / нээлт / нээсэн хүн / open rate)
 * - кампанит ажил бүрийн дэлгэрэнгүй хүснэгт (pagination 6/хуудас, шинэ нь эхэнд)
 * ⚠️ Зөвхөн AWS SES-ээс хойших дата (backend талд шүүгдсэн).
 */
export function EmailMarketingPanel() {
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);
  // Modal-д харуулах сонгосон кампанит ажил (мөр дээр дарахад).
  const [selected, setSelected] = useState<{ key: string; label: string } | null>(null);

  const { data: email, isLoading } = useQuery({
    queryKey: ['analytics', 'email', days],
    queryFn: () => adminApi.getEmailAnalytics(days),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const DAYS_OPTIONS = [
    { label: '7 хоног', value: 7 },
    { label: '30 хоног', value: 30 },
    { label: '90 хоног', value: 90 },
  ];

  // Backend нь хамгийн их sent-ээр эрэмбэлсэн ирдэг. Гэхдээ "хамгийн сүүлийнх
  // эхэнд" гэсэн тул bulk/broadcast (Date.now key)-ийг key-ээр буурахаар эрэмбэлж,
  // дараа нь бусдыг (sent-ээр) залгана — шинэ илгээлт хамгийн дээр гарна.
  const sorted = (() => {
    if (!email) return [];
    const isDated = (k: string) => k.startsWith('bulk-') || k.startsWith('broadcast-');
    const dated = email.campaigns
      .filter((c) => isDated(c.key))
      .sort((a, b) => b.key.localeCompare(a.key)); // bulk-<timestamp> буурахаар = шинэ эхэнд
    const others = email.campaigns.filter((c) => !isDated(c.key));
    return [...dated, ...others];
  })();

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <Send className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Имэйл маркетинг</h2>
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          AWS SES-ээс хойш
        </span>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
          {DAYS_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => { setDays(o.value); setPage(1); }}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${days === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : email && email.totalSent > 0 ? (
        <>
          {/* ── 4 summary карт ── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Нийт илгээсэн имэйл"
              value={email.totalSent}
              sub={email.totalDelivered > 0 ? `Хүргэгдсэн: ${email.totalDelivered.toLocaleString('mn-MN')}` : undefined}
              icon={<Mail className="h-4 w-4" />}
            />
            <SummaryCard
              label="Нийт нээлт"
              value={email.totalOpensPeriod}
              sub="Бүх нээлтийн тоо (давхардалтай)"
              icon={<MailOpen className="h-4 w-4" />}
            />
            <SummaryCard
              label="Нээсэн хүн (unique)"
              value={email.totalUnique}
              sub="Давхардалгүй хүний тоо"
              icon={<Eye className="h-4 w-4" />}
            />
            <SummaryCard
              label="Нээлтийн хувь (open rate)"
              value={`${email.overallOpenRate}%`}
              sub="Нээсэн хүн / Илгээсэн"
              icon={<TrendingUp className="h-4 w-4" />}
              valueClass={email.overallOpenRate >= 25 ? 'text-green-600 dark:text-green-400' : email.overallOpenRate >= 10 ? 'text-amber-600 dark:text-amber-400' : ''}
            />
          </div>

          {/* ── Кампанит ажил бүрийн дэлгэрэнгүй хүснэгт (pagination) ── */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Илгээлт бүрийн задаргаа</p>
              <span className="text-[11px] text-muted-foreground">
                Шинэ илгээлт эхэнд · {sorted.length} нийт
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Кампанит ажил</th>
                    <th className="px-3 py-2.5 font-medium text-right">Илгээсэн</th>
                    <th className="px-3 py-2.5 font-medium text-right">Хүлээн авсан хүн</th>
                    <th className="px-3 py-2.5 font-medium text-right">Нээлт</th>
                    <th className="px-3 py-2.5 font-medium text-right">Нээсэн хүн</th>
                    <th className="px-4 py-2.5 font-medium text-right">Нээлтийн хувь</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((c) => {
                    const rateColor =
                      c.openRate >= 25
                        ? 'text-green-600 dark:text-green-400'
                        : c.openRate >= 10
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground';
                    const isBulk = c.key.startsWith('bulk-') || c.key.startsWith('broadcast-');
                    return (
                      <tr
                        key={c.key}
                        onClick={() => setSelected({ key: c.key, label: c.label })}
                        title="Хаяг бүрийн илгээлтийг харах"
                        className="cursor-pointer border-b border-border/50 last:border-0 transition-colors hover:bg-muted/40"
                      >
                        <td className="px-4 py-2.5">
                          <div className="group flex items-center gap-2">
                            <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${isBulk ? 'bg-primary' : 'bg-amber-400'}`} />
                            <span className="font-medium">{c.label}</span>
                            <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{c.sent.toLocaleString('mn-MN')}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {(c.recipients || c.sent).toLocaleString('mn-MN')}
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
                {/* Нийт мөр (бүх хуудасны нийлбэр) */}
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                    <td className="px-4 py-2.5">Нийт ({days} хоног)</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{email.totalSent.toLocaleString('mn-MN')}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {(email.totalRecipients || email.totalSent).toLocaleString('mn-MN')}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{email.totalOpensPeriod.toLocaleString('mn-MN')}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-primary">{email.totalUnique.toLocaleString('mn-MN')}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{email.overallOpenRate}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination — 1-ээс олон хуудас байвал */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
                <span className="text-[11px] text-muted-foreground">
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} / {sorted.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 text-xs font-medium tabular-nums">{safePage} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground/70">
              <span className="font-medium">Нээлтийн хувь</span> = нээсэн хүн ÷ хүлээн авсан хүн (нэг хаяг руу олон имэйл явсан ч 1 хүн).
              Зөвхөн <span className="font-medium">AWS SES тохируулсан огнооноос хойших</span> дата (өмнөх Resend үеийнхийг оруулаагүй).
              Нээлтийг имэйл доторх pixel-ээр бүртгэнэ — <span className="font-medium">Gmail зэрэг зургийг кэшэлдэг тул нэг хүн дахин нээхэд бүртгэгдэхгүй</span>, бодит нээлт арай өндөр байж болно.
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-12 text-center">
          <div className="rounded-full bg-muted p-3"><Send className="h-6 w-6 text-muted-foreground" /></div>
          <p className="text-sm font-medium">Энэ хугацаанд имэйл илгээгээгүй</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Subscriber → «Имэйл явуулах»-аар bulk кампанит ажил илгээмэгц энд илгээлт бүрийн нээлтийн статистик харагдана.
          </p>
        </div>
      )}

      {/* Хаяг бүрийн илгээлтийн modal (мөр дээр дарахад нээгдэнэ) */}
      <CampaignRecipientsDialog
        campaign={selected}
        days={days}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
