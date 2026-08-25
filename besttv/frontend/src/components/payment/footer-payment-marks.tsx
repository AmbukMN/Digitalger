'use client';

import { cn } from '@besttv/shared';
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
 * ⚠️⚠️ НЭГ ЭХ СУРВАЛЖ — түр идэвхгүй аргууд `payment-method-sheet`-д
 * тодорхойлогдоно. Энд ДАВХАР жагсаалт үүсгэвэл эрх нээгдэхэд нэгийг
 * нь засаад нөгөөг мартах эрсдэлтэй (footer амлаад sheet-д байхгүй).
 */
import { TEMP_DISABLED } from './payment-method-sheet';

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

/** ⚠️ Дэвсгэр нь `BRAND_CHIP`-ээс (AMEX өөрөө цэнхэр плашкатай г.м) */
const CHIP = 'flex h-6 items-center justify-center rounded px-1.5 sm:h-7';

export function FooterPaymentMarks() {
  /**
   * ⚠️⚠️ ИДЭВХГҮЙ АРГЫГ ФУТЕРТ Ч ХАРУУЛАХГҮЙ.
   *
   * «Амлаад чадахгүй байх нь хамгийн муу» — Apple/Google Pay-г яг энэ
   * шалтгаанаар нуусан (доор). Карт/WeChat нь Bonum-ын эрх аваагүй тул
   * төлбөрийн цонхноос НУУГДСАН атал футерт лого нь харагдвал
   * хэрэглэгч «картаар төлдөг юм байна» гээд орж ирээд ОЛОХГҮЙ.
   *
   * ⚠️ Эрх нээгдэхэд `TEMP_DISABLED`-ээс хасахад л ХОЁУЛАА (sheet +
   *    footer) зэрэг сэргэнэ — давхар жагсаалт байхгүй.
   */
  const cardOn = !TEMP_DISABLED.includes('card');
  const wechatOn = !TEMP_DISABLED.includes('wechat');

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end"
      aria-label="Хүлээн авах төлбөрийн хэрэгслүүд"
    >
      {/* ⚠️ Лого бүр өөр харьцаатай — өндрөөр жигдэлж өргөнийг auto */}
      <span className={cn(CHIP, BRAND_CHIP.qpay)}>
        <QPayMark className="h-5 w-auto" />
      </span>
      {cardOn && (
        <>
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
        </>
      )}
      {/*
        ⚠️ Apple Pay / Google Pay — Bonum дээр ХАРААХАН идэвхжээгүй тул
        footer-т ч харуулахгүй (амлаад чадахгүй байх нь хамгийн муу).
        Идэвхжихэд албан ёсны mark файлтайгаар энд нэмнэ.
      */}
      {wechatOn && (
        /* ⚠️ WeChat лого ДӨРВӨЛЖИН — өндөр=өргөн, сунгахгүй */
        <span className={cn(CHIP, BRAND_CHIP.wechat, 'px-0')}>
          <WeChatPayMark className="size-6 rounded object-contain sm:size-7" />
        </span>
      )}
    </div>
  );
}
