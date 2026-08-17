/**
 * УЛААНБААТАРЫН ЦАГИЙН ТУСЛАХУУД (UTC+8).
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: нийтлэлийн цаг нь БРЕНДИЙН цаг —
 * «Мягмар 07:00» гэдэг нь Монголын үзэгчийн 07:00 гэсэн үг, админ
 * хаана сууж байгаагаас ХАМААРАХГҮЙ.
 *
 * Гэтэл `<input type="datetime-local">` болон `new Date(...)` нь
 * BROWSER-ийн цагийн бүсээр ажилладаг. Админ гадаадад (эсвэл VPN-ээр)
 * ороход товлосон цаг ЧИМЭЭГҮЙ зөрнө — постууд шөнө дунд явна.
 *
 * ⚠️ Backend-ийн `social-slots.ts` нь ЯГ ижил тогтмолыг ашигладаг.
 * Хоёрыг ЗААВАЛ хамт өөрчилнө.
 *
 * ⚠️ Монгол улс зуны цаг ХЭРЭГЛЭДЭГГҮЙ тул тогтмол +8 зөв.
 */

export const UB_OFFSET_H = 8;

/** UI-д харуулах шошго — цагийн бүсийг ИЛ болгоно */
export const UB_LABEL = 'Улаанбаатар (GMT+8)';

/**
 * UTC огноо → `datetime-local` input-ын мөр, УЛААНБААТАРЫН цагаар.
 *
 * ⚠️ `toISOString()` нь UTC өгдөг тул шууд ашиглаж БОЛОХГҮЙ —
 * эхлээд +8 цаг шилжүүлнэ.
 */
export function utcToUbInput(d: Date): string {
  const shifted = new Date(d.getTime() + UB_OFFSET_H * 3600_000);
  return shifted.toISOString().slice(0, 16);
}

/**
 * `datetime-local` мөр (УЛААНБААТАРЫН цагаар бичигдсэн) → бодит UTC.
 *
 * ⚠️ `new Date("2026-09-01T07:00")` нь BROWSER-ийн бүсээр
 * тайлбарладаг тул ЗӨВХӨН энэ функцээр хөрвүүлнэ.
 */
export function ubInputToUtc(v: string): Date {
  /* "2026-09-01T07:00" → Z нэмж UTC болгоод, дараа нь -8 цаг */
  const asUtc = new Date(`${v}:00.000Z`);
  if (Number.isNaN(asUtc.getTime())) return asUtc;
  return new Date(asUtc.getTime() - UB_OFFSET_H * 3600_000);
}

const WEEKDAY_MN = ['Ням', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'] as const;

/**
 * UTC огноог УЛААНБААТАРЫН цагаар харуулна — «09.01 07:00 Мя».
 *
 * ⚠️ `formatDateTime` нь browser-ийн бүс ашигладаг тул нийтлэлийн
 * цаг харуулахад ТҮҮНИЙГ БИШ ЭНИЙГ хэрэглэнэ.
 */
export function formatUb(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  const s = new Date(date.getTime() + UB_OFFSET_H * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${s.getUTCFullYear()}.${p(s.getUTCMonth() + 1)}.${p(s.getUTCDate())} ` +
    `${p(s.getUTCHours())}:${p(s.getUTCMinutes())} ${WEEKDAY_MN[s.getUTCDay()]}`
  );
}

/**
 * Одоогийн УБ цагаас N цагийн дараах `datetime-local` утга.
 *
 * ⚠️ Анхдагч утгыг ирээдүйд тавина — өнгөрсөн огноог backend
 * татгалздаг тул админ шууд алдаа авах ёсгүй.
 */
export function ubInputAfterHours(h: number): string {
  return utcToUbInput(new Date(Date.now() + h * 3600_000));
}

/**
 * Админы browser Улаанбаатарын бүсэд байгаа эсэх.
 *
 * ⚠️ Зөрүүтэй бол UI-д АНХААРУУЛГА харуулна — чимээгүй зөрөхөөс
 * илүү нь админд хэлэх.
 */
export function browserOffsetDiffersFromUb(): boolean {
  /* getTimezoneOffset нь UTC-ээс хойших МИНУТ, тэмдэг нь урвуу */
  return -new Date().getTimezoneOffset() / 60 !== UB_OFFSET_H;
}
