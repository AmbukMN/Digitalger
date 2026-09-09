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
 * Кирилл → латин БҮХ боломжит хувилбар (хайлтад).
 *
 * ⚠️⚠️ ЯАГААД ОЛОН ХУВИЛБАР ХЭРЭГТЭЙ ВЭ (бодит алдаа):
 * `cyrToLatin("агент")` нь **"agyent"** буцаадаг — монгол хэлний
 * дүрмээр `е → ye` (елена → yelena) зөв. Гэвч ГАДААД гаралтай үгэнд
 * буруу: хэрэглэгч "агент" гэж хайхад "Agent Kim Reactivated" кино
 * ОЛДДОГГҮЙ байв.
 *
 * Мөн ижил зөрчил: `ё → yo` / `o`, `ю → yu` / `u`, `я → ya` / `a`.
 *
 * Хайлт нь ХЭД Ч ХУВИЛБАРААР шалгаж болно (`OR` нөхцөл) тул
 * хоёуланг нь буцаах нь буруу таарал үүсгэхгүй, харин алдагдсан
 * үр дүнг олно.
 */
export function cyrToLatinVariants(input: string): string[] {
  const base = cyrToLatin(input);
  const out = new Set<string>([base]);

  /* ⚠️ `ye`/`yo`/`yu`/`ya` → `e`/`o`/`u`/`a` — гадаад үгийн хувилбар.
     Зөвхөн ҮГИЙН ЭХЭНД БИШ бүх байрлалд (агент → agyent → agent). */
  const simplified = base
    .replace(/ye/g, 'e')
    .replace(/yo/g, 'o')
    .replace(/yu/g, 'u')
    .replace(/ya/g, 'a');
  if (simplified !== base) out.add(simplified);

  /* ⚠️ `kh` → `h` — "хан" нь "khan" ба "han" хоёулаа бичигддэг */
  const h = base.replace(/kh/g, 'h');
  if (h !== base) out.add(h);

  return [...out];
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

  /**
   * ⚠️⚠️ ХУВИЛБАРЫН ТОО ХАТУУ ХЯЗГААРТАЙ — ЭС БӨГӨӨС DoS.
   *
   * ⛔ БОДИТ ЭМЗЭГ БАЙДАЛ (2026-09-09 аудит, production дээр батлагдсан):
   * `u`/`o` тэмдэгт бүр хувилбарыг ХОЁР ДАХИН нэмэгдүүлдэг —
   * `2^n` экспоненциал өсөлт, хязгаар огт байгаагүй:
   *
   *     24 тэмдэгт →     4,096 хувилбар →   7мс
   *     40 тэмдэгт → 1,048,576 хувилбар → 1.06с
   *     44 тэмдэгт → 4,194,304 хувилбар → 4.8с
   *     48 тэмдэгт → heap OOM (процесс унана)
   *
   * Production тест: `q=bubobubobubobubobubo` (20 тэмдэгт) НЭГ хүсэлт
   * origin-ыг **125 СЕКУНД** түгжсэн. Нэвтрэлт шаардлагагүй.
   *
   * ⚠️ `/titles/search` нь throttle-ыг глобалаас 6 ДАХИН ӨСГӨСӨН
   * (120/сек vs 20/сек) тул rate limit нь хамгаалалт биш, ӨСГӨГЧ.
   *
   * ⚠️ 64 хувилбар нь бодит хайлтад ХАНГАЛТТАЙ: монгол үгэнд 6-аас
   * олон `u`/`o` ховор (`burtguuleh` = 4 → 16 хувилбар).
   *
   * ⚠️ Хязгаарт хүрвэл ЭХНИЙ 64 хувилбарыг буцаана — хайлт ажилласаар,
   * зөвхөн нарийвчлал бага зэрэг буурна.
   */
  const MAX_VARIANTS = 64;
  const variants = new Set<string>();
  const expand = (current: string): void => {
    if (variants.size >= MAX_VARIANTS) return;
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
    /* ⚠️ БҮХ хувилбар — `cyrToLatin` ганцаараа "агент"-ыг "agyent"
       болгож "Agent Kim" киног ОЛДОХГҮЙ болгодог байв */
    for (const v of cyrToLatinVariants(q)) {
      if (v !== q) terms.add(v);
    }
  }

  return [...terms];
}
