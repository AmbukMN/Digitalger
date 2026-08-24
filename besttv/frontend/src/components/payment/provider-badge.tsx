import { Building2, Gift, Wallet } from 'lucide-react';
import { cn } from '@besttv/shared';
import { CardGenericMark, QPayMark } from './brand-marks';

/**
 * ТӨЛБӨРИЙН АРГЫН BADGE — захиалгын түүх, админ жагсаалтад.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: хэрэглэгч «би картаараа төлсөн юм уу,
 * хэтэвчнээсээ юу?» гэдгээ түүхээсээ ЯЛГАЖ харах ёстой. Админ ч
 * «энэ мөнгө хаанаас ирсэн бэ» (QPay / карт / данс) гэдгийг нэг
 * харцаар ялгах шаардлагатай — тохируулга, буцаалт, тайлан бүгд
 * үүнээс хамаарна.
 *
 * ⚠️ Зуучлагчийн НЭР (Bonum) ХЭРЭГЛЭГЧИД харагдахгүй — зөвхөн «Карт».
 */

export type PaymentProvider = 'QPAY' | 'CARD' | 'BANK' | 'WALLET' | 'GRANT';

const MAP: Record<
  PaymentProvider,
  { label: string; cls: string; icon?: React.ReactNode }
> = {
  QPAY: {
    label: 'QPay',
    cls: 'bg-red-500/12 text-red-300 ring-red-500/25',
  },
  CARD: {
    label: 'Карт',
    cls: 'bg-blue-500/12 text-blue-300 ring-blue-500/25',
  },
  BANK: {
    label: 'Данс',
    cls: 'bg-amber-500/12 text-amber-300 ring-amber-500/25',
  },
  WALLET: {
    label: 'Хэтэвч',
    cls: 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/25',
  },
  GRANT: {
    label: 'Админ',
    cls: 'bg-foreground/8 text-foreground/50 ring-foreground/15',
  },
};

export function ProviderBadge({
  provider,
  className,
  /** Логотой эсэх — жагсаалтад зөвхөн текст хангалттай */
  withMark = false,
}: {
  provider: PaymentProvider | string | null | undefined;
  className?: string;
  withMark?: boolean;
}) {
  const key = (provider ?? 'WALLET') as PaymentProvider;
  const cfg = MAP[key] ?? MAP.WALLET;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1',
        cfg.cls,
        className,
      )}
    >
      {withMark && key === 'QPAY' && (
        <span className="flex h-3.5 w-5 items-center justify-center rounded-sm bg-white">
          <QPayMark className="h-2.5 w-4" />
        </span>
      )}
      {withMark && key === 'CARD' && <CardGenericMark className="h-3 w-4" />}
      {withMark && key === 'BANK' && <Building2 size={10} />}
      {withMark && key === 'WALLET' && <Wallet size={10} />}
      {withMark && key === 'GRANT' && <Gift size={10} />}
      {cfg.label}
    </span>
  );
}
