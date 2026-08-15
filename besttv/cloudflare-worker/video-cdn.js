/**
 * BestTV — ВИДЕО SEGMENT CDN Worker.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ (хэмжилтээр батлагдсан асуудал):
 *
 * Одоо segment-үүд R2-ийн S3 endpoint-оос (`*.r2.cloudflarestorage.com`)
 * presigned URL-ээр ирдэг. Тэр endpoint нь CDN БИШ — `cf-cache-status`
 * огт байхгүй, өөрөөр хэлбэл:
 *   • Хэрэглэгч бүр, segment бүр ЭХ bucket руу очно (нэг байршил)
 *   • Хол улсаас (Хятад, АНУ, Европ) RTT өндөр → эхлэх удаан, гацна
 *   • Ижил кино 100 хүн үзвэл ижил segment 100 удаа R2-оос гарна
 *
 * Харьцуулалт (Монголоос хэмжсэн):
 *   CDN кэштэй зураг  →  73ms
 *   Кэшгүй segment    → 256ms   (3.5 дахин удаан)
 *
 * ЭНЭ WORKER юу хийдэг вэ:
 *   1. `/v/<exp>/<sig>/<key>` хэлбэрийн замыг хүлээж авна
 *   2. HMAC гарын үсэг + хугацааг шалгана (эрхгүй хүн үзэхгүй)
 *   3. R2 binding-ээс объектыг уншаад буцаана
 *   4. Cloudflare түүнийг ИРМЭГТ КЭШЛЭНЭ (330+ хот) → дараагийн
 *      хэрэглэгч тухайн хотоос шууд авна
 *
 * ⚠️ АЮУЛГҮЙ БАЙДАЛ presigned URL-тэй ИЖИЛ түвшинд:
 *   • Гарын үсэггүй/хугацаа дууссан зам → 403
 *   • Түлхүүр нь гарын үсэгт багтсан тул өөр файл руу солиж болохгүй
 *   • `movies/` prefix-ээс гадуур хандахыг хориглоно
 *
 * ─────────────── DEPLOY ЗААВАР ───────────────
 * 1) Cloudflare Dashboard → Workers & Pages → Create Worker
 * 2) Энэ файлын агуулгыг буулгана
 * 3) Settings → Variables:
 *      VIDEO_SIGN_SECRET = (backend-ийн ижил утга, доор үзнэ үү)
 * 4) Settings → Bindings → R2 bucket:
 *      Variable name: BUCKET   |   Bucket: buckets
 * 5) Triggers → Custom domain эсвэл Route:
 *      `cdn.besttv.us/*`  (эсвэл `assets.besttv.us/v/*`)
 * ──────────────────────────────────────────────
 */

/**
 * Зөвшөөрөгдсөн prefix — өөр хавтас руу хандахыг хориглоно.
 *
 * ⚠️⚠️ БОДИТ АЛДАА: өмнө нь ЗӨВХӨН `movies/` байсан тул ЦУВРАЛЫН
 * бүх анги (`episodes/`) Worker-ээр огт дамжихгүй, шууд R2 руу
 * үлдсэн. Production дээр `assets.besttv.us/episodes/<uuid>/...`
 * нь токенгүйгээр HTTP 200 буцааж, 20 анги БҮРЭН нээлттэй байв.
 *
 * ⚠️ Шинэ төрлийн контент нэмбэл (trailers/ г.м.) ЭНД ч нэмнэ —
 *    эс бөгөөс тэр нь хамгаалалтгүй үлдэнэ.
 */
const ALLOWED_PREFIXES = ['movies/', 'episodes/', 'trailers/'];

/** ⚠️ Segment нь ХЭЗЭЭ Ч өөрчлөгддөггүй (uuid зам) — урт кэш аюулгүй */
const SEGMENT_CACHE = 'public, max-age=2592000, immutable'; // 30 хоног
/** Playlist нь ч тогтмол ч гэсэн богино — админ дахин хөрвүүлж болзошгүй */
const PLAYLIST_CACHE = 'public, max-age=3600';

const enc = new TextEncoder();

/** HMAC-SHA256 → hex */
async function sign(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * ⚠️ ХУГАЦААНЫ ТОГТМОЛ ХАРЬЦУУЛАЛТ — timing attack-аас сэргийлнэ.
 * Энгийн `===` нь эхний зөрүүтэй байт дээр зогсдог тул гарын үсгийг
 * байт байтаар нь таах боломж онолын хувьд үүсдэг.
 */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);

    /**
     * Зам: /v/<exp>/<sig>/<key...>
     *   exp — Unix секунд (хүчинтэй хугацаа дуусах)
     *   sig — HMAC(secret, `${exp}:${key}`)
     *   key — R2 доторх зам (movies/uuid/v0_seg_001.ts)
     */
    const m = url.pathname.match(/^\/v\/(\d+)\/([a-f0-9]{64})\/(.+)$/);
    if (!m) return new Response('Not found', { status: 404 });

    const [, expStr, sig, rawKey] = m;
    const key = decodeURIComponent(rawKey);

    /**
     * ⚠️ Зам задлахаас хамгаална. Гарын үсэг зөв байсан ч
     * `movies/../.env` гэх мэт замыг хориглоно (secret задарсан
     * тохиолдолд ч bucket-ийн бусад файлд хүрэхгүй).
     */
    if (key.includes('..') || !ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
      return new Response('Forbidden', { status: 403 });
    }

    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
      return new Response('Link expired', { status: 403 });
    }

    const expected = await sign(env.VIDEO_SIGN_SECRET, `${exp}:${key}`);
    if (!safeEqual(expected, sig)) {
      return new Response('Bad signature', { status: 403 });
    }

    /**
     * ⚠️⚠️ КЭШИЙН ТҮЛХҮҮР нь ЗӨВХӨН `key` — гарын үсэг/хугацаа ОРОХГҮЙ.
     *
     * Эс бөгөөс хэрэглэгч бүрд өөр гарын үсэг үүсдэг тул кэш ХЭЗЭЭ Ч
     * оногдохгүй (энэ Worker-ийн бүх утга алдагдана). Гарын үсэг нь
     * ДЭЭР аль хэдийн шалгагдсан — кэш нь зөвхөн хадгалалт.
     */
    const cacheKey = new Request(`${url.origin}/__cache/${key}`, { method: 'GET' });
    const cache = caches.default;

    let res = await cache.match(cacheKey);
    if (res) {
      /* Range хүсэлт (seek) кэшлэгдсэн бүтэн биетэй ажиллана */
      const hit = new Response(res.body, res);
      hit.headers.set('X-BestTV-Cache', 'HIT');
      return hit;
    }

    const obj = await env.BUCKET.get(key);
    if (!obj) return new Response('Not found', { status: 404 });

    const isPlaylist = key.endsWith('.m3u8');
    const headers = new Headers();
    headers.set(
      'Content-Type',
      isPlaylist
        ? 'application/vnd.apple.mpegurl'
        : key.endsWith('.ts')
          ? 'video/mp2t'
          : key.endsWith('.jpg')
            ? 'image/jpeg'
            : 'application/octet-stream',
    );
    headers.set('Cache-Control', isPlaylist ? PLAYLIST_CACHE : SEGMENT_CACHE);
    headers.set('ETag', obj.httpEtag);
    /* ⚠️ CORS — player өөр домэйнээс (besttv.us) татна */
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('X-BestTV-Cache', 'MISS');

    res = new Response(obj.body, { headers });

    /* ⚠️ `waitUntil` — кэшид бичих нь хариу буцаахыг ХОЙШЛУУЛАХГҮЙ */
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  },
};
