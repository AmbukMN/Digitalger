import * as React from 'react';
import { Card, CardContent } from './card';
import { cn } from '../lib/utils';

// Admin page-уудын дээд талын статистик тоон самбар (Testimonial pattern-аас
// нэгтгэв). Жагсаалт урт болоход хэдэн ширхэг байгааг шууд харуулна.
export type StatVariant = 'default' | 'success' | 'warning' | 'destructive' | 'primary';

const VARIANT_COLOR: Record<StatVariant, string> = {
  default: '',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-amber-600 dark:text-amber-400',
  destructive: 'text-destructive',
  primary: 'text-primary',
};

export function StatCard({
  label,
  value,
  sub,
  icon,
  variant = 'default',
}: {
  label: string;
  value: number | string;
  sub?: string; // нэмэлт (жишээ "/345")
  icon?: React.ReactNode;
  variant?: StatVariant;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
        </div>
        <p className={cn('mt-1 text-2xl font-bold tabular-nums', VARIANT_COLOR[variant])}>
          {value}
          {sub && <span className="text-sm font-normal text-muted-foreground">{sub}</span>}
        </p>
      </CardContent>
    </Card>
  );
}

// 2-4 баганатай responsive grid (stat card-уудыг агуулна)
export function StatsGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>{children}</div>
  );
}
