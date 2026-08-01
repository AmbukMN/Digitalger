'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, Download, Loader2, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@besttv/shared';

/** Огнооны хурдан сонголт — "сүүлийн 7 хоног" гэх мэт */
export const DATE_PRESETS = [
  { id: 'today', label: 'Өнөөдөр', days: 0 },
  { id: '7d', label: 'Сүүлийн 7 хоног', days: 6 },
  { id: '30d', label: 'Сүүлийн 30 хоног', days: 29 },
  { id: '90d', label: 'Сүүлийн 90 хоног', days: 89 },
] as const;

/** YYYY-MM-DD (local) — input[type=date]-д тохирно */
export function toDateInput(d: Date): string {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return tz.toISOString().slice(0, 10);
}

export function presetRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: toDateInput(from), to: toDateInput(to) };
}

export interface StatusTab {
  id: string;
  label: string;
  /** Тухайн төлөвт хамаарах мөрийн тоо — badge */
  count?: number;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

export interface SelectFilter {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

interface Props {
  /** Хайлтын талбар */
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;

  /** Төлөвийн табууд (заавал биш) */
  tabs?: StatusTab[];
  activeTab?: string;
  onTab?: (id: string) => void;

  /** Огнооны муж (заавал биш) */
  from?: string;
  to?: string;
  onDateRange?: (from: string, to: string) => void;

  /** Нэмэлт сонголтууд (төрөл, багц гэх мэт) */
  selects?: SelectFilter[];

  /** Тоон муж — жишээ: дүн */
  numberRange?: {
    label: string;
    min: string;
    max: string;
    onChange: (min: string, max: string) => void;
  };

  /** CSV export */
  onExport?: () => void | Promise<void>;
  exporting?: boolean;

  /** Хуудасны хэмжээ */
  limit?: number;
  onLimit?: (n: number) => void;

  /** Идэвхтэй шүүлтийн тоо — "Цэвэрлэх" товч харуулахад */
  activeCount?: number;
  onReset?: () => void;

