/**
 * Монгол хайлтын текст боловсруулалт — stop word, үндэс салгах (stem).
 *
 * ⚠️ DigitalGer-ийн сургамж: тэнд энэ логик ЗӨВХӨН AI чатботод хэрэглэгдэж,
 * сайтын үндсэн хайлт нь зүгээр `contains` + `createdAt desc` байсан.
 * BestTV-д ҮНДСЭН хайлтад нь хэрэглэнэ.
 */

/**
 * Хайлтад утгагүй түгээмэл үгс — эдгээр л үлдвэл хайлт хийхгүй.
 * ("сайн уу", "кино байна уу" гэх мэт мэндчилгээ бүх контентыг буцаахаас сэргийлнэ)
 */
const STOP_WORDS = new Set([
  // Мэндчилгээ / нийтлэг
  'сайн', 'уу', 'юу', 'байна', 'байгаа', 'вэ', 'бэ', 'ве', 'бол', 'гэж', 'гэсэн',
  'би', 'та', 'тэр', 'энэ', 'ямар', 'аль', 'хэн', 'юм', 'зүйл', 'баярлалаа',
  'болно', 'болох', 'хэрэг', 'хэрэгтэй', 'надад', 'танд', 'ний', 'нь', 'ч',
  'мөн', 'бас', 'эсвэл', 'болон', 'ба', 'тухай', 'дээр', 'доор', 'дотор',
  'хамгийн', 'их', 'бага', 'сайхан', 'гоё', 'үзэх', 'үзмээр', 'олох', 'хайх',
  'санал', 'болго', 'болгооч', 'өгөөч', 'үзье', 'үзнэ',
  // Домэйн — өөрөө ялгах утгагүй
  'кино', 'цуврал', 'анги', 'фильм', 'video', 'видео',
  // Латин
  'sain', 'uu', 'baina', 'bol', 'ene', 'ter', 'bi', 'ta', 'yum',
  'movie', 'film', 'series', 'the', 'and', 'or', 'a', 'an', 'is', 'are',
  'what', 'which', 'who', 'show', 'watch', 'find', 'search',
]);

/**
 * Монгол нөхцөл (үүсгэвэр) — үндэс салгахад.
 * ⚠️ УРТ нь ЭХЭНД байх ёстой (эс бөгөөс "-ийн" нь "-н" болж таслагдана).
 */
const MN_SUFFIXES = [
  'уудынхаа', 'үүдийнхээ', 'уудаасаа', 'үүдээсээ',
  'ийнхээ', 'ынхаа', 'уудын', 'үүдийн', 'уудад', 'үүдэд', 'уудаас', 'үүдээс',
  'чуудын', 'чуудад', 'нуудын', 'нүүдийн',
  'ууд', 'үүд', 'нууд', 'нүүд', 'чууд', 'чүүд',
  'ийнх', 'ыных', 'иймээ', 'ыгаа', 'ийгээ',
  'аасаа', 'ээсээ', 'оосоо', 'өөсөө',
  'тайгаа', 'тэйгээ', 'той', 'тэй', 'той',
  'ийн', 'ын', 'иин',
  'аас', 'ээс', 'оос', 'өөс',
  'даа', 'дээ', 'доо', 'дөө', 'таа', 'тээ', 'тоо', 'төө',
  'луу', 'лүү', 'руу', 'рүү',
  'ийг', 'ыг',
  'над', 'над',
  'ад', 'эд', 'од', 'өд',
  'ыг', 'иг', 'уг', 'үг',
  'аа', 'ээ', 'оо', 'өө',
  'ий', 'ы', 'ий',
  'д', 'т', 'г', 'н', 'с',
];

/** Түгээмэл (утга багатай) — оноо бага өгнө, гэхдээ хасахгүй */
const COMMON_WORDS = new Set([
  'шинэ', 'хуучин', 'том', 'жижиг', 'сайн', 'муу', 'хөгжилтэй', 'инээдтэй',
  'new', 'old', 'best', 'top', 'good',
]);

export function isStopWord(w: string): boolean {
  return STOP_WORDS.has(w.toLowerCase());
}

export function isCommonWord(w: string): boolean {
  return COMMON_WORDS.has(w.toLowerCase());
}

