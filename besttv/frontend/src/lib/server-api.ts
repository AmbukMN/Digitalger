/**
 * Сервер талын backend хаяг — НЭГ эх сурвалж.
 *
 * ⚠️ Өмнө нь `process.env.API_URL ?? 'http://localhost:4100'` гэсэн мөр
 * 9 файлд ЯГ ИЖИЛ давтагдаж байв. Порт эсвэл fallback өөрчлөгдвөл 9 газар
 * зэрэг засах шаардлагатай — нэгийг нь мартвал зөвхөн тэр хуудас эвдэрнэ
 * (олоход хэцүү алдаа).
 *
 * ⚠️ Зөвхөн СЕРВЕР талд (Server Component, route handler, sitemap).
 * Браузер талд `lib/api.ts`-ийн `NEXT_PUBLIC_API_URL` ашиглана — энэ хаяг
 * нь docker дотоод сүлжээний нэр байж болох тул browser-оос хандахгүй.
 */
export const SERVER_API_URL = process.env.API_URL ?? 'http://localhost:4100';
