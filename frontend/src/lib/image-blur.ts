/**
 * Зургийн blur placeholder — next/image-д ашиглах ерөнхий (тогтмол) blurDataURL.
 *
 * R2/Cloudflare remote зурагт SSR-д бодит blurDataURL (зураг тус бүрийн hash)
 * динамик үүсгэх боломжгүй тул бүх зурагт ЕРӨНХИЙ цайвар саарал/brand өнгөт
 * жижиг SVG placeholder ашиглана. Энэ нь зураг ачаалахаас өмнө хоосон/CLS-ийг
 * багасгаж, зөөлөн blur fade-in өгнө.
 *
 * Хэрэглээ:
 *   <Image ... placeholder="blur" blurDataURL={BLUR_DATA_URL} />
 *
 * ⚠️ priority зурагт нэмж болно (хор хөнөөлгүй), жижиг icon/avatar-д заавал биш.
 */

// 8x8 цайвар саарал → brand navy (#022179) руу налуу gradient SVG.
// Тод биш, маш зөөлөн — контент зураг ачаалахад жигд шилжинэ.
const BLUR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#eef1f6"/><stop offset="100%" stop-color="#dfe4ec"/></linearGradient></defs><rect width="8" height="8" fill="url(#g)"/></svg>`;

// Base64 болгож data URI болгоно (SSR + client дээр ижил, тогтмол).
const toBase64 = (str: string): string =>
  typeof window === 'undefined'
    ? Buffer.from(str).toString('base64')
    : window.btoa(str);

export const BLUR_DATA_URL = `data:image/svg+xml;base64,${toBase64(BLUR_SVG)}`;
