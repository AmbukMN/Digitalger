'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function TimeBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="rounded-md bg-black/20 px-2.5 py-1.5 min-w-10 text-center">
        <span className="font-mono text-xl font-black tabular-nums leading-none text-secondary-foreground">
          {value}
        </span>
      </div>
      <span className="text-[9px] font-semibold tracking-wide text-secondary-foreground/70 uppercase">{label}</span>
    </div>
  );
}

interface DiscountTimerProps {
  endsAt: string;
  discountLabel?: string;
  compact?: boolean;
  hideDay?: boolean;
}

export function DiscountTimer({ endsAt, discountLabel, compact = false, hideDay = false }: DiscountTimerProps) {
  const [diff, setDiff] = useState<number | null>(null);

  useEffect(() => {
    const end = new Date(endsAt).getTime();
    const calc = () => setDiff(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (diff === null || diff <= 0) return null;

  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-secondary/90 px-3 py-2">
        <Clock className="h-3.5 w-3.5 text-secondary-foreground/80 shrink-0" />
        <span className="text-xs font-semibold text-secondary-foreground/80">Хямдрал:</span>
        <div className="flex items-baseline gap-1">
          {d > 0 && !hideDay && (
            <>
              <span className="font-mono text-sm font-black text-secondary-foreground tabular-nums">{d}</span>
              <span className="text-[10px] font-semibold text-secondary-foreground/70">өдөр</span>
              <span className="text-secondary-foreground/60 text-xs font-bold mx-0.5">·</span>
            </>
          )}
          <span className="font-mono text-sm font-black text-secondary-foreground tabular-nums">{pad(h)}</span>
          <span className="text-[10px] font-semibold text-secondary-foreground/70">цаг</span>
          <span className="text-secondary-foreground/60 text-xs font-bold mx-0.5">:</span>
          <span className="font-mono text-sm font-black text-secondary-foreground tabular-nums">{pad(m)}</span>
          <span className="text-[10px] font-semibold text-secondary-foreground/70">мин</span>
          <span className="text-secondary-foreground/60 text-xs font-bold mx-0.5">:</span>
          <span className="font-mono text-sm font-black text-secondary-foreground tabular-nums">{pad(s)}</span>
          <span className="text-[10px] font-semibold text-secondary-foreground/70">сек</span>
        </div>
        {discountLabel && (
          <span className="ml-auto rounded-full bg-secondary-foreground/15 px-2 py-0.5 text-xs font-bold text-secondary-foreground">
            {discountLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-secondary p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-3.5 w-3.5 text-secondary-foreground/80 shrink-0" />
        <span className="text-xs font-semibold text-secondary-foreground">Хямдрал дуусахад</span>
        {discountLabel && (
          <span className="ml-auto rounded-full bg-black/15 px-2 py-0.5 text-xs font-bold text-secondary-foreground">
            {discountLabel}
          </span>
        )}
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {d > 0 && (
          <>
            <TimeBlock value={String(d)} label="ӨДӨР" />
            <span className="text-xl font-black text-secondary-foreground/40 mb-3.5">·</span>
          </>
        )}
        <TimeBlock value={pad(h)} label="ЦАГ" />
        <span className="text-xl font-black text-secondary-foreground/40 mb-3.5">:</span>
        <TimeBlock value={pad(m)} label="МИНУТ" />
        <span className="text-xl font-black text-secondary-foreground/40 mb-3.5">:</span>
        <TimeBlock value={pad(s)} label="СЕК" />
      </div>
    </div>
  );
}
