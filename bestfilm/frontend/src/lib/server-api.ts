import { BRAND } from './brand';

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

/**
 * ⚠️⚠️ САЙТЫГ ТАНИУЛАХ ТОЛГОЙ — BestFilm-ийн БҮХ хүсэлтэд ЗААВАЛ.
 *
 * Нэг backend хоёр сайтад үйлчилдэг. Backend нь `X-Site` толгойгоор
 * ямар өгөгдөл буцаахаа шийднэ.
 *
 * ⚠️⚠️ ЯАГААД СЕРВЕР ТАЛД ОНЦГОЙ ЧУХАЛ ВЭ:
 *
 * Browser-ийн хүсэлт нь `Origin: https://bestfilm.net` илгээдэг тул
 * backend түүгээр ч таньж чадна. Харин СЕРВЕР талын хүсэлт нь
 * container-хоорондын (`http://backend:4100`) — `Origin` БАЙХГҮЙ,
 * `Host` нь `backend`. Тэгвэл backend нь `besttv` гэж таамаглана.
 *
 * ҮР ДАГАВАР: bestfilm.net-ийн НҮҮР ХУУДАС нь BestTV-ийн кино,
 * баннер, SEO-г харуулна. Хэрэглэгч эхний секундэд буруу брэнд харна.
 *
 * ⚠️ Тиймээс сервер талын fetch БҮРД энэ толгойг тавина.
 */
export const SITE_HEADER: Record<string, string> = { 'X-Site': BRAND.key };

/**
 * Сервер талын API дуудлага — `X-Site` автоматаар.
 *
 * ```ts
 * const res = await serverFetch('/api/seo', { next: { revalidate: 300 } });
 * ```
 *
 * ⚠️ Байгаа толгойг ХАДГАЛНА (`init.headers` дээр нэмнэ).
 */
export function serverFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${SERVER_API_URL}${path}`;
  return fetch(url, {
    ...init,
    headers: { ...SITE_HEADER, ...init.headers },
  });
}
