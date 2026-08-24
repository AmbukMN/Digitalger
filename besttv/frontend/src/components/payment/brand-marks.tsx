/**
 * Төлбөрийн БРЭНДИЙН ЛОГО — inline SVG.
 *
 * ⚠️⚠️ Эможи ХЭРЭГЛЭХГҮЙ. «💳» гэх мэт эможи нь платформ бүрд өөр
 * дүрсээр гарч, картын брэнд танигдахгүй болно. Хэрэглэгч VISA/
 * Mastercard/Apple Pay-ийн ЖИНХЭНЭ тэмдгийг хараад л «энэ ажиллана»
 * гэдэгт итгэдэг (төлбөрийн UX-ийн үндсэн зарчим).
 *
 * ⚠️ Лого бүр өөрийн брэндийн өнгө шаарддаг тул цагаан/хар суурьтай
 * chip дотор байрлуулна — BestTV-ийн хар дэвсгэр дээр шууд тавибал
 * VISA (хар хөх) уншигдахгүй.
 */

/**
 * ⚠️⚠️ Эдгээр нь БРЭНДИЙН АЛБАН ЁСНЫ лого файл (`public/cards/*.svg`,
 * Wikimedia Commons-ийн албан ёсны хувилбар). ГАРААР ЗУРСАН/зохиосон
 * дүрс ХЭРЭГЛЭХГҮЙ — production дээр брэнд танигдахгүй, итгэл алдагдана.
 */
function BrandImg({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}

export function VisaMark({ className = '' }: { className?: string }) {
  return <BrandImg src="/cards/visa.svg" alt="VISA" className={className} />;
}

export function MastercardMark({ className = '' }: { className?: string }) {
  return <BrandImg src="/cards/mastercard.svg" alt="Mastercard" className={className} />;
}

export function UnionPayMark({ className = '' }: { className?: string }) {
  return <BrandImg src="/cards/unionpay.svg" alt="UnionPay" className={className} />;
}

/**
 * ⚠️ AMEX-ийн албан ёсны лого нь ЦЭНХЭР ДЭВСГЭР + цагаан текст —
 * өөрөө бүтэн «плашка». Цагаан chip дотор тавибал цагаан текст нь
 * уусаж АЛГА болно. Тиймээс энэ логог chip-ГҮЙ, шууд харуулна
 * (`CARD_CHIP_BG` дотор `amex` онцгой тохиолдол).
 */
export function AmexMark({ className = '' }: { className?: string }) {
  return <BrandImg src="/cards/amex.svg" alt="American Express" className={className} />;
}

/**
 * Лого бүрийн chip-ийн дэвсгэр.
 * ⚠️ Зарим лого өөрийн дэвсгэртэй (AMEX цэнхэр, UnionPay цагаан суурьтай
 * гурван баар) тул нэг ижил цагаан chip бүгдэд ТААРАХГҮЙ.
 */
export const BRAND_CHIP: Record<string, string> = {
  /* Цагаан суурь шаардлагатай (хар/өнгөт лого) */
  visa: 'bg-white ring-1 ring-black/10',
  mastercard: 'bg-white ring-1 ring-black/10',
  unionpay: 'bg-white ring-1 ring-black/10',
  qpay: 'bg-white ring-1 ring-black/10',
  /* Өөрийн дэвсгэртэй — chip ил тод, зөвхөн хүрээ */
  amex: 'bg-transparent ring-1 ring-white/15',
  wechat: 'bg-transparent',
};

/**
 * ⚠️ Apple Pay / Google Pay — Bonum дээр ХАРААХАН ИДЭВХЖЭЭГҮЙ тул UI-д
 * харуулахгүй (`payment-method-sheet.tsx` дотор `show:false`).
 * Идэвхжихэд Apple/Google-ийн АЛБАН ЁСНЫ marketing mark файлыг татаж
 * `public/cards/` дор тавина — өөрөө зурахыг тэдний guideline ХОРИГЛОДОГ.
 */

/**
 * WeChat Pay — Bonum-аар дэмжигдэнэ.
 * ⚠️ Албан ёсны лого файл ирвэл `public/cards/wechat.svg`-ээр солино.
 * Одоохондоо ногоон дугуй + текстээр (зохиомол брэнд дүрс БИШ).
 */
export function WeChatPayMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-[#07C160] text-[9px] font-bold text-white ${className}`}
      aria-label="WeChat Pay"
      title="WeChat Pay"
    >
      WeChat
    </span>
  );
}

/**
 * QPay-ээр төлж БОЛОХ банк/апп-уудын ЖИНХЭНЭ лого.
 *
 * ⚠️⚠️ ЗОХИОСОН ICON ХЭРЭГЛЭХГҮЙ. Эдгээр нь QPay-ийн албан ёсны лого
 * (`qpay.mn/q/logo/*.png`) — бодит нэхэмжлэлийн `qpayUrls[].logo`-оос
 * татаж `public/banks/` дор хадгалсан.
 *
 * ⚠️ Гадаад CDN-ээс ШУУД ачаалахгүй: QPay-ийн сервер унавал эсвэл
 * удаашрахад манай төлбөрийн цонх эвдэрнэ. Локал хуулбар найдвартай.
 */
export const QPAY_BANKS: { src: string; name: string }[] = [
  { src: '/banks/khanbank.png', name: 'Хаан банк' },
  { src: '/banks/socialpay.png', name: 'Голомт (SocialPay)' },
  { src: '/banks/tdbbank.png', name: 'TDB' },
  { src: '/banks/xacbank.png', name: 'Хас банк' },
  { src: '/banks/state_3.png', name: 'Төрийн банк' },
  { src: '/banks/mbank.png', name: 'М банк' },
  { src: '/banks/most.png', name: 'МОСТ мони' },
  { src: '/banks/ard.png', name: 'Ард Апп' },
  { src: '/banks/monpay.png', name: 'MonPay' },
];

export function QPayBankStrip({ className = '' }: { className?: string }) {
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className}`}>
      {QPAY_BANKS.map((b) => (
        <span
          key={b.src}
          title={b.name}
          className="flex size-5 items-center justify-center overflow-hidden rounded-[4px] bg-white ring-1 ring-black/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.src} alt={b.name} className="size-full object-contain" loading="lazy" />
        </span>
      ))}
      <span className="text-[10px] font-medium text-foreground/40">+13 банк</span>
    </span>
  );
}

/**
 * Ерөнхий КАРТ тэмдэг — тодорхой брэнд заахгүй үед (badge, жагсаалт).
 * ⚠️ `currentColor` — эцэг элементийн өнгийг өвлөнө.
 */
export function CardGenericMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={className} role="img" aria-label="Карт">
      <rect x="0.75" y="0.75" width="22.5" height="14.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="0.75" y="4" width="22.5" height="2.5" fill="currentColor" />
      <rect x="3" y="9.5" width="6" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  );
}

/** QPay — QR маркер маягийн улаан тэмдэг */
export function QPayMark({ className = '' }: { className?: string }) {
  /* ⚠️ QPay-ийн албан ёсны апп icon (s3.qpay.mn-ээс татаж жижигрүүлсэн) */
  return <BrandImg src="/cards/qpay.png" alt="QPay" className={className} />;
}
