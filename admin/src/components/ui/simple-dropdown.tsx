'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@digitalger/shared';

interface SimpleDropdownProps {
  /** Trigger товч (renderProps: нээх/хаах) */
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  disabled?: boolean;
  className?: string;
}

/**
 * Хөнгөн (Radix-гүй) dropdown — shared UI-д DropdownMenu байхгүй тул.
 * Гадна дарах/Esc дарахад хаагдана. shadcn маягийн цэвэр меню.
 */
export function SimpleDropdown({ trigger, children, align = 'end', disabled, className }: SimpleDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => !disabled && setOpen((o) => !o)}>{trigger}</div>
      {open && !disabled && (
        <div
          className={cn(
            'absolute z-50 mt-1 min-w-44 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
            'animate-in fade-in-0 zoom-in-95',
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function SimpleDropdownItem({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm outline-none transition-colors',
        'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}
