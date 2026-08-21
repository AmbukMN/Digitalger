/**
 * УЛААНБААТАРЫН ӨДРИЙН ХИЛ — НЭГ ЭХ СУРВАЛЖ.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ (бодитоор гарсан алдаанууд):
 *
 * 1. `new Date('2026-08-13')` нь ISO мөр тул `TZ` орчны хувьсагчаас
 *    ҮЛ ХАМААРАН **UTC шөнө дунд** гэж уншигдана = UB-гийн 08:00.
 *    → Админ «08-13» гэж шүүхэд тэр өдрийн 00:00–08:00-ын төлбөр
 *      АЛДАГДАЖ, оронд нь 08-14-ний өглөөнийх нэмэгддэг байв.
 *
 * 2. `new Date(str.toLocaleString('en-US', { timeZone }))` нь UB-гийн
 *    цагийн УТГЫГ уншаад локал цаг мэт Date болгодог — дараа нь дахин
 *    офсет хасвал ДАВХАР хөрвүүлэлт болно.
 *    → Өдрийн тайлан 8 цагаар хоцорч, 2026-08-21-нд орлогыг 25,000₮
 *      (бодитоор 17,900₮), шинэ хэрэглэгчийг 0 (бодитоор 6) гэж
 *      харуулсан.
 *
 * ⚠️ Монголд зуны цагийн шилжилт БАЙХГҮЙ тул офсет ҮРГЭЛЖ +8.
 *    (2015-2016 онд туршиж үзээд больсон.)
 */

/** UB нь UTC+8 — зуны цагийн шилжилтгүй */
const UB_OFFSET_MS = 8 * 3_600_000;
const DAY_MS = 86_400_000;

/** Өнөөдрийн UB огноо, `YYYY-MM-DD` */
export function ubToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
}

/**
 * `YYYY-MM-DD` огноог тухайн UB өдрийн 00:00 (UTC Date) болгоно.
 *
 * ⚠️ `new Date('2026-08-13')` ХЭРЭГЛЭХГҮЙ — тэр нь UTC шөнө дунд өгнө.
 */
export function ubDayStart(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - UB_OFFSET_MS);
}

/**
 * UB өдрийн муж: `[start, end)`.
 *
 * @param ymd     `YYYY-MM-DD` (өгөхгүй бол өнөөдөр)
 * @param offsetDays  -1 = өчигдөр, +1 = маргааш
 */
export function ubDayRange(ymd?: string, offsetDays = 0): { start: Date; end: Date } {
  const start = new Date(ubDayStart(ymd ?? ubToday()).getTime() + offsetDays * DAY_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/**
 * Админы `from`/`to` шүүлтийг UB өдрийн хилээр Prisma муж болгоно.
 *
 * ⚠️ `to` нь тухайн ӨДРИЙГ БҮТНЭЭР хамруулна — «08-13 хүртэл» гэвэл
 * 08-13-ны 23:59:59 (UB) хүртэл. Эс бөгөөс тэр өдрийн бичлэг алга болно.
 *
 * ⚠️ Цагийн бүрэлдэхүүнтэй ISO мөр (`2026-08-13T10:00:00Z`) ирвэл
 * тэр чигээр нь хүндэтгэнэ — зөвхөн цэвэр огноог л хөрвүүлнэ.
 */
export function ubRangeFilter(
  from?: string,
  to?: string,
): { gte?: Date; lt?: Date } | undefined {
  if (!from && !to) return undefined;

  const isPlainDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
  const range: { gte?: Date; lt?: Date } = {};

  if (from) {
    range.gte = isPlainDate(from) ? ubDayStart(from.trim()) : new Date(from);
  }
  if (to) {
    const t = to.trim();
    /* Огнооны төгсгөл = ДАРААГИЙН өдрийн 00:00 (`lt` тул хамрагдахгүй) */
    range.lt = isPlainDate(t)
      ? new Date(ubDayStart(t).getTime() + DAY_MS)
      : new Date(t);
  }
  return range;
}
