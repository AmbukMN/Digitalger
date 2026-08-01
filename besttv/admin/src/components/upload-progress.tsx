'use client';

import { Loader2, X } from 'lucide-react';
import { cn } from '@besttv/shared';

/**
 * Байршуулалтын явцын мөр — дахин ашиглагдана.
 *
 * Гурван төлөв:
 *   uploading  — бодит хувь (%) харагдана
 *   processing — сервер боловсруулж байна (HLS г.м.), хугацаа тодорхойгүй →
 *                bar дүүрэн + pulse анимаци
 *   error      — улаан
 */
export function UploadProgress({
  percent,
  phase = 'uploading',
  label,
  fileName,
  onCancel,
  className,
}: {
  percent: number;
  phase?: 'uploading' | 'processing' | 'error';
  label?: string;
  fileName?: string;
  /** Өгвөл "цуцлах" товч гарна */
  onCancel?: () => void;
  className?: string;
}) {
  const defaultLabel =
    phase === 'processing'
      ? 'Боловсруулж байна...'
      : phase === 'error'
        ? 'Алдаа гарлаа'
        : 'Байршуулж байна...';

  return (
    <div
      className={cn(
        'space-y-1.5 rounded-lg border bg-accent/20 px-3 py-2.5',
        phase === 'error' ? 'border-destructive/40' : 'border-border',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          {phase !== 'error' && (
            <Loader2 size={12} className="shrink-0 animate-spin text-primary" />
          )}
          <span className="truncate">{label ?? defaultLabel}</span>
          {fileName && (
            <span className="hidden truncate text-[10px] opacity-60 sm:inline">— {fileName}</span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {phase === 'uploading' && (
            <span className="font-semibold text-primary">{percent}%</span>
          )}
          {onCancel && phase !== 'error' && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Цуцлах"
              title="Байршуулалтыг цуцлах"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
            >
              <X size={13} />
            </button>
          )}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-accent">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-150',
            phase === 'processing'
              ? 'w-full animate-pulse bg-premium'
              : phase === 'error'
                ? 'w-full bg-destructive'
                : 'bg-primary',
          )}
          style={phase === 'uploading' ? { width: `${percent}%` } : undefined}
        />
      </div>
    </div>
  );
}
