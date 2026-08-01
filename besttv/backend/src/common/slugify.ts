import { cyrToLatin } from './transliterate';

/**
 * Кирилл нэрээс галиг Латин slug үүсгэнэ.
 * ⚠️ IncheTV-ийн эвдэрхий кирилл slug-ийн сургамж: slug ЗААВАЛ ASCII байна.
 * "Дахин төрсөн Захирал Кан" → "dakhin-torson-zakhiral-kan"
 */
export function slugify(input: string): string {
  const latin = cyrToLatin(input.trim());
  return (
    latin
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'title'
  );
}

/** Давхардвал -2, -3 залгах suffix үүсгэгч */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
