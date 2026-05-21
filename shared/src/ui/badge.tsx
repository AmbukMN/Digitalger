import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

/** Map product type string → badge color variant */
export function productTypeBadgeVariant(
  type: string,
): 'info' | 'teal' | 'purple' | 'amber' | 'secondary' {
  switch (type) {
    case 'FILE':     return 'info';
    case 'TEMPLATE': return 'teal';
    case 'LESSON':   return 'purple';
    case 'BUNDLE':   return 'amber';
    default:         return 'secondary';
  }
}

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors select-none',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground',
        secondary:
          'border-transparent bg-secondary/70 text-secondary-foreground dark:bg-secondary/40 dark:text-secondary-foreground',
        destructive:
          'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800/60 dark:text-red-400',
        outline:
          'text-foreground border-border',
        success:
          'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-400',
        warning:
          'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-400',
        /* ── Product type colors ── */
        info:
          'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-400',
        teal:
          'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-950/40 dark:border-teal-800/60 dark:text-teal-400',
        purple:
          'bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-950/40 dark:border-violet-800/60 dark:text-violet-400',
        amber:
          'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/40 dark:border-orange-800/60 dark:text-orange-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
