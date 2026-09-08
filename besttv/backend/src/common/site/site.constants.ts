/**
 * ⚠️⚠️ ОЛОН САЙТЫН СУУРЬ — BestTV + BestFilm нэг backend дээр.
 *
 * ЯАГААД: bestfilm.net нь besttv.us-тай ИЖИЛ кодыг ашиглана. Кино,
 * анги, хадмал нь ХУВААЛЦСАН (нэг удаа upload → хоёр сайтад).
 * Харин хэрэглэгч, төлбөр, чат, дашбоард нь ТУСДАА.
 *
 * ⚠️ Одоо ажиллаж байгаа BestTV-ийн БҮХ өгөгдөл `besttv` болно —
 * migration нь `DEFAULT 'besttv'` тавьдаг тул нэг ч мөр
 * гараар өөрчлөгдөхгүй.
 */

/** Дэмжигдэх сайтууд. ⚠️ Шинэ сайт нэмэхэд ЗӨВХӨН энд нэмнэ. */
export const SITES = ['besttv', 'bestfilm'] as const;

export type Site = (typeof SITES)[number];

/**
 * ⚠️ Өгөгдмөл сайт — BestTV.
 *
 * Хаана хэрэглэгдэх вэ:
 *  · Migration-ий `DEFAULT` утга (хуучин мөр бүр besttv болно)
 *  · Сайт танигдаагүй үед fallback (cron, worker, CLI скрипт)
 *  · Prisma өргөтгөлийн context хоосон үеийн утга
 *
 * ⚠️ ЭНЭ УТГЫГ ХЭЗЭЭ Ч ӨӨРЧИЛЖ БОЛОХГҮЙ — өөрчилвөл байгаа
 * 2,174 хэрэглэгч, 2,708 төлбөр «хаяагүй» болж алга болно.
 */
export const DEFAULT_SITE: Site = 'besttv';

/** Хүсэлтийн толгойгоор сайт дамжуулна (frontend → backend). */
export const SITE_HEADER = 'x-site';

/** Хүчинтэй сайт эсэхийг шалгах — гаднаас ирсэн утгыг ЗААВАЛ дамжуул. */
export function isSite(value: unknown): value is Site {
  return typeof value === 'string' && (SITES as readonly string[]).includes(value);
}

/**
 * Дурын утгыг сайт болгож хөрвүүлнэ; танигдахгүй бол `besttv`.
 *
 * ⚠️ Танигдахгүй утгад алдаа ШИДЭХГҮЙ — хуучин mobile апп, хайлтын
 * бот, хуучин кэштэй хөтөч толгойгүй хандаж болно. Тэднийг
 * BestTV гэж үзэх нь ОДООГИЙН зан төлөвтэй яг ижил.
 */
export function toSite(value: unknown): Site {
  return isSite(value) ? value : DEFAULT_SITE;
}

/** Хүн уншихад зориулсан нэр — имэйл, лог, админ UI-д. */
export const SITE_LABEL: Record<Site, string> = {
  besttv: 'BestTV',
  bestfilm: 'BestFilm',
};

/** Сайт бүрийн үндсэн домэйн — имэйлийн холбоос, OG, sitemap-д. */
export const SITE_DOMAIN: Record<Site, string> = {
  besttv: 'besttv.us',
  bestfilm: 'bestfilm.net',
};
