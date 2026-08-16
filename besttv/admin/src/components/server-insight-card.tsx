'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  Server,
  Zap,
} from 'lucide-react';
import { cn } from '@besttv/shared';
import { api } from '@/lib/api';

interface ServerStats {
  system: {
    cpu: { percent: number | null; cores: number; loadPercent: number | null };
    memory: { totalMb: number; usedMb: number; availableMb: number; percent: number } | null;
    disk: { totalGb: number; usedGb: number; freeGb: number; percent: number } | null;
    load: { one: number; five: number; fifteen: number } | null;
    process: {
      rssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
      uptimeSec: number;
      nodeVersion: string;
    };
    host: { platform: string; uptimeSec: number };
    at: string;
  };
  services: {
    database: { up: boolean; latencyMs: number | null };
    redis: { up: boolean; latencyMs: number | null };
  };
}

/**
 * ⚠️ ЭРСДЭЛИЙН БОСГО — өнгө нь «одоо арга хэмжээ авах уу» гэдгийг хэлнэ.
 *
 * Дискний босго бусдаас ДООГУУР (75/90): CPU/RAM түр өндөрсөхөд сервер
 * зүгээр л удаашрана, харин диск дүүрэхэд HLS хөрвүүлэлт дунд замдаа
 * унаж, кино FAILED болно (бодитоор тохиолдсон).
 */
function tone(percent: number | null, warn = 80, danger = 92) {
  if (percent == null) return 'muted';
  if (percent >= danger) return 'danger';
  if (percent >= warn) return 'warn';
  return 'ok';
}

const TONE_BAR: Record<string, string> = {
  ok: 'bg-success',
  warn: 'bg-warning',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground/30',
};
const TONE_TEXT: Record<string, string> = {
  ok: 'text-foreground',
  warn: 'text-warning',
  danger: 'text-destructive',
  muted: 'text-muted-foreground',
};
/** Дүрсний хайрцаг — доод картуудын `bg-primary/12` хэв маягтай ижил */
const TONE_ICON: Record<string, string> = {
  ok: 'bg-primary/12 text-primary',
  warn: 'bg-warning/12 text-warning',
  danger: 'bg-destructive/12 text-destructive',
  muted: 'bg-muted text-muted-foreground',
};

