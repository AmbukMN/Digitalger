// NEXTAUTH_SECRET-ийг RUNTIME-д л авна (module-level биш). Module-level дээр
// шалгавал Next.js build "collect page data" үед env байхгүй тул throw болж build
// унадаг. Lazy функцээр зөвхөн бодит хүсэлт ирэх үед шалгана.
//
// Hardcoded fallback байхгүй — env заавал. Эс бол урьдчилан мэдэгдэх secret-ээр
// admin токен хуурамчлах эрсдэлтэй.
let cached: Uint8Array | null = null;

export function getAuthSecret(): Uint8Array {
  if (cached) return cached;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET тохируулагдаагүй байна');
  cached = new TextEncoder().encode(secret);
  return cached;
}
