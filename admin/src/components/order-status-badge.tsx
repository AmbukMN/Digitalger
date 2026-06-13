'use client';

import { Ban, CheckCircle2, Clock, Gift, RotateCcw, XCircle } from 'lucide-react';

// ─── Захиалгын статус badge — НЭГ эх сурвалж ─────────────────────────────────
// 4 газар (dashboard / orders / payments / user-detail) ИЖИЛ харагдана:
//  • PAID + ADMIN_GRANT → нил ягаан "Төлсөн (Admin gift)" + Gift icon
//  • CANCELLED → саарал "Цуцалсан (Систем/Хэрэглэгч/Админ)" (cancelledBy) — улаан БИШ
//  • PAID=ногоон, PENDING=amber "Хүлээгдэж байна", FAILED=улаан, REFUNDED=цэнхэр
// size='sm' → жижиг (dashboard мөр / payments дэд badge), 'md' → ердийн.

// Цуцлалтын эх сурвалжийн монгол шошго
const CANCELLED_BY_LABEL: Record<string, string> = {
  USER: 'Хэрэглэгч',
  SYSTEM: 'Систем',
  ADMIN: 'Админ',
};

const STATUS_MAP: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  PAID:     { label: 'Төлсөн',          cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  PENDING:  { label: 'Хүлээгдэж байна', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="h-3 w-3" /> },
  FAILED:   { label: 'Амжилтгүй',       cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',         icon: <XCircle className="h-3 w-3" /> },
  REFUNDED: { label: 'Буцаасан',        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',     icon: <RotateCcw className="h-3 w-3" /> },
};

export interface OrderStatusBadgeProps {
  status: string;
  source?: string | null;
  cancelledBy?: string | null;
  size?: 'sm' | 'md';
}

export function OrderStatusBadge({ status, source, cancelledBy, size = 'md' }: OrderStatusBadgeProps) {
  const sizeCls = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  const base = `inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap ${sizeCls}`;

  // PAID + ADMIN_GRANT → "Admin gift" (нил ягаан онцгой өнгө)
  if (status === 'PAID' && source === 'ADMIN_GRANT') {
    return (
      <span className={`${base} bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300`}>
        <Gift className="h-3 w-3" />Төлсөн (Admin gift)
      </span>
    );
  }

  // CANCELLED → цуцалсан эх сурвалж тодотгол (саарал, улаан БИШ)
  if (status === 'CANCELLED') {
    const by = cancelledBy ? CANCELLED_BY_LABEL[cancelledBy] : null;
    return (
      <span className={`${base} bg-muted text-muted-foreground`}>
        <Ban className="h-3 w-3" />Цуцалсан{by ? ` (${by})` : ''}
      </span>
    );
  }

  const s = STATUS_MAP[status] ?? { label: status, cls: 'bg-muted text-muted-foreground', icon: <Ban className="h-3 w-3" /> };
  return (
    <span className={`${base} ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
}
