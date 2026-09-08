'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Monitor, Server } from 'lucide-react';
import { cn } from '@besttv/shared';
import { DATE_PRESETS, presetRange } from '@/components/data-toolbar';
import { api } from '@/lib/api';
import { AdminErrorState } from '@/components/admin-error-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { TableEmptyState } from '@/components/table-empty-state';
import { Pagination } from '@/components/pagination';
import { SiteSwitcher } from '@/components/site-switcher';

/**
 * АЛДААНЫ БҮРТГЭЛ.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: «зарим хэрэглэгч үзэж чадахгүй байна»,
 * «мөнгө шилжихгүй байна» гэсэн гомдол ирэхэд ЯМАР алдаа, ХЭДЭН хүнд,
 * ЯМАР төхөөрөмж дээр гарсныг мэдэх арга ОГТ БАЙГААГҮЙ. Одоо browser
 * болон backend-ийн алдаа хоёулаа энд цуглана.
 *
 * ⚠️ ХУРААНГУЙ нь хамгийн чухал харагдац: 1 хүний 1 алдаа vs 100 хүнд
 *    гарсан алдаа хоёрыг ЯЛГАЖ, юуг ЭХЛЭЭД засахыг харуулна.
 */

interface ErrorRow {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  path: string | null;
  userAgent: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  user: { email: string; name: string | null } | null;
}

interface SummaryRow {
  message: string;
  source: string;
  count: number;
}

export default function ErrorsPage() {
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<'' | 'client' | 'server'>('');
  const [q, setQ] = useState('');
  /** ⚠️ Огнооны муж — «өнөөдөр хэдэн алдаа» гэх шүүлтэд (UB өдрийн хил) */
  const [range, setRange] = useState({ from: '', to: '' });
  const [open, setOpen] = useState<string | null>(null);

  const { data: summary } = useQuery<SummaryRow[]>({
    queryKey: ['admin-errors-summary'],
    queryFn: () => api<SummaryRow[]>('/admin/errors/summary?hours=24'),
  });

  const { data, isLoading, isError, error, refetch } = useQuery<{
    items: ErrorRow[];
    total: number;
    totalPages: number;
  }>({
    queryKey: ['admin-errors', page, source, q, range],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page) });
      if (source) qs.set('source', source);
      if (q) qs.set('q', q);
      /* ⚠️ UB өдрийн хилээр — backend `ubRangeFilter` */
      if (range.from) qs.set('from', range.from);
      if (range.to) qs.set('to', range.to);
      return api(`/admin/errors?${qs}`);
    },
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      {/* ⚠️ Сайт солигч — алдаа нь САЙТ бүрд тусдаа бүртгэгддэг.
          Үүнгүйгээр админ аль сайтын алдаа болохыг мэдэхгүй. */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground">Алдааны бүртгэл</h1>
          <p className="text-sm text-muted-foreground">
            Хэрэглэгчийн browser болон серверийн алдаа — сүүлийн 30 хоног
          </p>
        </div>
        <SiteSwitcher />
      </div>

      {/* ХУРААНГУЙ — юуг эхлээд засахыг харуулна */}
      {!!summary?.length && (
        <div className="admin-card rounded-xl p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <AlertTriangle size={14} className="text-warning" />
            Сүүлийн 24 цагт хамгийн олон давтагдсан
          </p>
          <div className="space-y-1.5">
            {summary.slice(0, 8).map((r, i) => (
              <div
                key={`${r.source}-${r.message}-${i}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-accent/40 px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {r.source === 'client' ? (
                    <Monitor size={12} className="shrink-0 text-muted-foreground" />
                  ) : (
                    <Server size={12} className="shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate text-xs text-foreground">{r.message}</span>
                </span>
                <span className="shrink-0 rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-bold tabular-nums text-destructive">
                  {r.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Шүүлт */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Алдааны текст, зам..."
          className="min-w-60 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        {(['', 'client', 'server'] as const).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => {
              setSource(s);
              setPage(1);
            }}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              source === s ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground hover:bg-accent/70',
            )}
          >
            {s === '' ? 'Бүгд' : s === 'client' ? 'Browser' : 'Сервер'}
          </button>
        ))}
      </div>

      {/*
        ⚠️ ОГНООНЫ ХУРДАН СОНГОЛТ — «өнөөдөр хэдэн алдаа гарав»,
        «сүүлийн 3 хоногт нэмэгдсэн үү» гэх асуултад шууд хариулна.
        ⚠️ Огноо солиход `page:1` — эс бөгөөс хоосон харагдана.
      */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Хугацаа
        </span>
        {DATE_PRESETS.map((p) => {
          const r = presetRange(p.days, p.offset);
          const active = range.from === r.from && range.to === r.to;
          return (
            <button
              key={p.id}
              onClick={() => {
                setRange(r);
                setPage(1);
              }}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          );
        })}
        {(range.from || range.to) && (
          <button
            onClick={() => {
              setRange({ from: '', to: '' });
              setPage(1);
            }}
            className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Цэвэрлэх
          </button>
        )}
      </div>

      {isError ? (
        <AdminErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={8} cols={4} />
      ) : items.length === 0 ? (
        <TableEmptyState
          icon={AlertTriangle}
          message={q || source ? 'Шүүлтэд тохирох алдаа алга' : 'Алдаа бүртгэгдээгүй байна'}
          description={
            q || source
              ? 'Хайлт эсвэл шүүлтээ өөрчилж үзнэ үү.'
              : 'Энэ сайн мэдээ — хэрэглэгчид алдаагүй ажиллаж байна.'
          }
        />
      ) : (
        <div className="admin-card overflow-hidden rounded-xl">
          <div className="divide-y divide-border">
            {items.map((e) => (
              <div key={e.id} className="p-3.5">
                <button
                  onClick={() => setOpen(open === e.id ? null : e.id)}
                  className="flex w-full items-start gap-2.5 text-left"
                >
                  {e.source === 'client' ? (
                    <Monitor size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <Server size={14} className="mt-0.5 shrink-0 text-destructive" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium text-foreground">
                      {e.message}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {e.path ?? '—'} ·{' '}
                      {new Date(e.createdAt).toLocaleString('mn-MN', {
                        timeZone: 'Asia/Ulaanbaatar',
                      })}
                      {e.user ? ` · ${e.user.email}` : ' · зочин'}
                    </span>
                  </span>
                </button>

                {open === e.id && (
                  <div className="mt-2.5 space-y-2 rounded-lg bg-accent/40 p-3">
                    {e.userAgent && (
                      <p className="break-words text-[11px] text-muted-foreground">
                        <b className="text-foreground/70">Төхөөрөмж:</b> {e.userAgent}
                      </p>
                    )}
                    {!!e.meta && (
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                        {JSON.stringify(e.meta, null, 2)}
                      </pre>
                    )}
                    {e.stack && (
                      <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
                        {e.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(data?.totalPages ?? 1) > 1 && (
        <Pagination page={page} totalPages={data!.totalPages} onPage={setPage} />
      )}
    </div>
  );
}
