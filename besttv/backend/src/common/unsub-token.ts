import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * ИМЭЙЛЭЭС САЛГАХ ХОЛБООСЫН ГАРЫН ҮСЭГ.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ (бодит цоорхой):
 * `POST /email/unsubscribe` нь зөвхөн имэйл хаяг авдаг байсан тул ХЭН Ч
 * дурын хүний хаягийг бичээд маркетингаас салгаж чаддаг байв. Хохирогч
 * юу болсныг ч мэдэхгүй, дахин хэзээ ч сурталчилгаа авахгүй.
 * Production дээр баталсан: токенгүйгээр `HTTP 201` буцаана.
 *
 * ШИЙДЭЛ: имэйл бүрд тухайн хаягт л тохирох HMAC гарын үсэг үүсгэнэ.
 * Гарын үсгийг зөвхөн сервер тооцоолж чадна (нууц түлхүүртэй).
 *
 * ⚠️ ХУГАЦААГҮЙ зориуд: хэрэглэгч хагас жилийн өмнөх имэйлээ нээгээд
 * салгах эрхтэй. Гарын үсэг нь «энэ хаягийн эзэн» гэдгийг л батална.
 */

/** Гарын үсгийн урт — 32 hex тэмдэгт (128 бит) хангалттай */
const SIG_LEN = 32;

/**
 * ⚠️ Нууц түлхүүр — JWT-гийнхтэй ИЖИЛ орчны хувьсагчийг ашиглана.
 * Тусад нь шинэ секрет нэмбэл deploy үед мартагдаж, БҮХ холбоос
 * ажиллахаа болих эрсдэлтэй.
 */
function secret(): string {
  return (
    process.env.JWT_SECRET ??
    process.env.JWT_ACCESS_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    ''
  );
}

/** Имэйл хаягт тохирох гарын үсэг */
export function signUnsubscribe(email: string): string {
  const key = secret();
  if (!key) return '';
  return createHmac('sha256', key)
    .update(`unsub:${email.trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, SIG_LEN);
}

/**
 * Гарын үсэг зөв эсэх.
 *
 * ⚠️ `timingSafeEqual` — энгийн `===` нь тэмдэгт тэмдэгтээр
 * харьцуулж, эхний зөрүү дээр зогсдог. Хариу ирэх хугацааг хэмжиж
 * гарын үсгийг тааварлах боломжтой (timing attack).
 */
export function verifyUnsubscribe(email: string, sig: string): boolean {
  const expected = signUnsubscribe(email);
  if (!expected || !sig) return false;

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(sig).trim().toLowerCase(), 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
