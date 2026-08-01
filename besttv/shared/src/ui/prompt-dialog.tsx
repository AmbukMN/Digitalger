'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';

export interface PromptOptions {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  /** Хоосон утга зөвшөөрөх эсэх (жишээ нь холбоос салгах) */
  allowEmpty?: boolean;
}

/**
 * `window.prompt()`-ийн орлуулга. `useConfirm`-той ижил хэв маягаар
 * `usePrompt()` hook-оор дуудна — Promise<string | null> буцаана.
 */
export function PromptDialog({
  open,
  options,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  options: PromptOptions | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState('');

  React.useEffect(() => {
    if (open && options) setValue(options.defaultValue ?? '');
  }, [open, options]);

  if (!options) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() && !options.allowEmpty) return;
    onSubmit(value.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{options.title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          {options.description && (
            <p className="text-sm text-muted-foreground">{options.description}</p>
          )}
          {options.label && (
            <label className="block text-xs font-medium text-muted-foreground">
              {options.label}
            </label>
          )}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={options.placeholder}
            autoFocus
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg bg-muted py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Болих
            </button>
            <button
              type="submit"
              disabled={!value.trim() && !options.allowEmpty}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
            >
              {options.confirmLabel ?? 'Хадгалах'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
