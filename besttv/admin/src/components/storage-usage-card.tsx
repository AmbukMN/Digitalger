'use client';

import { useState } from 'react';
import { formatBytes, formatDateTime } from '@besttv/shared';
import { useQuery } from '@tanstack/react-query';
import { Clapperboard, FileVideo, Film, HardDrive, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@besttv/shared';
import { toast } from 'sonner';
import { api } from '@/lib/api';

/** Backend `/admin/analytics/storage` буцаах бүтэц */
interface TitleUsage {
  id: string;
  title: string;
  slug: string;
  type: string;
  bytes: number;
  objects: number;
  breakdown: { video: number; trailer: number; images: number; raw: number };
}

interface StorageUsage {
  /** ⚠️ Скан дэвсгэрт явж байна — тоо бэлэн БИШ */
  computing?: boolean;
  totalBytes: number;
  totalObjects: number;
  unassignedBytes: number;
  byCategory: { video: number; trailer: number; images: number; raw: number; other: number };
  titles: TitleUsage[];
  freeTierGb: number;
  usedPercentOfFreeTier: number;
  /** Сарын хадгалалтын төлбөр — үнэгүй багцыг ХАССАН */
  cost?: {
    billableGb: number;
    usdPerGb: number;
    monthlyUsd: number;
    monthlyMnt: number;
    usdMnt: number;
  };
  computedAt: string;
  cached: boolean;
}

/** Байтыг хүн уншихад ойлгомжтой болгоно (KB/MB/GB/TB) */
/* ⚠️ `fmtBytes` ХАСАГДСАН — `@besttv/shared`-ийн `formatBytes` (нэг эх сурвалж) */
const fmtBytes = formatBytes;

const CATEGORY_META = [
  { key: 'video' as const, label: 'Кино (HLS)', icon: Film, color: 'bg-primary' },
  { key: 'trailer' as const, label: 'Трейлер', icon: Clapperboard, color: 'bg-emerald-500' },
  { key: 'images' as const, label: 'Зураг', icon: ImageIcon, color: 'bg-amber-500' },
  { key: 'raw' as const, label: 'Түүхий файл', icon: FileVideo, color: 'bg-rose-500' },
  { key: 'other' as const, label: 'Бусад', icon: HardDrive, color: 'bg-slate-400' },
];

/**
 * Cloudflare R2 зай эзлэлтийн карт.
 *
 * Юуг хариулдаг вэ:
 *   - Нийт хэдэн GB эзэлж байна, үнэгүй багцын хэдэн хувь нь вэ
 *   - Аль кино хамгийн их зай иддэг вэ (эрэмбэлсэн жагсаалт)
 *   - Юу нь зай иддэг вэ (кино/трейлер/зураг/түүхий файл)
 *
 * ⚠️ "Түүхий файл" (raw) их байвал АНХААР — HLS хөрвүүлсний дараа
 * оригиналыг устгах ёстой. Тэр нь ихэвчлэн дэмий зай.
 */
export function StorageUsageCard() {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-storage-usage'],
    queryFn: () => api<StorageUsage>('/admin/analytics/storage'),
    // ⚠️ Backend 10 мин кэштэй — давтан дуудах утгагүй
    staleTime: 10 * 60_000,
    /**
     * ⚠️⚠️ `computing: true` үед 10 секунд тутам ДАХИН асууна.
     *
     * Backend restart хийсний дараа R2 скан (~98 сек) дэвсгэрт явдаг.
     * Өмнө нь хариу ирэх хүртэл ХҮЛЭЭДЭГ байсан тул карт мөнх skeleton
     * дээр гацаж, 30 секундэд Cloudflare 500 өгдөг байв (хэмжсэн).
     * Одоо шууд хариу ирээд, бэлэн болмогц автоматаар шинэчилнэ.
     */
    refetchInterval: (query) =>
      (query.state.data as StorageUsage | undefined)?.computing ? 10_000 : false,
  });

  const forceRefresh = async () => {
    await api<StorageUsage>('/admin/analytics/storage?refresh=1');
    refetch();
  };

  /**
   * USD→MNT ханш солих.
   *
   * ⚠️ `prompt` — тусдаа модал үүсгэх нь энэ ховор үйлдэлд илүүц
   * (`bank/page.tsx` ч ижил загвар ашигладаг).
   *
   * ⚠️ Backend нь 500-20,000 хязгаартай — энд ч урьдчилан шалгаж
   * дэмий хүсэлт явуулахгүй, алдааг ШУУД хэлнэ.
   */
  const editRate = async () => {
    const cur = data?.cost?.usdMnt ?? 3450;
    const input = window.prompt('USD → MNT ханш:', String(cur));
    if (input === null) return;
    const usdMnt = Number(input.replace(/[^\d]/g, ''));
    if (!Number.isFinite(usdMnt) || usdMnt < 500 || usdMnt > 20000) {
      toast.error('Ханш 500-20,000 хооронд байх ёстой');
      return;
    }
    if (usdMnt === cur) return;
    try {
      await api('/admin/analytics/storage/rate', {
        method: 'PATCH',
        body: JSON.stringify({ usdMnt }),
      });
      toast.success(`Ханш ${usdMnt.toLocaleString('mn-MN')}₮ болов`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Хадгалж чадсангүй');
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 h-5 w-40 animate-pulse rounded bg-accent" />
        <div className="mb-3 h-3 w-full animate-pulse rounded-full bg-accent" />
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-accent/60" />
          ))}
        </div>
      </div>
    );
  }

  /**
   * ⚠️ Скан дэвсгэрт явж байгааг ХЭЛНЭ — хоосон/гацсан карт харуулахгүй.
   * Ихэвчлэн backend restart-ын дараа 1-2 минут үргэлжилнэ.
   */
  if (data?.computing) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Loader2 size={14} className="animate-spin text-muted-foreground" />
          Хадгалалтын хэмжээг тооцоолж байна…
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          R2 дээрх 860,000+ файлыг сканддаг тул 1-2 минут үргэлжилнэ.
          Дуусмагц энд автоматаар харагдана.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const pct = data.usedPercentOfFreeTier;
  const overFree = data.totalBytes > data.freeTierGb * 1024 ** 3;
  const shown = expanded ? data.titles : data.titles.slice(0, 8);
  const maxBytes = data.titles[0]?.bytes || 1;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <HardDrive size={18} />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Cloudflare R2 зай</h3>
            <p className="text-xs text-muted-foreground">
              {data.totalObjects.toLocaleString('mn-MN')} файл · {data.titles.length} кино
            </p>
          </div>
        </div>
        <button
          onClick={forceRefresh}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-lg bg-accent/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          title="R2-г дахин скан хийх (10 минут кэштэй)"
        >
          <RefreshCw size={13} className={cn(isFetching && 'animate-spin')} />
          Шинэчлэх
        </button>
      </div>

      {/* ── Нийт хэмжээ + үнэгүй багцын харьцаа ── */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums">{fmtBytes(data.totalBytes)}</span>
          <span
            className={cn(
              'text-xs font-medium tabular-nums',
              overFree ? 'text-rose-500' : 'text-muted-foreground',
            )}
          >
            {pct}% / {data.freeTierGb}GB үнэгүй
          </span>
        </div>
        {/* Ангилал бүрийг ӨНГӨӨР харуулсан нэг мөр — юу зай иддэгийг шууд харна */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-accent">
          {CATEGORY_META.map(({ key, color, label }) => {
            const v = data.byCategory[key];
            if (!v) return null;
            return (
              <div
                key={key}
                className={color}
                style={{ width: `${(v / data.totalBytes) * 100}%` }}
                title={`${label}: ${fmtBytes(v)}`}
              />
            );
          })}
        </div>
        {/*
          ⚠️⚠️ БОДИТ ТӨЛБӨР — «төлбөр эхэлнэ» гэсэн ерөнхий
          анхааруулгаас хамаагүй үнэ цэнэтэй (админы хүсэлт).

          ⚠️ USD БОЛОН MNT ХОЁУЛАА: Cloudflare нь USD-ээр нэхэмжилдэг
          (данс тулгахад хэрэгтэй), харин төсөв нь төгрөгөөр
          төлөвлөгддөг. Нэгийг нь л харуулбал админ тооцоолол хийнэ.

          ⚠️ `cost` нь заавал биш (`?`) — хуучин кэш ирвэл блок
          харагдахгүй, карт УНАХГҮЙ.
        */}
        {overFree && data.cost && (
          <div className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/8 px-3 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-xs font-medium text-rose-500">
                Сарын төлбөр (хадгалалт)
              </span>
              <span className="flex items-baseline gap-2 tabular-nums">
                <span className="text-lg font-bold text-rose-500">
                  ${data.cost.monthlyUsd.toFixed(2)}
                </span>
                <span className="text-sm font-semibold text-rose-500/80">
                  ≈ {data.cost.monthlyMnt.toLocaleString('mn-MN')}₮
                </span>
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {/* ⚠️ Тооцооны ил тод байдал — админ тоог шалгаж чадна */}
              {data.cost.billableGb.toLocaleString('mn-MN')} GB төлбөртэй
              (нийтээс {data.freeTierGb} GB үнэгүй хассан) × $
              {data.cost.usdPerGb}/GB · ханш{' '}
              {/*
                ⚠️ ХАНШ ЗАСАХ — тусдаа тохиргооны хуудас байхгүй тул
                ашиглагдаж буй ЯГ ЭНД. Ханш байнга хөдөлдөг бөгөөд
                кодод хатуу бичих нь буруу.
              */}
              <button
                onClick={editRate}
                className="font-semibold text-foreground underline decoration-dotted underline-offset-2 hover:text-primary"
                title="USD→MNT ханш солих"
              >
                {data.cost.usdMnt.toLocaleString('mn-MN')}₮
              </button>
              <br />
              {/* ⚠️ Egress $0 нь R2-ийн ГОЛ давуу тал — админ мэдэх ёстой */}
              Татацын (egress) төлбөргүй. Үйлдлийн төлбөр ороогүй.
            </p>
          </div>
        )}
        {overFree && !data.cost && (
          <p className="mt-2 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-500">
            ⚠️ Үнэгүй багц ({data.freeTierGb}GB) хэтэрсэн — R2 төлбөр эхэлнэ
          </p>
        )}
      </div>

      {/* ── Ангиллын задаргаа ── */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CATEGORY_META.map(({ key, label, icon: Icon, color }) => {
          const v = data.byCategory[key];
          if (!v) return null;
          return (
            <div key={key} className="rounded-lg bg-accent/40 px-2.5 py-2">
              <div className="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn('size-2 rounded-full', color)} />
                <Icon size={12} />
                <span className="truncate">{label}</span>
              </div>
              <p className="text-sm font-semibold tabular-nums">{fmtBytes(v)}</p>
            </div>
          );
        })}
      </div>

      {/*
        ⚠️ Түүхий файл сэрэмжлүүлэг — HLS хөрвүүлсний дараа оригиналыг
        устгах ёстой. Үлдсэн бол ДЭМИЙ зай (ихэвчлэн хамгийн том файл).
      */}
      {data.byCategory.raw > 0 && (
        <p className="mb-4 rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs text-amber-600 dark:text-amber-400">
          Түүхий (хөрвүүлээгүй) файл {fmtBytes(data.byCategory.raw)} зай эзэлж байна. HLS бэлэн
          болсон кинонуудын оригиналыг устгаж зай чөлөөлж болно.
        </p>
      )}

      {/* ── Кино тус бүрийн эзлэлт ── */}
      <div className="space-y-1.5">
        {shown.map((t) => (
          <div key={t.id} className="group rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="truncate text-xs font-medium" title={t.title}>
                {t.title}
                <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">
                  {t.type === 'SERIES' ? 'цуврал' : 'кино'}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums">{fmtBytes(t.bytes)}</span>
            </div>
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-accent">
              <div
                className="bg-primary"
                style={{ width: `${(t.bytes / maxBytes) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {data.titles.length > 8 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full rounded-lg bg-accent/60 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? 'Хураах' : `Бүгдийг харах (${data.titles.length})`}
        </button>
      )}

      <p className="mt-3 text-center text-[10px] text-muted-foreground">
        {formatDateTime(data.computedAt)}
        {data.cached && ' · кэшээс'}
      </p>
    </div>
  );
}
