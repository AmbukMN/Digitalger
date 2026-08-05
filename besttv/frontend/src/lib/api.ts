// BestTV API клиент — JWT auth + автомат refresh.
// Токен localStorage-д: btv_access / btv_refresh.

const API_BASE = '/api';

let refreshPromise: Promise<'ok' | 'invalid' | 'network'> | null = null;

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('btv_access');
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem('btv_access', access);
  localStorage.setItem('btv_refresh', refresh);
}

export function clearTokens() {
  localStorage.removeItem('btv_access');
  localStorage.removeItem('btv_refresh');
}

// ⚠️ Зочны нэвтрэлт (guest) БҮРМӨСӨН ХАСАГДСАН — зөвхөн имэйл/Google/Facebook.

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('btv_refresh');
}

/**
 * ⚠️⚠️ CLIENT ТАЛД ТОКЕНЫ ХУГАЦААГ ХЭЗЭЭ Ч БҮҮ ШАЛГА.
 *
 * Энд өмнө нь `isAccessExpired()` байсан — токены `exp`-ыг `Date.now()`-той
 * харьцуулдаг. Гэвч хэрэглэгчийн компьютерийн цаг буруу тохируулагдсан
 * байх нь МАШ ТҮГЭЭМЭЛ. Тэр үед:
 *   - цаг ХОЦРОГДСОН → client "хүчинтэй" гэж үзээд явуулна, сервер
 *     "jwt expired" гэж 401 өгнө → МӨНХИЙН 401 ГОГЦОО
 *   - цаг ТҮРҮҮЛСЭН → хүчинтэй токеныг дэмий refresh хийнэ
 *
 * Хугацааны ШИЙДВЭР 100% СЕРВЕРИЙНХ: токен байвал шууд явуулна, сервер
 * 401 буцаавал л refresh хийнэ. Ингэснээр хэрэглэгчийн цаг ямар ч
 * байсан зөв ажиллана.
 */

/**
 * Refresh оролдлого.
 * ⚠️ Буцаах утга: 'ok' | 'invalid' | 'network'
 * 'network' (сүлжээ тасарсан, сервер унтарсан) үед токеныг ЦЭВЭРЛЭХГҮЙ —
 * эс бөгөөс түр саатлаас болж хэрэглэгч шалтгаангүй гарч, дахин нэвтрэх
 * шаардлагатай болно. Зөвхөн сервер "хүчингүй" гэж хэлсэн үед л гаргана.
 */
async function tryRefresh(): Promise<'ok' | 'invalid' | 'network'> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return 'invalid';
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (res.ok) {
      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      return 'ok';
    }
    // 401/403 = refresh token үнэхээр хүчингүй. 5xx = серверийн түр алдаа.
    return res.status >= 500 ? 'network' : 'invalid';
  } catch {
    return 'network'; // fetch унасан — интернэт тасарсан байх магадлалтай
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, ...init } = options;

  const doFetch = () => {
    const token = auth ? getAccessToken() : null;
    return fetch(`${API_BASE}${path}`, {
      ...init,
      /**
       * ⚠️ AUTH хүсэлтийг browser КЭШЛЭХГҮЙ.
       *
       * Express анхдагчаар ETag тавьдаг тул browser `/auth/me` хариуг
       * кэшлээд `304 Not Modified` авдаг байв (production nginx лог:
       * `auth/me 304`). Тэр үед токен солигдсон ч ХУУЧИН хариу буцаж,
       * нэвтрэлтийн төлөв зөрдөг.
       */
      cache: auth ? 'no-store' : init.cache,
      headers: {
        ...(init.body && !(init.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  };

  /**
   * ⚠️⚠️ REFRESH ЯВЖ БАЙХАД ХҮЛЭЭНЭ — console дүүрэн 401-ийн шалтгаан.
   *
   * Хуудас ачаалахад олон компонент ЗЭРЭГ хүсэлт явуулдаг
   * (`/auth/me`, `/my-list/ids`, `/chat/link-session` ...). Access токен
   * хуучирсан үед тэдгээр БҮГД хуучин токеноор явж, БҮГД 401 буцаадаг —
   * зөвхөн дараа нь refresh эхэлдэг байв. Үр дүнд хэрэглэгчийн console
   * 401-ээр дүүрч, "эвдэрсэн" сэтгэгдэл төрүүлнэ (бодит гомдол).
   *
   * Одоо refresh аль хэдийн явж байвал ЭХЛЭХИЙН ӨМНӨ хүлээнэ — шинэ
   * токеноор ганц удаа явж, 401 огт үүсгэхгүй.
   */
  if (auth && refreshPromise) {
    await refreshPromise.catch(() => null);
  }

  /**
   * Access ОГТ БАЙХГҮЙ ч refresh байвал урьдчилан сэргээнэ.
   * ⚠️ Энэ нь цагаас ХАМААРАХГҮЙ — зөвхөн "байгаа/байхгүй" шалгалт.
   */
  if (auth && !getAccessToken() && getRefreshToken()) {
    refreshPromise ??= tryRefresh().finally(() => (refreshPromise = null));
    const r = await refreshPromise;
    if (r === 'invalid') {
      clearTokens();
      throw new ApiError(401, 'Нэвтрэлт дууссан', 'TOKEN_EXPIRED');
    }
  }

  /**
   * ⚠️⚠️ ХЭРЭГЛЭГЧИЙН ЦАГААС ХАМААРАХГҮЙ — ХУГАЦААГ СЕРВЕР Л ШИЙДНЭ.
   *
   * Токеныг ШУУД явуулна. Сервер 401 буцаавал л refresh хийнэ (доорх
   * блок). Client тал `exp`-ыг `Date.now()`-той харьцуулахгүй тул
   * хэрэглэгчийн цаг буруу байсан ч зөв ажиллана.
   */
  let res = await doFetch();

  // 401 → refresh нэг удаа (олон зэрэг хүсэлт нэг refresh хуваалцана).
  // ⚠️ access байхгүй ч refresh байвал оролдоно — хэрэглэгч удаан эзгүй байгаад
  // буцаж ирэхэд (access 15 мин, refresh 30 хоног) дахин нэвтрэх шаардлагагүй.
  if (res.status === 401 && auth && (getAccessToken() || getRefreshToken())) {
    refreshPromise ??= tryRefresh().finally(() => (refreshPromise = null));
    const result = await refreshPromise;
    if (result === 'ok') {
      res = await doFetch();
    } else if (result === 'invalid') {
      clearTokens(); // сервер хүчингүй гэж баталсан үед л гаргана
    }
    // 'network' → токеныг хэвээр үлдээж, доорх алдаа шидэгдэнэ (дараа дахин оролдоно)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.message ?? 'Алдаа гарлаа', body?.code);
  }
  return res.json();
}
