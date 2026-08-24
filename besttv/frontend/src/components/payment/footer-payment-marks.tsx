'use client';

import {
  AmexMark,
  ApplePayMark,
  GooglePayMark,
  MastercardMark,
  QPayMark,
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
 * ⚠️ Лого бүр өөрийн БРЭНДИЙН ӨНГӨТЭЙ тул цагаан chip дотор байрлуулна —
 * BestTV-ийн хар дэвсгэр дээр шууд тавибал VISA (хар хөх) уншигдахгүй.
 * Apple Pay нь эсрэгээрээ ХАР суурин дээр цагаан байх ёстой (Apple-ийн
 * брэндийн заавар).
 *
 * ⚠️ Байрлал: ДЕСКТОПТ хууль эрх зүйн линкүүдийн ДООД талд баруун
 * тийш, МОБАЙЛД голд (footer.tsx дотор `items-center sm:items-end`).
 */

const CHIP =
  'flex h-6 items-center justify-center rounded bg-white px-1.5 ring-1 ring-black/10 sm:h-7';

export function FooterPaymentMarks() {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end"
      aria-label="Хүлээн авах төлбөрийн хэрэгслүүд"
    >
      <span className={CHIP}>
        <QPayMark className="h-3.5 w-6" />
      </span>
      <span className={CHIP}>
        <VisaMark className="h-3 w-8" />
      </span>
      <span className={CHIP}>
        <MastercardMark className="h-4 w-6" />
      </span>
      <span className={CHIP}>
        <UnionPayMark className="h-4 w-6" />
      </span>
      <span className={CHIP}>
        <AmexMark className="h-3.5 w-8" />
      </span>
      {/* ⚠️ Apple Pay — албан ёсны марк нь ХАР суурин дээр */}
      <span className="flex h-6 items-center justify-center rounded bg-black px-1.5 ring-1 ring-white/15 sm:h-7">
        <ApplePayMark className="h-3.5 w-9 text-white" />
      </span>
      <span className={CHIP}>
        <GooglePayMark className="h-3.5 w-9" />
      </span>
      <span className={CHIP}>
        <WeChatPayMark className="h-4 w-5" />
      </span>
    </div>
  );
}
