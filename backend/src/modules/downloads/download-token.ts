import { createHmac, timingSafeEqual } from 'crypto';

// ─── Татах богино токен (FB/IG browser-т зориулсан redirect линк) ───────────
//
// АСУУДАЛ: Facebook/Instagram линк нээх бүрд URL-д &fbclid=... нэмдэг. Энэ нь
// presigned R2 URL-ийн query-г өөрчилснөөр signature таарахгүй болж
// "SignatureDoesNotMatch" алдаа гаргадаг.
//
// ШИЙДЭЛ: presigned URL-ийг ШУУД биш, манай домэйны богино redirect линкээр
// дамжуулна: /downloads/go/:token. FB fbclid-г энэ линкэд нэмсэн ч хамаагүй —
// backend token-оо задлаад R2 presigned URL-ийг ШИНЭЭР (цэвэр, fbclid-гүй)
// үүсгэж 302 redirect хийнэ. Ингэснээр signature эвдрэхгүй.
//
// Токен формат: base64url(payloadJson).base64url(hmacSig)
// payload = { k: fileKey, n: fileName, e: expiresAtMs }

interface DownloadTokenPayload {
  k: string; // R2 fileKey
  n: string; // татах файлын нэр
  e: number; // дуусах хугацаа (ms)
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** Token sign — fileKey/fileName-ийг secret-ээр HMAC sign хийж богино токен үүсгэнэ. */
export function signDownloadToken(
  secret: string,
  fileKey: string,
  fileName: string,
  ttlMs = 15 * 60 * 1000,
): string {
  const payload: DownloadTokenPayload = { k: fileKey, n: fileName, e: Date.now() + ttlMs };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

/** Token verify — secret-ээр шалгаж, хүчинтэй бол payload буцаана. Эс бол null. */
export function verifyDownloadToken(
  secret: string,
  token: string,
): { fileKey: string; fileName: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;

  const expected = b64url(createHmac('sha256', secret).update(body).digest());
  // timing-safe харьцуулалт (урт ялгаатай бол шууд false)
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const payload = JSON.parse(b64urlDecode(body).toString()) as DownloadTokenPayload;
    if (!payload.k || typeof payload.e !== 'number') return null;
    if (Date.now() > payload.e) return null; // хугацаа дууссан
    return { fileKey: payload.k, fileName: payload.n };
  } catch {
    return null;
  }
}
