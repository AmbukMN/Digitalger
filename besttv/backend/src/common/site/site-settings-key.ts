import { currentSite } from './site-context';
import { DEFAULT_SITE, type Site } from './site.constants';

/**
 * ⚠️⚠️ `Settings` ХҮСНЭГТИЙГ САЙТААР САЛГАХ.
 *
 * `Settings` нь `key` (үндсэн түлхүүр) + `value` (JSON) бүтэцтэй.
 * Модел нь SHARED — учир нь зарим тохиргоо ҮНЭХЭЭР нийтлэг
 * (R2 түлхүүр, SES credential, n8n webhook).
 *
 * Харин брэнд, SEO, багц, банк, QPay merchant нь сайт бүрд ӨӨР.
 * Тэднийг МОДЕЛ биш, ТҮЛХҮҮР түвшинд салгана:
 *
 *     besttv   → 'brand'              (⚠️ ХУУЧИН түлхүүр ХЭВЭЭР)
 *     bestfilm → 'bestfilm:brand'
 *
 * ⚠️⚠️ ЯАГААД BestTV-Д УГТВАР ТАВИХГҮЙ ВЭ:
 *
 * Одоо DB-д `brand`, `seo`, `bank` гэсэн мөр БАЙГАА. Хэрэв
 * `besttv:brand` болгож өөрчилвөл MIGRATION хийх шаардлагатай
 * бөгөөд алдвал сайтын лого, SEO ЧИМЭЭГҮЙ АЛГА БОЛНО.
 *
 * Угтваргүй үлдээснээр:
 *   · BestTV-ийн одоогийн тохиргоо ХЭВЭЭР ажиллана (migration 0)
 *   · BestFilm нь шинэ түлхүүрээр эхэлнэ (өгөгдмөл утгаас)
 *   · Буцаах нь амархан — шинэ мөрийг устгахад л хангалттай
 */

/**
 * Сайтын тохиргооны түлхүүр.
 *
 * ```ts
 * const key = siteKey('brand');       // besttv   → 'brand'
 *                                     // bestfilm → 'bestfilm:brand'
 * ```
 */
export function siteKey(base: string, site?: Site): string {
  const s = site ?? currentSite();
  return s === DEFAULT_SITE ? base : `${s}:${base}`;
}

/**
 * ⚠️ ХУВААЛЦСАН тохиргоо — сайт харгалзахгүй НЭГ утга.
 *
 * Хэрэглэх: R2 хадгалалтын хэмжээ, дотоод тоолуур зэрэг
 * ҮНЭХЭЭР нийтлэг зүйлд. Брэнд, SEO-д ХЭРЭГЛЭЖ БОЛОХГҮЙ.
 */
export function sharedKey(base: string): string {
  return base;
}
