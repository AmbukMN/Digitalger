'use client';

import { Film, Wallet } from 'lucide-react';
import { cn } from '@besttv/shared';

/**
 * ТӨЛБӨРИЙН ТӨРЛИЙН BADGE — өнгөөр ялгасан.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: өмнө нь төлбөрийн жагсаалтад бүх мөр ижил
 * саарал текстээр гардаг тул админ гүйлгэхдээ «энэ түрээс үү, багц уу,
 * VIP үү» гэдгийг УНШИЖ БАЙЖ мэддэг байв.
 *
 * ⚠️⚠️ БАС: ширхэгээр түрээслэсэн төлбөрт `planId` NULL тул «—» гэж
 * ХООСОН гардаг байсан — админ ЯМАР кино түрээслүүлснийг огт мэдэхгүй
 * (гомдол шийдэх, тайлан гаргахад зайлшгүй).
 *
 * ⚠️ НЭГ ЭХ СУРВАЛЖ: `/payments` ба `/bank` хоёр хуудас ЭНЭ компонентыг
 *    ашиглана. Тус тусад нь бичвэл нэгийг засахад нөгөө нь зөрнө.
 */

export type PayKind = 'topup' | 'rental' | 'vip' | 'plan';

/** Badge-д ЗӨВХӨН эдгээр талбар хэрэгтэй (жагсаалт бүр өөр өөр хэлбэртэй) */
export interface PayKindInput {
  isWalletTopup: boolean;
  rentalTitle?: { title: string } | null;
  plan?: { name: string } | null;
}

/**
 * ⚠️ VIP-г НЭРЭЭР таних шаардлагатай (Payment дээр тусдаа талбар алга).
 *    DB-д «VIP багц» ба «VIP  багц 6 сар» (ДАВХАР зайтай) гэсэн ХОЁР
 *    бий тул `includes('vip')`-ээр шалгана, тэнцүүгээр БИШ.
 */
export function payKind(p: PayKindInput): PayKind {
  if (p.isWalletTopup) return 'topup';
  if (p.rentalTitle) return 'rental';
  if (p.plan?.name?.toLowerCase().includes('vip')) return 'vip';
  return 'plan';
}

/** Badge-ийн хажууд харуулах бодит нэр — түрээс бол КИНОНЫ нэр */
export function payKindName(p: PayKindInput): string {
  if (p.isWalletTopup) return 'Цэнэглэлт';
  return p.rentalTitle?.title ?? p.plan?.name ?? '—';
}

/**
 * ⚠️ Тунгалаг дэвсгэр (`/15`) + өнгөт текст — dark/light хоёуланд
 *    уншигдана. Хатуу HEX бол нэг сэдэвт уусна.
 */
const STYLE: Record<PayKind, string> = {
  topup: 'bg-primary/15 text-primary',
  rental: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  vip: 'bg-premium/15 text-premium',
  plan: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
};

const LABEL: Record<PayKind, string> = {
  topup: 'Хэтэвч',
  rental: 'Түрээс',
  vip: 'VIP',
  plan: 'Багц',
};

/** Зөвхөн badge (нэргүй) */
export function PayKindBadge({ kind, className }: { kind: PayKind; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold',
        STYLE[kind],
        className,
      )}
    >
      {kind === 'topup' && <Wallet size={10} />}
      {kind === 'rental' && <Film size={10} />}
      {LABEL[kind]}
    </span>
  );
}

/**
 * Badge + нэр — жагсаалтын нүдэнд бэлэн хэлбэр.
 *
 * ⚠️ Түрээсийн нэр нь ТОДООР — тэр бол киноны нэр, багцын нэрээс
 *    илүү өвөрмөц мэдээлэл (админ хайж байгаа зүйл).
 */
export function PayKindCell({ p, className }: { p: PayKindInput; className?: string }) {
  const k = payKind(p);
  const name = payKindName(p);
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      <PayKindBadge kind={k} />
      <span
        className={cn('truncate', k === 'rental' ? 'font-medium text-foreground' : 'text-muted-foreground')}
        title={name}
      >
        {name}
      </span>
    </span>
  );
}
