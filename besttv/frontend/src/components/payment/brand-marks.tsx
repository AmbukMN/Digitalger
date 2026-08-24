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

export function VisaMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 16" className={className} role="img" aria-label="VISA">
      <text
        x="0"
        y="13"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontStyle="italic"
        fontSize="15"
        fill="#1A1F71"
      >
        VISA
      </text>
    </svg>
  );
}

export function MastercardMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 20" className={className} role="img" aria-label="Mastercard">
      <circle cx="12.5" cy="10" r="8" fill="#EB001B" />
      <circle cx="19.5" cy="10" r="8" fill="#F79E1B" fillOpacity="0.9" />
    </svg>
  );
}

export function UnionPayMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 20" className={className} role="img" aria-label="UnionPay">
      <g transform="skewX(-8)">
        <rect x="5" y="2" width="8" height="16" rx="1.5" fill="#E21836" />
        <rect x="13" y="2" width="8" height="16" rx="1.5" fill="#00447C" />
        <rect x="21" y="2" width="8" height="16" rx="1.5" fill="#007B84" />
      </g>
    </svg>
  );
}

export function AmexMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 16" className={className} role="img" aria-label="American Express">
      <rect width="44" height="16" rx="2" fill="#016FD0" />
      <text
        x="22"
        y="11.5"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="9"
        fill="#fff"
      >
        AMEX
      </text>
    </svg>
  );
}

/** Apple Pay — албан ёсны марк нь ХАР суурин дээр цагаан */
export function ApplePayMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 52 22" className={className} role="img" aria-label="Apple Pay">
      <path
        fill="currentColor"
        d="M11.2 4.3c.63-.79 1.06-1.87.94-2.96-.91.04-2.02.6-2.67 1.39-.58.68-1.1 1.79-.96 2.84 1.02.08 2.05-.51 2.69-1.27zm.92 1.58c-1.48-.09-2.74.84-3.45.84-.71 0-1.79-.8-2.95-.78-1.52.02-2.92.88-3.7 2.25-1.58 2.74-.41 6.8 1.12 9.03.75 1.1 1.64 2.33 2.82 2.29 1.13-.04 1.56-.73 2.93-.73 1.37 0 1.75.73 2.95.71 1.22-.02 1.99-1.12 2.73-2.22.86-1.27 1.22-2.5 1.24-2.57-.03-.01-2.38-.92-2.4-3.63-.02-2.27 1.85-3.35 1.94-3.41-1.06-1.56-2.71-1.74-3.29-1.78z"
      />
      <text
        x="20"
        y="17"
        fontFamily="-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif"
        fontWeight="600"
        fontSize="14"
        fill="currentColor"
      >
        Pay
      </text>
    </svg>
  );
}

/** Google Pay — албан ёсны марк нь ЦАГААН суурин дээр */
export function GooglePayMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 54 22" className={className} role="img" aria-label="Google Pay">
      <g transform="translate(1,3) scale(0.33)">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 3-2.26 5.54-4.78 7.25l7.73 6c4.51-4.18 7.09-10.36 7.09-17.72z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </g>
      <text
        x="20"
        y="16.5"
        fontFamily="Roboto, Arial, Helvetica, sans-serif"
        fontWeight="500"
        fontSize="13"
        fill="#5F6368"
      >
        Pay
      </text>
    </svg>
  );
}

