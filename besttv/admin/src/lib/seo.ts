import { SITE_META, currentAdminSite } from './site-store';

/**
 * ⚠️⚠️ СОНГОСОН САЙТЫН БРЭНД.
 *
 * БОДИТ АЛДАА (2026-09-08): энд «BestTV» ХАТУУ бичигдсэн байсан тул
 * BestFilm сонгоод кино нэмэхэд `metaTitle` = «Х (2024) — BestTV дээр
 * онлайнаар үзэх» гэж DB-д хадгалагдаж, bestfilm.net-ийн `<title>`-д
 * гарч Google-д ИНДЕКСЖДЭГ байв — өрсөлдөгч брэндийг өөрийн сайт
 * дээрээ сурталчилсан болно.
 *
 * ⚠️ Автомат бөглөлт нь `useEffect`-ээр (админ гараа хүрэлгүйгээр)
 * ажилладаг тул ЧИМЭЭГҮЙ тохиолддог байв.
 *
 * ⚠️ Backend (`title-seo.helper.ts`) нь `siteConfig().name` ашиглаж
 * АЛЬ ХЭДИЙН зөв байсан — зөвхөн client тал хоцорсон.
 */
function brandName(): string {
  const s = currentAdminSite();
  return s === 'all' ? SITE_META.besttv.label : SITE_META[s].label;
}

/**
 * SEO текст АВТОМАТААР үүсгэх — гарчиг + тайлбараас.
 *
 * ⚠️⚠️ AI ХЭРЭГЛЭХГҮЙ (зориуд). SEO нь тогтсон загвартай, таамаглалгүй
 * байх ёстой: кино бүр ижил хэв маягтай, "BestTV дээр онлайнаар үзэх"
 * гэсэн брэндийн түлхүүр үгтэй. AI-аар бичүүлбэл кино бүр өөр өнгө
 * аястай болж, түлхүүр үг ч алдагдана.
 *
 * ⚠️⚠️ Backend талын `TmdbService.autoSeo()`-той ИЖИЛ логик байх ЁСТОЙ —
 * эс бөгөөс админаар хадгалсан кино болон бөөнөөр нөхсөн кино ӨӨР
 * хэв маягтай SEO-той болно. Нэгийг өөрчилвөл НӨГӨӨГ НЬ ч засна.
 */

/**
 * ⚠️ ХЭТ БОГИНО гарчигт SEO үүсгэхгүй.
 *
 * Бодит алдаа: админ "Avatar" бичихээр ЭХНИЙ "a" үсэг дээр автомат
 * асаад "а — BestTV дээр онлайнаар үзэх" гэж бичдэг байв. Админ
 * анзаараагүй бол ТЭР ЧИГЭЭРЭЭ хадгалагдана.
 */
export const SEO_MIN_TITLE_LEN = 3;

/** SEO meta title — 60 тэмдэгтэд багтаана (Google таслахгүй) */
export function autoMetaTitle(title: string, year?: string | number | null): string {
  const base = year ? `${title} (${year})` : title;
  const brand = brandName();
  const full = `${base} — ${brand} дээр онлайнаар үзэх`;
  return full.length <= 60 ? full : `${base} — ${brand}`.slice(0, 60);
}

/** SEO meta description — 150-160 тэмдэгт (хайлтын хэсэгт таслагдахгүй) */
export function autoMetaDescription(title: string, description: string): string {
  const clean = description.replace(/\s+/g, ' ').trim();
  if (clean.length >= 80) {
    return clean.length <= 160 ? clean : `${clean.slice(0, 157).trimEnd()}...`;
  }
  /* ⚠️ Тайлбар богино бол бүтэн өгүүлбэр болгоно */
  const filled = `${clean ? `${clean} ` : ''}${title} киног ${brandName()} дээр өндөр чанартай, зар сурталчилгаагүй үзээрэй.`;
  return filled.length <= 160 ? filled : `${filled.slice(0, 157).trimEnd()}...`;
}
