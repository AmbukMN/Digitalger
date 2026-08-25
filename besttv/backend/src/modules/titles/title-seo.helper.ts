/**
 * КИНОНЫ SEO — `metaTitle` / `metaDescription` АВТОМАТААР.
 *
 * ⚠️⚠️ ЯАГААД BACKEND ДЭЭР ХЭРЭГТЭЙ ВЭ:
 *
 * Энэ логик өмнө нь ЗӨВХӨН админ панелийн CLIENT талд
 * (`admin/src/lib/seo.ts`) байсан — форм бөглөх үед л ажилладаг.
 * Тиймээс API-аар шууд үүсгэсэн кино SEO-ГҮЙ үлддэг байв.
 *
 * БОДИТ АЛДАА (2026-08-25): offline фолдероос API-аар оруулсан кино
 * SEO-гүй үүсч, хэрэглэгч «SEO автоматаар үүсдэг мөртлөө бичигдээгүй
 * байна» гэж мэдээлсэн. Тэр үед 164 киноноос 1 нь SEO-гүй байв.
 *
 * ⚠️ Client талын хувилбарыг УСТГААГҮЙ — админ формд бичиж байхад
 *    урьдчилан харуулах (preview) хэрэгтэй. Гэхдээ ЭНД байгаа нь
 *    ЭЦСИЙН баталгаа: аль ч замаар (форм, API, TMDB импорт, bulk)
 *    орж ирсэн кино SEO-той болно.
 *
 * ⚠️ Хоёр хувилбарын ДҮРЭМ ИЖИЛ байх ёстой. Нэгийг өөрчилвөл
 *    нөгөөг нь ЗААВАЛ засна (`admin/src/lib/seo.ts`).
 */

/** Google-ийн хайлтын үр дүнд таслагдахгүй дээд урт */
const MAX_TITLE = 60;
const MAX_DESC = 160;
/** Тайлбар нь энэ уртаас богино бол өөрөө хангалтгүй */
const MIN_USABLE_DESC = 80;

/**
 * `«Нэр (Он) — BestTV дээр онлайнаар үзэх»`
 * ⚠️ 60 тэмдэгтэд багтахгүй бол богино хувилбар руу шилжинэ.
 */
export function autoMetaTitle(title: string, year?: number | null): string {
  const base = year ? `${title} (${year})` : title;
  const full = `${base} — BestTV дээр онлайнаар үзэх`;
  return full.length <= MAX_TITLE ? full : `${base} — BestTV`.slice(0, MAX_TITLE);
}

/**
 * Тайлбар хангалттай урт бол түүнийг, эс бөгөөс бүтэн өгүүлбэр болгоно.
 */
export function autoMetaDescription(title: string, description?: string | null): string {
  const clean = (description ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length >= MIN_USABLE_DESC) {
    return clean.length <= MAX_DESC ? clean : `${clean.slice(0, MAX_DESC - 3).trimEnd()}...`;
  }
  const filled = `${clean ? `${clean} ` : ''}${title} киног BestTV дээр өндөр чанартай, зар сурталчилгаагүй үзээрэй.`;
  return filled.length <= MAX_DESC ? filled : `${filled.slice(0, MAX_DESC - 3).trimEnd()}...`;
}

/**
 * ХООСОН SEO талбарыг нөхнө.
 *
 * ⚠️ Аль хэдийн утгатай талбарыг ХЭЗЭЭ Ч дарж бичихгүй — админ
 *    гараар тохируулсан SEO нь автоматаас ИЛҮҮ үнэ цэнэтэй.
 *
 * @param input   хэрэглэгчийн илгээсэн (эсвэл хадгалагдсан) утгууд
 * @param source  гарчиг/он/тайлбар — эцсийн (шинэчлэгдсэн) утгаараа
 */
export function fillSeo(
  input: { metaTitle?: string | null; metaDescription?: string | null },
  source: { title: string; year?: number | null; description?: string | null },
): { metaTitle: string; metaDescription: string } {
  return {
    metaTitle: input.metaTitle?.trim() || autoMetaTitle(source.title, source.year),
    metaDescription:
      input.metaDescription?.trim() || autoMetaDescription(source.title, source.description),
  };
}