export function WeChatPayMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 24" className={className} role="img" aria-label="WeChat Pay">
      <path
        fill="#07C160"
        d="M11.5 2C6 2 1.6 5.72 1.6 10.24c0 2.53 1.36 4.63 3.44 6.14l-.9 2.7 3.14-1.58c.98.28 1.98.48 3.06.48h.5a7.3 7.3 0 0 1-.3-2.06c0-4.32 4.22-7.82 9.3-7.82h.5C19.5 4.6 15.9 2 11.5 2zM8.3 8.42c-.62 0-1.12-.5-1.12-1.12S7.68 6.18 8.3 6.18s1.12.5 1.12 1.12-.5 1.12-1.12 1.12zm6.4 0c-.62 0-1.12-.5-1.12-1.12s.5-1.12 1.12-1.12 1.12.5 1.12 1.12-.5 1.12-1.12 1.12z"
      />
      <path
        fill="#07C160"
        d="M28.4 15.84c0-3.78-3.66-6.84-8.16-6.84s-8.1 3.06-8.1 6.84 3.6 6.84 8.1 6.84c.92 0 1.82-.14 2.64-.4l2.6 1.36-.7-2.28c1.8-1.24 3.62-3.08 3.62-5.52zm-10.9-.98c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9zm5.5 0c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9z"
      />
    </svg>
  );
}

/**
 * QPay-ээр төлж БОЛОХ банк/апп-уудын жижиг тэмдэг (Temu маягаар).
 *
 * ⚠️⚠️ ЯАГААД СТАТИК ВЭ: QPay-ийн жинхэнэ лого нь нэхэмжлэл ҮҮССЭНИЙ
 * ДАРАА `urls[].logo`-оор ирдэг. Гэтэл төлбөрийн арга сонгох цонх нь
 * нэхэмжлэл үүсгэхээс ӨМНӨ нээгддэг тул тэр үед лого БАЙХГҮЙ.
 * Хэрэглэгчид «миний банк энд байна уу?» гэдгийг ЭХЛЭЭД харуулах нь
 * чухал тул товч нэрийг өнгөт chip болгон харуулна (жинхэнэ лого нь
 * QR цонхонд гарна).
 *
 * ⚠️ Өнгө нь банк бүрийн брэндийн үндсэн өнгө — таних тэмдэг болно.
 */
export const QPAY_BANKS: { short: string; name: string; bg: string }[] = [
  { short: 'Х', name: 'Хаан банк', bg: '#0B7A3E' },
  { short: 'Г', name: 'Голомт банк', bg: '#0B4DA2' },
  { short: 'S', name: 'SocialPay', bg: '#E4002B' },
  { short: 'T', name: 'TDB', bg: '#004B93' },
  { short: 'Х', name: 'ХАС банк', bg: '#F58220' },
  { short: 'Т', name: 'Төрийн банк', bg: '#005BAA' },
  { short: 'M', name: 'M банк', bg: '#6A1B9A' },
  { short: 'A', name: 'Ard App', bg: '#111827' },
];

export function QPayBankStrip({ className = '' }: { className?: string }) {
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className}`} aria-hidden>
      {QPAY_BANKS.map((b, i) => (
        <span
          key={`${b.name}-${i}`}
          title={b.name}
          style={{ backgroundColor: b.bg }}
          className="flex size-4 items-center justify-center rounded-[3px] text-[8px] font-bold text-white ring-1 ring-white/15"
        >
          {b.short}
        </span>
      ))}
      <span className="text-[10px] font-medium text-foreground/40">гэх мэт</span>
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
  return (
    <svg viewBox="0 0 30 20" className={className} role="img" aria-label="QPay">
      <g fill="#E6212A">
        <rect x="1" y="1.5" width="7.5" height="7.5" rx="1.5" />
        <rect x="3" y="3.5" width="3.5" height="3.5" fill="#fff" />
        <rect x="1" y="11" width="7.5" height="7.5" rx="1.5" />
        <rect x="3" y="13" width="3.5" height="3.5" fill="#fff" />
        <rect x="11" y="1.5" width="3" height="3" rx="0.7" />
        <rect x="15" y="5" width="3" height="3" rx="0.7" />
        <rect x="11" y="8.5" width="3" height="3" rx="0.7" />
        <rect x="11" y="15" width="3" height="3.5" rx="0.7" />
        <rect x="15" y="11.5" width="3" height="3" rx="0.7" />
      </g>
      <text
        x="20"
        y="14"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="10"
        fill="#111"
      >
        Q
      </text>
    </svg>
  );
}
