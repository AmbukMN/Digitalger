import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * OG (opengraph-image) зурагт ашиглах font / лого ачаалагч.
 *
 * ⚠️ ГОЛ ЗОРИЛГО: next/og (Satori) ImageResponse-ийн анхдагч font нь КИРИЛЛ
 * дэмждэггүй тул монгол текст эвдэрч харагддаг. Энд Roboto font-ийн Латин +
 * Кирилл subset-ийг (woff) ачаалж, ImageResponse({ fonts })-д дамжуулна.
 *
 * - Satori нэг ижил `name`-тэй font-уудыг нэгтгэдэг тул Латин subset (ASCII,
 *   ₮, тоо) + Кирилл subset-ийг ижил "Roboto" нэрээр бүртгэвэл бүх glyph орно.
 * - Бүх weight (400/500/700/900)-ийг ачаална.
 * - ArrayBuffer-ийг module-level cache-д хадгалж давхар уншихаас сэргийлнэ
 *   (нэг build/revalidate цикл доторх олон OG зурагт дахин ашиглагдана).
 * - runtime = 'nodejs' (анхдагч) — readFile ажиллана.
 */

export interface OgFont {
  name: string;
  data: ArrayBuffer | Buffer;
  weight: 400 | 500 | 700 | 900;
  style: 'normal';
}

const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts');

// weight → Roboto subset файлууд (Латин + Кирилл) ба DejaVu fallback файл.
//
// ⚠️ Roboto-ийн fontsource subset-д ₮ (U+20AE) ба ★/☆ (U+2605/2606) glyph БАЙХГҮЙ
// тул эдгээрийг DejaVu Sans (бүрэн Unicode coverage) fallback-аар нөхнө.
// DejaVu-д зөвхөн Regular + Bold байгаа тул 400/500→Regular, 700/900→Bold.
const WEIGHT_FILES: {
  weight: OgFont['weight'];
  latin: string;
  cyrillic: string;
  dejavu: string;
}[] = [
  { weight: 400, latin: 'Roboto-Regular-latin.woff', cyrillic: 'Roboto-Regular.woff', dejavu: 'DejaVuSans.ttf' },
  { weight: 500, latin: 'Roboto-Medium-latin.woff', cyrillic: 'Roboto-Medium.woff', dejavu: 'DejaVuSans.ttf' },
  { weight: 700, latin: 'Roboto-Bold-latin.woff', cyrillic: 'Roboto-Bold.woff', dejavu: 'DejaVuSans-Bold.ttf' },
  { weight: 900, latin: 'Roboto-Black-latin.woff', cyrillic: 'Roboto-Black.woff', dejavu: 'DejaVuSans-Bold.ttf' },
];

/**
 * Бүх opengraph-image файлд ашиглах fontFamily ЧЭЭЖ (chain).
 * Roboto-г ЭХЭНД (гол текст — гоё харагдана), дараа нь DejaVu (₮/★/☆ нөхөнө).
 * fontFamily-д ЯГ энэ утгыг өг: `fontFamily: OG_FONT_FAMILY`.
 */
export const OG_FONT_FAMILY = 'Roboto, DejaVu';

let fontsCache: OgFont[] | null = null;
let fontsPromise: Promise<OgFont[]> | null = null;

async function readFontSafe(file: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(FONTS_DIR, file));
  } catch {
    return null;
  }
}

/**
 * Кирилл + Латин дэмждэг Roboto font-уудыг ачаалж ImageResponse({ fonts })-д
 * тохирох массив буцаана. Үр дүн cache-лагдана.
 */
export async function loadOgFonts(): Promise<OgFont[]> {
  if (fontsCache) return fontsCache;
  if (fontsPromise) return fontsPromise;

  fontsPromise = (async () => {
    const fonts: OgFont[] = [];

    for (const { weight, latin, cyrillic, dejavu } of WEIGHT_FILES) {
      const [latinBuf, cyrillicBuf, dejavuBuf] = await Promise.all([
        readFontSafe(latin),
        readFontSafe(cyrillic),
        readFontSafe(dejavu),
      ]);
      // 1) "Roboto" нэрээр Латин (тоо/ASCII) + Кирилл subset-ийг бүртгэнэ.
      //    Satori ижил нэртэй font-уудаас glyph-ийг нөхөж олно.
      if (latinBuf) {
        fonts.push({ name: 'Roboto', data: latinBuf, weight, style: 'normal' });
      }
      if (cyrillicBuf) {
        fonts.push({ name: 'Roboto', data: cyrillicBuf, weight, style: 'normal' });
      }
      // 2) "DejaVu" нэрээр fallback — fontFamily chain-ий 2 дахь нэр.
      //    Roboto-д байхгүй ₮/★/☆ зэрэг glyph-ийг энэ font нөхнө.
      if (dejavuBuf) {
        fonts.push({ name: 'DejaVu', data: dejavuBuf, weight, style: 'normal' });
      }
    }

    fontsCache = fonts;
    return fonts;
  })();

  return fontsPromise;
}

let logoCache: string | null | undefined;

/**
 * Brand лого-г base64 data URL болгож буцаана (OG зурагт <img src> болгон тавина).
 * Navy дэвсгэрт харагдах "DigitalGer color logo"-г цагаан карт дотор ашиглана.
 * Олдохгүй бол null.
 */
export async function loadOgLogo(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache;
  // Боломжит нэрсийг дарааллаар оролдоно (navy текст-тэй өнгөт лого).
  const candidates = ['logo-color.png', 'DigitalGer-color logo.png', 'logo-white.png'];
  for (const file of candidates) {
    try {
      const buf = await readFile(path.join(process.cwd(), 'public', 'brand', file));
      logoCache = `data:image/png;base64,${buf.toString('base64')}`;
      return logoCache;
    } catch {
      // дараагийн нэрийг оролдоно
    }
  }
  logoCache = null;
  return logoCache;
}
