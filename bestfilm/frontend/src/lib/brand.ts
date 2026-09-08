/**
 * ⚠️⚠️ BESTFILM-ИЙН БРЭНД — ЦОРЫН ГАНЦ ЭХ СУРВАЛЖ.
 *
 * ЯАГААД ЭНЭ ФАЙЛ ХЭРЭГТЭЙ ВЭ:
 *
 * Энэ frontend нь BestTV-ээс хуулагдсан. Кодод «BestTV» гэсэн 60
 * файлд тархсан бичээс байсан. Тэдгээрийг гараар нэг бүрчлэн
 * солих нь ЗААВАЛ нэгийг мартахад хүргэнэ — тэр нь хэрэглэгчид
 * харагдаж, брэнд эвдэрнэ.
 *
 * ⚠️ Тиймээс БҮХ брэндийн бичээс ЭНДЭЭС уншигдана. Шинэ текст
 * бичихдээ `BRAND.name` ашигла, «BestFilm» гэж БҮҮ бич.
 *
 * ⚠️⚠️ BestTV-ийн frontend ХӨНДӨГДӨӨГҮЙ — тэнд энэ файл байхгүй,
 * бичээс нь хэвээрээ. Хоёр сайт бие даан ажиллана.
 */

export const BRAND = {
  /** Дотоод түлхүүр — backend-ийн `X-Site` толгойд явна */
  key: 'bestfilm' as const,

  /** Хүн уншихад — гарчиг, имэйл, мессежид */
  name: 'BestFilm',

  /** Домэйн — SEO, OG, canonical */
  domain: 'bestfilm.net',

  /** Бүтэн хаяг */
  url: 'https://bestfilm.net',

  /** Уриа — логонд шигдсэн */
  tagline: 'ҮЗ, МЭДЭР, ДАХИН ҮЗ',

  /** SEO гарчиг (дэлгэц дээрх хамгийн эхний сэтгэгдэл) */
  metaTitle: 'BestFilm — Үз, мэдэр, дахин үз',

  metaDescription:
    'Монгол хэлээрх кино, цуврал онлайнаар. Зар сурталчилгаагүй, өндөр чанартай.',

  /**
   * ⚠️ БРЭНДИЙН УЛААН — хоёр горимд ӨӨР.
   *
   * dark  #F80010 — логоны ЯГ өнгө, хар дэвсгэр дээр 4.85:1 ✅ AA
   * light #C8001E — цагаан дээр 6.04:1 ✅ AA
   *
   * ⚠️ Логоны `#F80010` нь цагаан дэвсгэр дээр 4.20:1 — WCAG AA
   * (4.5:1) ХАНГАХГҮЙ. Жижиг текст бүдэг харагдана. Тиймээс light
   * горимд арай гүн улаан.
   */
  color: {
    dark: '#F80010',
    light: '#C8001E',
  },

  /** «best» үгийн мөнгөлөг өнгө (логоос) */
  silver: '#F8F8F8',

  /** Лого — `public/brand/` дор */
  logo: {
    dark: '/brand/bestfilm-logo-dark.png',
    light: '/brand/bestfilm-logo-light.png',
  },
} as const;

/** ⚠️ Богино хэлбэр — олон газарт хэрэглэгдэнэ */
export const BRAND_NAME = BRAND.name;
export const BRAND_DOMAIN = BRAND.domain;
export const BRAND_URL = BRAND.url;

/**
 * ⚠️ Зочны орлуулагч имэйл — жинхэнэ имэйл БИШ.
 *
 * Backend-ийн `site-config.ts`-тэй ЯГ ТААРАХ ЁСТОЙ. Зөрвөл зочин
 * хэрэглэгчид имэйл илгээхийг оролдож, SES bounce хуримтлана.
 */
export const GUEST_EMAIL_SUFFIX = '@guest.bestfilm.net';
export const NO_EMAIL_SUFFIX = '@noemail.bestfilm.net';
