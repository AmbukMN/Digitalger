/**
 * Mongolian Cyrillic ↔ Latin transliteration for search.
 *
 * Strategy:
 *  Latin input  → Cyrillic variants (u→у/ү, o→о/ө) so Mongolian text is found
 *  Cyrillic input → Latin so transliterated slug/text can be found
 *
 * Because Mongolian uses ү (ü) vs у (u) and ө (ö) vs о (o), a user typing
 * plain ASCII "u" or "o" should match both variants.
 */

// ── Latin → Cyrillic ────────────────────────────────────────────────────────

// Multi-char combos (order matters — longer first)
const L2C_MULTI: [RegExp, string][] = [
  [/shch/g, 'щ'],
  [/kh/g,   'х'],
  [/sh/g,   'ш'],
  [/ch/g,   'ч'],
  [/zh/g,   'ж'],
  [/ts/g,   'ц'],
  [/yu/g,   'ю'],
  [/ya/g,   'я'],
  [/yo/g,   'ё'],
  [/ye/g,   'е'],
  // Vowel digraphs before single vowels
  [/ai/g,   'ай'],
  [/ei/g,   'эй'],
  [/oi/g,   'ой'],
  [/ui/g,   'уй'],
  [/uu/g,   'уу'],
  [/oo/g,   'оо'],
  [/aa/g,   'аа'],
  [/ee/g,   'ээ'],
];

// Single-char map — EXCEPT u and o which need special handling
const L2C_SINGLE: [RegExp, string][] = [
  [/a/g, 'а'],
  [/b/g, 'б'],
  [/v/g, 'в'],
  [/g/g, 'г'],
  [/d/g, 'д'],
  [/e/g, 'э'],
  [/z/g, 'з'],
  [/i/g, 'и'],
  [/y/g, 'й'],
  [/k/g, 'к'],
  [/l/g, 'л'],
  [/m/g, 'м'],
  [/n/g, 'н'],
  [/p/g, 'п'],
  [/r/g, 'р'],
  [/s/g, 'с'],
  [/t/g, 'т'],
  [/f/g, 'ф'],
  [/h/g, 'х'],
  [/c/g, 'ц'],
  [/j/g, 'ж'],
  [/q/g, 'к'],
  [/w/g, 'в'],
  [/x/g, 'х'],
  // Extended
  [/ö/g, 'ө'],
  [/ü/g, 'ү'],
];

// ── Cyrillic → Latin ────────────────────────────────────────────────────────

const C2L_PAIRS: [RegExp, string][] = [
  [/щ/g,  'shch'],
  [/ш/g,  'sh'],
  [/ч/g,  'ch'],
  [/ж/g,  'zh'],
  [/ц/g,  'ts'],
  [/х/g,  'kh'],
  [/ю/g,  'yu'],
  [/я/g,  'ya'],
  [/ё/g,  'yo'],
  [/е/g,  'ye'],
  [/ай/g, 'ai'],
  [/эй/g, 'ei'],
  [/ой/g, 'oi'],
  [/уй/g, 'ui'],
  [/уу/g, 'uu'],
  [/оо/g, 'oo'],
  [/аа/g, 'aa'],
  [/ээ/g, 'ee'],
  [/өө/g, 'oo'],
  [/үү/g, 'uu'],
  [/а/g,  'a'],
  [/б/g,  'b'],
  [/в/g,  'v'],
  [/г/g,  'g'],
  [/д/g,  'd'],
  [/з/g,  'z'],
  [/и/g,  'i'],
  [/й/g,  'y'],
  [/к/g,  'k'],
  [/л/g,  'l'],
  [/м/g,  'm'],
  [/н/g,  'n'],
  [/о/g,  'o'],
  [/ө/g,  'o'],
  [/п/g,  'p'],
  [/р/g,  'r'],
  [/с/g,  's'],
  [/т/g,  't'],
  [/у/g,  'u'],
  [/ү/g,  'u'],
  [/ф/g,  'f'],
  [/э/g,  'e'],
  [/ъ/g,  ''],
  [/ь/g,  ''],
];

const CYR_RE = /[Ѐ-ӿ]/;
const LAT_RE = /[a-z]/i;

export function isCyrillic(s: string): boolean {
  return CYR_RE.test(s);
}

export function isLatin(s: string): boolean {
  return LAT_RE.test(s) && !CYR_RE.test(s);
}

/** Cyrillic Mongolian → Latin galig */
export function cyrToLatin(input: string): string {
  let s = input.toLowerCase();
  for (const [re, lat] of C2L_PAIRS) {
    s = s.replace(re, lat);
  }
  return s;
}

/**
 * Latin → all Cyrillic variant expansions.
 *
 * Since plain 'u' can be either у or ү, and 'o' can be о or ө,
 * we generate all combinations so every variant is searched.
 * Returns an array of Cyrillic strings (deduplicated).
 */
export function latinToCyrVariants(input: string): string[] {
  let s = input.toLowerCase();

  // Apply multi-char replacements first
  for (const [re, cyr] of L2C_MULTI) {
    s = s.replace(re, cyr);
  }
  // Apply all single-char replacements except u and o
  for (const [re, cyr] of L2C_SINGLE) {
    s = s.replace(re, cyr);
  }

  // Now expand remaining ASCII 'u' → у/ү and 'o' → о/ө variants
  const variants = new Set<string>();
  const expand = (current: string): void => {
    const uIdx = current.indexOf('u');
    const oIdx = current.indexOf('o');
    const first = uIdx === -1 ? oIdx : oIdx === -1 ? uIdx : Math.min(uIdx, oIdx);
    if (first === -1) {
      variants.add(current);
      return;
    }
    const ch = current[first];
    const [a, b] = ch === 'u' ? ['у', 'ү'] : ['о', 'ө'];
    expand(current.slice(0, first) + a + current.slice(first + 1));
    expand(current.slice(0, first) + b + current.slice(first + 1));
  };
  expand(s);

  return [...variants];
}

/**
 * Build an array of search terms from a raw query.
 * Returns original + all cross-script transliterations.
 */
export function expandQuery(raw: string): string[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];

  const terms = new Set<string>([q]);

  if (isLatin(q)) {
    for (const v of latinToCyrVariants(q)) {
      terms.add(v);
    }
  } else if (isCyrillic(q)) {
    const lat = cyrToLatin(q);
    if (lat !== q) terms.add(lat);
  }

  return [...terms];
}
