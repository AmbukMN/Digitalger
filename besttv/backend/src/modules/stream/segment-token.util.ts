import { createHmac, timingSafeEqual } from 'crypto';

/**
 * СЕГМЕНТИЙН ТОКЕН — HLS сегмент бүрийг манай API-аар дамжуулахад.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ — БОДИТ АЮУЛГҮЙ БАЙДЛЫН НҮХ:
 *
 * Өмнө нь playlist дотор R2-ийн presigned URL ШУУД бичигддэг байсан:
 *   https://buckets.<...>.r2.cloudflarestorage.com/movies/x/v0_seg_000.ts?X-Amz-...
 *
 * Тэр линк нь 4 ЦАГИЙН турш ХЭН Ч, ХААНААС Ч, токенгүйгээр татаж
 * болдог bearer эрх байв. Хэрэглэгч playlist-ыг нэг л удаа аваад
 * `ffmpeg -i playlist.m3u8` эсвэл `yt-dlp` руу өгвөл БҮТЭН кино
 * татагдана — браузергүй, JS-гүй, нэвтрэлтгүй. (Production дээр
 * бодитоор батлагдсан: сегмент HTTP 206 буцааж, өгөгдөл ирсэн.)
 *
 * Одоо: playlist дотор ЗӨВХӨН манай API-ийн зам бичигдэнэ.
 *   /api/stream/seg/<token>
 * Токен нь HMAC-ээр гарын үсэг зурагдсан, БОГИНО хугацаатай, тухайн
 * хэрэглэгчид (эсвэл IP-д) холбогдсон. R2-ийн хаяг браузерт ХЭЗЭЭ Ч
 * харагдахгүй.
 *
 * ⚠️ Энэ нь yt-dlp-г БҮРЭН зогсоохгүй (хэрэглэгч өөрийн токеноороо
 *    татаж болно) — гэхдээ:
 *      • R2 хаяг задрахгүй → шууд bucket руу халдахгүй
 *      • Токен богино хугацаатай → линк хуваалцаж болохгүй
 *      • Хэрэглэгчид холбогдсон → хэн татсаныг МЭДНЭ, хориглож болно
 *      • Extension/downloader-ууд ихэнхдээ энгийн m3u8-ыг л барьдаг
 *    Бүрэн хамгаалалт нь зөвхөн DRM (Widevine) — тэр нь өөр өртөгтэй.
 */

/** Токены хүчинтэй хугацаа (сек) — segment 6с тул богино байж болно */
export const SEG_TOKEN_TTL = 300;

interface SegPayload {
  /** R2 дахь бодит key */
  k: string;
  /** Дуусах хугацаа (unix сек) */
  e: number;
  /** Хэрэглэгчийн id — хэн татсаныг мөрдөх (зочин бол хоосон) */
  u?: string;
}

/**
 * ⚠️ base64url — `+/=` тэмдэгт URL-д асуудал үүсгэдэг тул сольсон.
 * Node 16+ `base64url` дэмждэг ч гар аргаар бичсэн нь тодорхой.
 */
function b64u(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(s: string): Buffer {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

/**
 * Токен үүсгэнэ.
 *
 * ⚠️ `secret` нь ЗААВАЛ орчны хувьсагчаас — эс бөгөөс хэн ч токен
 *    хуурамчаар үүсгэж, дурын R2 файл татаж чадна.
 */
export function signSegment(
  payload: { key: string; userId?: string; ttl?: number },
  secret: string,
): string {
  const body: SegPayload = {
    k: payload.key,
    e: Math.floor(Date.now() / 1000) + (payload.ttl ?? SEG_TOKEN_TTL),
    ...(payload.userId ? { u: payload.userId } : {}),
  };
  const data = b64u(Buffer.from(JSON.stringify(body), 'utf8'));
  const sig = b64u(createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}

/**
 * Токен шалгаад R2 key буцаана. Буруу/хугацаа дууссан бол `null`.
 *
 * ⚠️ `timingSafeEqual` — энгийн `===` нь тэмдэгт тэмдэгтээр
 *    харьцуулдаг тул хариу ирэх ХУГАЦААГААР гарын үсгийг таах
 *    (timing attack) боломжтой болдог.
 */
export function verifySegment(
  token: string,
  secret: string,
): { key: string; userId?: string } | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;

  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = b64u(createHmac('sha256', secret).update(data).digest());
  /* ⚠️ Урт өөр бол timingSafeEqual шидэнэ — эхлээд шалгана */
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  let body: SegPayload;
  try {
    body = JSON.parse(unb64u(data).toString('utf8')) as SegPayload;
  } catch {
    return null;
  }

  if (!body.k || typeof body.e !== 'number') return null;
  if (body.e < Math.floor(Date.now() / 1000)) return null;

  /**
   * ⚠️ ЗАМ ЗАДЛАХААС хамгаална — токен хуурамчаар үүсгэсэн ч
   *    (secret задарсан гэж үзвэл) bucket-ийн бусад файл руу
   *    хүрэхгүй. HLS сегмент нь ҮРГЭЛЖ movies/ дотор.
   */
  if (!/^movies\/[A-Za-z0-9_\-/.]+$/.test(body.k) || body.k.includes('..')) return null;

  return { key: body.k, userId: body.u };
}