  /** Баруун талд нэмэлт товч (жишээ: "Шинэ нэмэх") */
  actions?: React.ReactNode;
}

const LIMITS = [20, 50, 100, 200];

/**
 * Админы жагсаалтын НЭГДСЭН хэрэгслийн мөр.
 *
 * ⚠️ MVP биш — бодит ажилд хэрэгтэй бүх шүүлт нэг дор: хайлт (debounce),
 * төлөв таб + тоо, огнооны муж + хурдан сонголт, нэмэлт select-үүд, тоон
 * муж, хуудасны хэмжээ, CSV export, "цэвэрлэх".
 *
 * Дэвшилтэт шүүлтүүд нь эвхэгддэг (гол мөр цэвэрхэн байхын тулд), гэхдээ
 * идэвхтэй шүүлт байвал АВТОМАТ нээгдэж, тоо нь badge-ээр харагдана.
 */
export function DataToolbar({
  search,
  onSearch,
  searchPlaceholder = 'Хайх...',
  tabs,
  activeTab,
  onTab,
  from,
  to,
  onDateRange,
  selects,
  numberRange,
  onExport,
  exporting,
  limit,
  onLimit,
  activeCount = 0,
  onReset,
  actions,
}: Props) {
  const hasAdvanced = !!onDateRange || !!selects?.length || !!numberRange;
  const [open, setOpen] = useState(false);

  // ⚠️ Идэвхтэй шүүлттэй үед хэсгийг АВТОМАТ нээнэ — эс бөгөөс хэрэглэгч
  // "яагаад цөөн мөр харагдаж байна?" гэж эргэлзэнэ
  const autoOpened = useRef(false);
  useEffect(() => {
    if (activeCount > 0 && !autoOpened.current) {
      autoOpened.current = true;
      setOpen(true);
    }
  }, [activeCount]);

  // Хайлт — debounce (бичих бүрд сервер дуудахгүй)
  const [localSearch, setLocalSearch] = useState(search);
  useEffect(() => setLocalSearch(search), [search]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (localSearch !== search) onSearch(localSearch);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  return (
    <div className="space-y-3">
      {/* ── Гол мөр: хайлт + үйлдэл ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-8 text-sm text-foreground outline-none transition-colors focus:border-primary"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              aria-label="Хайлт цэвэрлэх"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {hasAdvanced && (
          <button
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors',
              open || activeCount > 0
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-input bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <SlidersHorizontal size={14} />
            Шүүлт
            {activeCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {activeCount}
              </span>
            )}
            <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
          </button>
        )}

        {activeCount > 0 && onReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw size={13} /> Цэвэрлэх
          </button>
        )}

        <div className="flex-1" />

        {onLimit && (
          <select
            value={limit}
            onChange={(e) => onLimit(Number(e.target.value))}
            aria-label="Хуудсанд харуулах тоо"
            className="rounded-lg border border-input bg-card px-2.5 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            {LIMITS.map((n) => (
              <option key={n} value={n}>
                {n} мөр
              </option>
            ))}
          </select>
        )}

        {onExport && (
          <button
            onClick={() => void onExport()}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            CSV
          </button>
        )}

        {actions}
      </div>

      {/* ── Төлөвийн табууд ── */}
      {!!tabs?.length && (
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTab?.(t.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === t.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {t.count != null && (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[10px] font-bold',
                    activeTab === t.id ? 'bg-black/20' : 'bg-background/60',
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Дэвшилтэт шүүлт ── */}
      {hasAdvanced && open && (
        <div className="admin-card space-y-4 rounded-xl p-4">
          {onDateRange && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Calendar size={13} /> Огнооны муж
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {DATE_PRESETS.map((p) => {
                  const r = presetRange(p.days);
                  const active = from === r.from && to === r.to;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onDateRange(r.from, r.to)}
                      className={cn(
                        'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-accent/60 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={from ?? ''}
                    onChange={(e) => onDateRange(e.target.value, to ?? '')}
                    aria-label="Эхлэх огноо"
                    className="admin-input w-auto py-1.5 text-xs"
                  />
                  <span className="text-muted-foreground">—</span>
                  <input
                    type="date"
                    value={to ?? ''}
                    onChange={(e) => onDateRange(from ?? '', e.target.value)}
                    aria-label="Дуусах огноо"
                    className="admin-input w-auto py-1.5 text-xs"
                  />
                  {(from || to) && (
                    <button
                      onClick={() => onDateRange('', '')}
                      aria-label="Огноо цэвэрлэх"
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {(!!selects?.length || numberRange) && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {selects?.map((s) => (
                <label key={s.id} className="block">
                  <span className="mb-1 block text-xs text-muted-foreground">{s.label}</span>
                  <select
                    value={s.value}
                    onChange={(e) => s.onChange(e.target.value)}
                    className="admin-select"
                  >
                    {s.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              {numberRange && (
                <div>
                  <span className="mb-1 block text-xs text-muted-foreground">
                    {numberRange.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={numberRange.min}
                      onChange={(e) => numberRange.onChange(e.target.value, numberRange.max)}
                      placeholder="Доод"
                      className="admin-input"
                    />
                    <span className="text-muted-foreground">—</span>
                    <input
                      type="number"
                      value={numberRange.max}
                      onChange={(e) => numberRange.onChange(numberRange.min, e.target.value)}
                      placeholder="Дээд"
                      className="admin-input"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Хүснэгтийн толгойн эрэмбэлэх товч */
export function SortHeader({
  label,
  field,
  sort,
  dir,
  onSort,
  align = 'left',
}: {
  label: string;
  field: string;
  sort: string;
  dir: 'asc' | 'desc';
  onSort: (field: string) => void;
  align?: 'left' | 'right';
}) {
  const active = sort === field;
  return (
    <th className={cn('px-4 py-3 font-semibold', align === 'right' ? 'text-right' : 'text-left')}>
      <button
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-foreground',
          active && 'text-foreground',
        )}
      >
        {label}
        <ChevronDown
          size={12}
          className={cn(
            'transition-transform',
            !active && 'opacity-30',
            active && dir === 'asc' && 'rotate-180',
          )}
        />
      </button>
    </th>
  );
}
