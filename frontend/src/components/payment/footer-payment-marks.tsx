'use client';

import { cn } from '@digitalger/shared';
import {
  AmexMark,
  BRAND_CHIP,
  MastercardMark,
  QPayMark,
  TCardMark,
  UnionPayMark,
  VisaMark,
  WeChatPayMark,
} from './brand-marks';

/**
 * FOOTER-ийн ТӨЛБӨРИЙН ЛОГО эгнээ.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: онлайн худалдаанд төлбөрийн брэндийн лого
 * харагдах нь ИТГЭЛИЙН гол дохио. Хэрэглэгч «энд картаа ашиглаж чадах
 * уу?» гэдгээ хуудсаа доош гүйлгэхэд шууд харна (Amazon/Temu/Netflix
 * бүгд ингэдэг).
 *
 * ⚠️ Лого бүр өөрийн БРЭНДИЙН ӨНГӨТЭЙ тул цагаан chip дотор байрлуулна.
 * Apple Pay нь эсрэгээрээ ХАР суурин дээр цагаан (Apple брэнд заавар).
 */

/** ⚠️ Дэвсгэр нь `BRAND_CHIP`-ээс (AMEX өөрөө цэнхэр плашкатай г.м) */
const CHIP = 'flex h-6 items-center justify-center rounded px-1.5 sm:h-7';

export function FooterPaymentMarks() {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end"
      aria-label="Хүлээн авах төлбөрийн хэрэгслүүд"
    >
      {/* ⚠️ Лого бүр өөр харьцаатай — өндрөөр жигдэлж өргөнийг auto */}
      <span className={cn(CHIP, BRAND_CHIP.qpay)}>
        <QPayMark className="h-5 w-auto" />
      </span>
      <span className={cn(CHIP, BRAND_CHIP.visa)}>
        <VisaMark className="h-3 w-auto" />
      </span>
      <span className={cn(CHIP, BRAND_CHIP.mastercard)}>
        <MastercardMark className="h-4 w-auto" />
      </span>
      <span className={cn(CHIP, BRAND_CHIP.unionpay)}>
        <UnionPayMark className="h-4 w-auto" />
      </span>
      {/* ⚠️ Бүтэн «AMERICAN EXPRESS» wordmark — бусадтай ижил өндөр */}
      <span className={cn(CHIP, BRAND_CHIP.amex, 'px-0')}>
        <AmexMark className="h-6 w-auto rounded-[3px] sm:h-7" />
      </span>
      <span className={cn(CHIP, BRAND_CHIP.tcard)}>
        <TCardMark className="h-4 w-auto sm:h-5" />
      </span>
      {/* ⚠️ Apple Pay / Google Pay — Bonum эрх авах хүртэл ТҮР НУУВ
          (идэвхжихэд ApplePayMark/GooglePayMark-ыг энд буцааж нэмнэ) */}
      {/* ⚠️ WeChat лого ДӨРВӨЛЖИН — өндөр=өргөн, сунгахгүй */}
      <span className={cn(CHIP, BRAND_CHIP.wechat, 'px-0')}>
        <WeChatPayMark className="size-6 rounded object-contain sm:size-7" />
      </span>
    </div>
  );
}