/** Секунд → «12 хоног 4 цаг» / «3 цаг 20 мин» */
function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} хоног ${h} цаг`;
  if (h > 0) return `${h} цаг ${m} мин`;
  return `${m} мин`;
}

/**
 * ⚠️⚠️ БҮТЭЦ нь хяналтын самбарын `Metric`-ТЭЙ ЯГ ИЖИЛ байх ёстой
 * (`admin-card rounded-xl p-4`, гарчиг зүүн дээд, дүрс БАРУУН талд
 * 36×36 хайрцагт, утга `text-xl font-black`).
 *
 * Өмнө нь дүрсийг гарчгийн ХАЖУУД, хувийг баруун дээр тавьсан тул
 * доорх «Орлого / Шинэ хэрэглэгч» картуудтай ЗӨРЖ, хоёр өөр систем
 * зэрэгцсэн мэт харагдаж байв (админ анзаарсан).
 */
function Metric({
  icon: Icon,
  label,
  value,
  sub,
  percent,
  warn,
  danger,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  sub?: string;
  percent: number | null;
  warn?: number;
  danger?: number;
}) {
  const t = tone(percent, warn, danger);
  return (
    <div className="admin-card rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className={cn('mt-1 text-xl font-black tabular-nums', TONE_TEXT[t])}>{value}</p>
        </div>
        {/* ⚠️ Дүрсний хайрцаг — доод картуудтай ижил 36×36, өнгө нь
            эрсдэлийн түвшнийг дагана (тэдгээрт төрлийг заадаг) */}
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            TONE_ICON[t],
          )}
        >
          <Icon size={17} />
        </span>
      </div>

      {/* ⚠️ Доод мөр нь `Metric`-ийн өсөлт/hint мөртэй ижил өндөртэй */}
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate text-muted-foreground">{sub ?? ''}</span>
        {percent != null && (
          <span className={cn('shrink-0 font-semibold tabular-nums', TONE_TEXT[t])}>
            {percent.toFixed(0)}%
          </span>
        )}
      </div>

      {/* ⚠️ Дэвсгэр зураас — тоо уншихаас өмнө «дүүрсэн эсэх» нэг харцаар */}
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-accent">
        <div
          className={cn('h-full rounded-full transition-all duration-500', TONE_BAR[t])}
          style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Серверийн LIVE хяналт.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: HLS хөрвүүлэлт нь 4 цөмийг бүрэн эзэлдэг,
 * диск дүүрэхэд кино ДУНД ЗАМДАА унадаг. Админ SSH-гүйгээр «яагаад
 * сайт удаашрав», «дахин видео оруулж болох уу» гэдгийг мэдэх ёстой.
 *
 * ⚠️ 5 секунд тутам шинэчилнэ — «live» гэдэг нь тоо ХӨДӨЛЖ байх ёстой.
 * Илүү ойр давтвал `/proc/stat`-ын 200ms дээж давхцаж ачаалал өгнө.
 */
export function ServerInsightCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-server-stats'],
    queryFn: () => api<ServerStats>('/admin/server/stats'),
    refetchInterval: 5000,
    /* ⚠️ Таб идэвхгүй үед polling ЗОГСОНО — дэмий ачаалал өгөхгүй */
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  if (isLoading) {
    /* ⚠️ Skeleton нь ЭЦСИЙН бүтэцтэй ижил — эс бөгөөс дата ирэхэд
       layout үсэрнэ (CLS) */
    return (
      <div className="space-y-3">
        <div className="h-4 w-40 animate-pulse rounded bg-accent" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="admin-skeleton h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/8 p-4 text-sm text-destructive">
        <AlertTriangle size={15} className="shrink-0" />
        Серверийн мэдээлэл авч чадсангүй
      </div>
    );
  }

  const { system: s, services } = data;
  const mem = s.memory;
  const disk = s.disk;

  /* ⚠️ Аль нэг нь аюултай түвшинд хүрвэл ТОЛГОЙД анхааруулна —
     4 картыг тус тусад нь харах шаардлагагүй */
  const alerts: string[] = [];
  if (disk && disk.percent >= 90) alerts.push('Диск дүүрэх дөхөж байна');
  if (mem && mem.percent >= 92) alerts.push('Санах ой дүүрсэн');
  if (s.cpu.loadPercent != null && s.cpu.loadPercent >= 200)
    alerts.push('Процессор хэт ачаалалтай');
  if (!services.database.up) alerts.push('Өгөгдлийн сан холбогдохгүй байна');
  if (!services.redis.up) alerts.push('Redis холбогдохгүй байна');

  /**
   * ⚠️ ГАДНА ХҮРЭЭГҮЙ — картууд нь доорх «Орлого / Шинэ хэрэглэгч»
   * эгнээтэй ИЖИЛ түвшинд зэрэгцэнэ. Өмнө нь бүхэлд нь хайрцагт
   * хийсэн тул «карт доторх карт» болж, доод эгнээтэй зөрж байв.
   */
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Server size={15} className="text-primary" />
          Серверийн төлөв
          {/* ⚠️ Анивчих цэг = «энэ тоо ЖИНХЭНЭ live» гэсэн дохио */}
          <span className="flex items-center gap-1 text-[11px] font-medium text-success">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            LIVE
          </span>
        </h3>
        <span className="text-[11px] text-muted-foreground">
          Ажилласан: {fmtUptime(s.host.uptimeSec)}
        </span>
      </div>

      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {alerts.map((a) => (
            <span
              key={a}
              className="flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-1 text-[11px] font-semibold text-destructive"
            >
              <AlertTriangle size={11} className="shrink-0" />
              {a}
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={Cpu}
          label="Процессор"
          value={s.cpu.percent != null ? `${s.cpu.percent.toFixed(0)}%` : '—'}
          sub={`${s.cpu.cores} цөм${
            s.load ? ` · ачаалал ${s.load.one.toFixed(1)}` : ''
          }`}
          percent={s.cpu.percent}
        />
        <Metric
          icon={MemoryStick}
          label="Санах ой"
          value={mem ? `${(mem.usedMb / 1024).toFixed(1)} GB` : '—'}
          sub={mem ? `${(mem.totalMb / 1024).toFixed(1)} GB-аас` : undefined}
          percent={mem?.percent ?? null}
        />
        <Metric
          icon={HardDrive}
          label="Диск"
          value={disk ? `${disk.freeGb.toFixed(0)} GB сул` : '—'}
          sub={disk ? `${disk.totalGb.toFixed(0)} GB-аас` : undefined}
          percent={disk?.percent ?? null}
          /* ⚠️ Дискний босго доогуур — дүүрэхэд хөрвүүлэлт УНАНА */
          warn={75}
          danger={90}
        />
        <Metric
          icon={Activity}
          label="Ачааллын дундаж"
          value={s.load ? s.load.one.toFixed(2) : '—'}
          sub={s.load ? `5м ${s.load.five.toFixed(1)} · 15м ${s.load.fifteen.toFixed(1)}` : undefined}
          /**
           * ⚠️ Ачааллыг ЦӨМД харьцуулна: `load 4` нь 4 цөмтэй сервер
           * дээр 100% (хэвийн дээд хязгаар), 1 цөмтэйд 400% (хямрал).
           * 200%-иас дээш бол зурвас дүүрнэ.
           */
          percent={s.cpu.loadPercent != null ? Math.min(100, s.cpu.loadPercent / 2) : null}
        />
      </div>

      {/* ── Үйлчилгээ ба процесс ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="admin-card rounded-xl p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Үйлчилгээ
          </p>
          <div className="space-y-1.5">
            <ServiceRow
              icon={Database}
              label="PostgreSQL"
              up={services.database.up}
              latencyMs={services.database.latencyMs}
            />
            <ServiceRow
              icon={Zap}
              label="Redis"
              up={services.redis.up}
              latencyMs={services.redis.latencyMs}
            />
          </div>
        </div>

        <div className="admin-card rounded-xl p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Backend процесс
          </p>
          <div className="grid grid-cols-2 gap-y-1.5 text-xs">
            <span className="text-muted-foreground">Санах ой</span>
            <span className="text-right font-medium tabular-nums text-foreground">
              {s.process.rssMb} MB
            </span>
            <span className="text-muted-foreground">Heap</span>
            <span className="text-right font-medium tabular-nums text-foreground">
              {s.process.heapUsedMb} / {s.process.heapTotalMb} MB
            </span>
            <span className="text-muted-foreground">Ажилласан</span>
            <span className="text-right font-medium text-foreground">
              {fmtUptime(s.process.uptimeSec)}
            </span>
            <span className="text-muted-foreground">Node</span>
            <span className="text-right font-medium text-foreground">{s.process.nodeVersion}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceRow({
  icon: Icon,
  label,
  up,
  latencyMs,
}: {
  icon: typeof Database;
  label: string;
  up: boolean;
  latencyMs: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon size={12} className="shrink-0" />
        {label}
      </span>
      <span className="flex items-center gap-1.5">
        {/*
          ⚠️ ХОЦРОЛТЫГ ч харуулна — «ажиллаж байна» гэдэг ХАНГАЛТГҮЙ.
          200ms-ээс дээш DB нь бүрэн унахаас ӨМНӨХ эрт дохио.
        */}
        {up && latencyMs != null && (
          <span
            className={cn(
              'tabular-nums',
              latencyMs > 200 ? 'text-warning' : 'text-muted-foreground',
            )}
          >
            {latencyMs}ms
          </span>
        )}
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-bold',
            up ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
          )}
        >
          {up ? 'Хэвийн' : 'Унасан'}
        </span>
      </span>
    </div>
  );
}