/**
 * Монгол үгийн үндэс — нэг л нөхцөл хасна, үндэс ≥3 үсэг үлдэнэ.
 * "монголын" → "монгол", "кинонууд" → "кино"
 */
export function mnStem(word: string): string {
  const w = word.toLowerCase();
  for (const suf of MN_SUFFIXES) {
    if (w.length - suf.length >= 3 && w.endsWith(suf)) {
      return w.slice(0, w.length - suf.length);
    }
  }
  return w;
}

export interface ParsedQuery {
  /** Утгатай гол үгс (stop word хасагдсан) */
  keywords: string[];
  /** Түгээмэл үгс — оноо бага */
  common: string[];
  /** Бүх үг (анхны хэлбэрээр) */
  raw: string[];
  /** Хайлт хийх боломжтой эсэх (гол үг үлдсэн эсэх) */
  usable: boolean;
}

/**
 * Хайлтын мөрийг задлан шинжлэх.
 *
 * ⚠️ Тоо↔үсэг салгана ("2024он" → "2024 он"), stop word хасна.
 * Бүх үг stop word бол `usable: false` — хайлт хийхгүй (мэндчилгээ).
 */
export function parseQuery(raw: string): ParsedQuery {
  const normalized = (raw ?? '')
    .toLowerCase()
    .replace(/[+]/g, ' ')
    .replace(/(\d)(\p{L})/gu, '$1 $2')
    .replace(/(\p{L})(\d)/gu, '$1 $2')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim();

  const words = normalized.split(/\s+/).filter((w) => w.length >= 2);
  const keywords: string[] = [];
  const common: string[] = [];

  for (const w of words) {
    if (isStopWord(w)) continue;
    if (isCommonWord(w)) common.push(w);
    else keywords.push(w);
  }

  return {
    keywords,
    common,
    raw: words,
    // Гол үг байхгүй ч түгээмэл үг байвал түүгээр хайж болно
    usable: keywords.length > 0 || common.length > 0,
  };
}

/**
 * ⚠️⚠️ БОГИНО ҮГ — санамсаргүй таарлын ГОЛ эх үүсвэр.
 *
 * БОДИТ АЛДАА: «Үл таних» гэж хайхад «Замд дайгдсан охин» гардаг байв.
 * Шалтгаан: «үл» → галиг «ul» → тайлбар дотор «ул» гэсэн ҮСГИЙН
 * ДАРААЛАЛ («булан», «сургууль», «хулгай» гэх мэт үгийн ДУНД) таарна.
 * Богино үг хэдий чинээ богино, төдий чинээ олон үгэнд «нуугдана».
 *
 * Тиймээс 3 үсгээс богино үгийг ЗӨВХӨН гарчиг/slug-д, тэр ч бүү хэл
 * ҮГИЙН ХИЛээр л хайна — тайлбар, жүжигчин зэрэгт ОГТ хайхгүй.
 */
export const SHORT_WORD_MAX = 3;

export function isShortWord(w: string): boolean {
  return w.length <= SHORT_WORD_MAX;
}

/** Regex-д тусгай тэмдэгтийг мултлана — хэрэглэгчийн оролт шууд орно */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ҮГИЙН ХИЛЭЭР таарч байгаа эсэх — «үл» нь «дүлий» дотор таарахгүй.
 *
 * ⚠️ JS-ийн `` нь кирилл үсэгт НАЙДВАРГҮЙ (ASCII-д зориулагдсан).
 * Тиймээс үсэг/тоо БИШ тэмдэгтээр өөрсдөө хүрээлүүлнэ.
 */
export function matchesWholeWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const re = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRe(needle)}([^\\p{L}\\p{N}]|$)`,
    'iu',
  );
  return re.test(haystack);
}

/**
 * ҮГИЙН ЭХЛЭЛД таарч байгаа эсэх — «таних» нь «Танихгүй»-д таарна,
 * гэхдээ «мэдэхгүй»-д таарахгүй.
 *
 * ⚠️ Бүтэн үгийн таарлаас СУЛ, дэд мөрийн таарлаас ХҮЧТЭЙ. Монгол
 * хэл нөхцөлтэй тул («охин» → «охины») энэ түвшин ЗААВАЛ хэрэгтэй.
 */
export function matchesWordStart(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(needle)}`, 'iu');
  return re.test(haystack);
}
