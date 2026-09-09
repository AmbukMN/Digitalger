/**
 * ⚠️⚠️ ОДООГИЙН САЙТЫГ ТОДОРХОЙЛНО — БҮХ КЛИЕНТ КОДЫН НЭГ ЭХ СУРВАЛЖ.
 *
 * ⛔ БОДИТ АЛДАА (2026-09-09 аудит): BestFilm нь BestTV-ээс clone
 * хийж үүссэн ба frontend-ийн олон газарт `'besttv'` HARDCODE үлдсэн
 * байв:
 *
 *   · `chat-widget.tsx` — webhook-д `site` ОГТ илгээдэггүй байсан тул
 *     n8n-ийн `body.site || 'besttv'` fallback үргэлж BestTV болж,
 *     BestFilm-ийн зочин «би зөвхөн BestTV-ийн тухай туслана» гэсэн
 *     хариу авдаг байв. DB нотолгоо: ChatConversation besttv 1447 /
 *     bestfilm **0** — BestFilm-ийн яриа BestTV-ийн админ панелд
 *     орж, BestTV-ийн статистикийг гажуудуулж байсан.
 *
 *   · `track.ts` — Meta Pixel-д `site:'besttv'` hardcode. Тэр параметр
 *     нь ROAS/audience-ыг сайтаар салгах ЗОРИУЛАЛТТАЙ атал BestFilm-ийн
 *     траффик BestTV-ийн зүсмэлийг бохирдуулж байв.
 *
 * ⚠️ Хоёр container-т `NEXT_PUBLIC_SITE_URL` ЗӨВ тохируулагдсан
 * (besttv.us / bestfilm.net) тул үүнээс найдвартай гаргана.
 *
 * ⚠️ `NEXT_PUBLIC_` угтвартай тул build үед шигтгэгддэг — client
 * bundle-д хүрнэ. Тохируулаагүй бол `besttv` (одоогийн зан төлөв).
 */
export type SiteKey = 'besttv' | 'bestfilm';

export const CURRENT_SITE: SiteKey = (() => {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? '';
  return url.includes('bestfilm') ? 'bestfilm' : 'besttv';
})();
