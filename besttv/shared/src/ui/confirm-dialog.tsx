'use client';

import * as React from 'react';
import { AlertTriangle, Info, Loader2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './dialog';

export type ConfirmTone = 'danger' | 'warning' | 'info';

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** Дэлгэрэнгүй тайлбар — юу болохыг жагсаана */
  bullets?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

const TONE_STYLE: Record<
  ConfirmTone,
  { icon: React.ReactNode; iconWrap: string; confirmBtn: string }
> = {
  danger: {
    icon: <Trash2 size={20} />,
    iconWrap: 'bg-destructive/15 text-destructive',
    confirmBtn: 'bg-destructive text-white hover:brightness-110',
  },
  warning: {
    icon: <AlertTriangle size={20} />,
    iconWrap: 'bg-warning/15 text-warning',
    confirmBtn: 'bg-warning text-black hover:brightness-105',
  },
  info: {
    icon: <Info size={20} />,
    iconWrap: 'bg-primary/15 text-primary',
    confirmBtn: 'bg-primary text-primary-foreground hover:brightness-110',
  },
};

/**
 * Баталгаажуулах модал — `window.confirm()`-ийн орлуулга.
 * Шууд ашиглахын оронд `useConfirm()` hook-оор дуудахыг зөвлөнө.
 */
export function ConfirmDialog({
  open,
  options,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  options: ConfirmOptions | null;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!options) return null;
  const tone = TONE_STYLE[options.tone ?? 'danger'];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                tone.iconWrap,
              )}
            >
              {tone.icon}
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base">{options.title}</DialogTitle>
              {options.description && (
                <DialogDescription className="mt-1.5 leading-relaxed">
                  {options.description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {options.bullets && options.bullets.length > 0 && (
          <ul className="ml-1 space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            {options.bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current" />
                {b}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-lg bg-muted py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            {options.cancelLabel ?? 'Болих'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            autoFocus
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all disabled:opacity-50',
              tone.confirmBtn,
            )}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {options.confirmLabel ?? 'Устгах'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
