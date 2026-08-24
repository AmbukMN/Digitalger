import { Building2, CreditCard, Gift, QrCode } from 'lucide-react';
import { cn } from '@digitalger/shared';

/**
 * ТӨЛБӨРИЙН АРГЫН BADGE (админ).
 *
 * ⚠️⚠️ ЯАГААД: админ «энэ мөнгө хаанаас ирсэн бэ» гэдгийг НЭГ ХАРЦААР
 * ялгах ёстой — QPay (авто), карт/WeChat (Bonum, авто), данс (ГАРААР
 * баталгаажуулна), админ (гараар олгосон эрх).
 *
 * ⚠️ Зуучлагчийн нэр (Bonum) харуулахгүй — арга нь л чухал.
 */

export type PaymentProvider = 'QPAY' | 'CARD' | 'BANK' | 'GRANT';

const MAP: Record<PaymentProvider, { label: string; cls: string; Icon: typeof QrCode }> = {
  QPAY: { label: 'QPay', cls: 'bg-red-500/12 text-red-500 ring-red-500/25', Icon: QrCode },
  CARD: { label: 'Карт', cls: 'bg-blue-500/12 text-blue-500 ring-blue-500/25', Icon: CreditCard },
  BANK: { label: 'Данс', cls: 'bg-amber-500/12 text-amber-500 ring-amber-500/25', Icon: Building2 },
  GRANT: { label: 'Админ', cls: 'bg-muted text-muted-foreground ring-border', Icon: Gift },
};

export function ProviderBadge({
  provider,
  className,
}: {
  provider?: string | null;
  className?: string;
}) {
  const key = (provider ?? 'QPAY') as PaymentProvider;
  const cfg = MAP[key] ?? MAP.QPAY;
  const { Icon } = cfg;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1',
        cfg.cls,
        className,
      )}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

/** Шүүлтийн сонголтууд — админ жагсаалтын dropdown-д */
export const PROVIDER_OPTIONS = [
  { value: 'ALL', label: 'Бүх арга' },
  { value: 'QPAY', label: 'QPay' },
  { value: 'CARD', label: 'Карт / Apple / Google / WeChat' },
  { value: 'BANK', label: 'Дансаар' },
] as const;
