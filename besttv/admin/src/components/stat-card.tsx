'use client';

import type { ReactNode } from 'react';
import { cn } from '@besttv/shared';

/**
 * Админы статистик карт — НЭГ ЭХ СУРВАЛЖ.
 *
 * ⚠️⚠️ ЯАГААД ВЭ: `users/page.tsx` (`MiniStat`), `email/page.tsx`
 * (`MiniStat` — өөр файлд ижил нэр) болон `payments/page.tsx`
 * (`StatCard`) гэсэн ГУРВАН бараг ижил хувилбар байв. Аль нэгэнд
 * өнгө/зай засвал бусад нь хоцорч, админ панел жигд бус харагдана.
 *
 * Хоёр байрлал:
 *   `row`  — хэвтээ (icon | label/value) — олон карт зэрэгцүүлэхэд
 *   `stack` — босоо, `hint` мөртэй — мөнгөний үзүүлэлтэд
 */
export type StatTone = 'default' | 'success' | 'premium' | 'warning' | 'danger';

const TONE_CLASS: Record<StatTone, string> = {
  default: 'bg-primary/12 text-primary',
  success: 'bg-success/12 text-success',
  premium: 'bg-amber-500/12 text-amber-500',
  /* ⚠️ `warning` нь `premium`-тай ижил өнгөтэй ч утга нь ӨӨР —
     нэгтгэвэл дараа нь аль нэгийг өөрчлөхөд нөгөө нь эвдэрнэ */
  warning: 'bg-amber-500/12 text-amber-500',
  danger: 'bg-destructive/12 text-destructive',
};

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = 'default',
  layout = 'row',
}: {
  icon: ReactNode;
  label: string;
  /** ⚠️ `string | number` — тоо (хэрэглэгчийн тоо) ба форматласан
      мөр (`formatPrice`) ХОЁУЛАА дамжина */
  value: string | number;
  /** Нэмэлт тайлбар — зөвхөн `stack` байрлалд */
  hint?: string;
  tone?: StatTone;
  layout?: 'row' | 'stack';
}) {
  const badge = (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
        TONE_CLASS[tone],
      )}
    >
      {icon}
    </span>
  );

  const shown = typeof value === 'number' ? value.toLocaleString('mn-MN') : value;

  if (layout === 'stack') {
    return (
      <div className="admin-card rounded-xl p-4">
        <div className="flex items-center gap-2.5">
          {badge}
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{label}</p>
            <p className="truncate text-lg font-bold text-foreground">{shown}</p>
          </div>
        </div>
        {hint && <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="admin-card flex items-center gap-3 rounded-xl p-3.5">
      {badge}
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-bold text-foreground">{shown}</p>
      </div>
    </div>
  );
}
