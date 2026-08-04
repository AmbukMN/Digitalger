// BestTV API клиент — JWT auth + автомат refresh.
// Токен localStorage-д: btv_access / btv_refresh.

const API_BASE = '/api';

let refreshPromise: Promise<'ok' | 'invalid' | 'network'> | null = null;

/**
 * ⚠️⚠️ LOCALSTORAGE УНАЖ БОЛНО — ЗААВАЛ ХАМГААЛНА.
 *
 * `localStorage` нь дараах тохиолдолд ШИДДЭГ (throw), буцаадаггүй:
 *   - Chrome site settings-д тухайн сайтын cookie/site data ХОРИГЛОСОН
 *   - Хадгалах багтаамж дүүрсэн (QuotaExceededError)
 *   - Зарим browser-ийн хатуу privacy горим
 *
 * Production-д нэг хэрэглэгч ГАНЦ Chrome profile дээрээ нэвтэрч чаддаггүй
 * байв (incognito ✅, гар утас ✅). Хамгаалалтгүй `setItem` шидэхэд
 * `setTokens` бүхэлдээ унаж, токен ХАДГАЛАГДАХГҮЙ үлддэг:
 *     refresh 201 → me 401 → refresh 201 → me 401 … (production лог)
 * Хэрэглэгч "Нэвтрэх" товч хараад л үлдэнэ, шалтгаан нь хаана ч гарахгүй.
 *
 * Одоо localStorage унавал САНАХ ОЙН нөөц рүү шилжинэ — тухайн таб дээр
 * нэвтрэлт бүрэн ажиллана (шинэ таб нээхэд л дахин нэвтэрнэ).
 */
const memStore = new Map<string, string>();

function lsGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key) ?? memStore.get(key) ?? null;
  } catch {
    return memStore.get(key) ?? null;
  }
}

function lsSet(key: string, value: string) {
  memStore.set(key, value); // ⚠️ ҮРГЭЛЖ санах ойд — localStorage унасан ч ажиллана
  try {
    localStorage.setItem(key, value);
  } catch {
    /* хориглосон/дүүрсэн — санах ойн хуулбар хангалттай */
  }
}

function lsRemove(key: string) {
  memStore.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* алгасна */
  }
}

export function getAccessToken(): string | null {
  return lsGet('btv_access');
}

export function setTokens(access: string, refresh: string) {
  lsSet('btv_access', access);
  lsSet('btv_refresh', refresh);
}

export function clearTokens() {
  lsRemove('btv_access');
  lsRemove('btv_refresh');
}

// ⚠️ Зочны нэвтрэлт (guest) БҮРМӨСӨН ХАСАГДСАН — зөвхөн имэйл/Google/Facebook.

export function getRefreshToken(): string | null {
  return lsGet('btv_refresh');
}

/**
 * Refresh оролдлого.
 * ⚠️ Буцаах утга: 'ok' | 'invalid' | 'network'
 * 'network' (сүлжээ тасарсан, сервер унтарсан) үед токеныг ЦЭВЭРЛЭХГҮЙ —
 * эс бөгөөс түр саатлаас болж хэрэглэгч шалтгаангүй гарч, дахин нэвтрэх
 * шаардлагатай болно. Зөвхөн сервер "хүчингүй" гэж хэлсэн үед л гаргана.
 */
/**
 * Өгөгдсөн refreshToken-оор backend-ээс шинэ токен авна (localStorage-д
 * бичихгүй — дуудагч өөрөө шийднэ).
 *
 * ⚠️ Экспортолсон шалтгаан: OAuth sync үед localStorage аль хэдийн
 * цэвэрлэгдсэн байж болох тул NextAuth session-ээс ирсэн refreshToken-г
 * ШУУД дамжуулах шаардлагатай (`tryRefresh` нь localStorage-оос уншдаг).
 */
export async function refreshWithToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.accessToken
      ? { accessToken: data.accessToken, refreshToken: data.refreshToken ?? refreshToken }
      : null;
  } catch {
    return null;
  }
}

/** localStorage дахь refreshToken-оор шинэ access token авч, тэндээ хадгална. */
export async function tryRefresh(): Promise<'ok' | 'invalid' | 'network'> {
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

export async function api<T = unknown>(
  path: string,
  options: RequestInit & {
    auth?: boolean;
    /**
     * ⚠️ Токеныг ШУУД өгөх (localStorage-оос уншихгүй).
     *
     * OAuth sync-д зайлшгүй: `setTokens` бичих ба энэ функц унших хооронд
     * өөр sync зэрэг ажиллаж localStorage-ыг дарж бичих УРАЛДААН гардаг.
     * Production console-д яг ийм: refresh 201 "таарсан: тийм" → me 401.
     */
    token?: string;
  } = {},
): Promise<T> {
  const { auth = true, token: forcedToken, ...init } = options;

  const doFetch = () => {
    const token = auth ? (forcedToken ?? getAccessToken()) : null;
    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.body && !(init.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...init.headers,
        /**
         * ⚠️⚠️ `Authorization` нь `init.headers`-ийн ДАРАА байх ЁСТОЙ.
         *
         * Өмнө нь ӨМНӨ нь байсан тул `init.headers` дотор хуучин
         * `Authorization` байвал ШИНЭ токеныг ДАРЖ БИЧДЭГ байв.
         * Production-д яг ийм: console "шинэ токен явуулж байна" гэж
         * бичсэн ч сервер 9 ЦАГИЙН ӨМНӨХ токен хүлээж авсан
         * (`TokenExpiredError: jwt expired`, `үлдсэн=-32530с`).
         */
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  let res = await doFetch();

  // 401 → refresh нэг удаа (олон зэрэг хүсэлт нэг refresh хуваалцана).
  // ⚠️ access байхгүй ч refresh байвал оролдоно — хэрэглэгч удаан эзгүй байгаад
  // буцаж ирэхэд (access 15 мин, refresh 30 хоног) дахин нэвтрэх шаардлагагүй.
  if (res.status === 401 && auth && (getAccessToken() || getRefreshToken())) {
    refreshPromise ??= tryRefresh().finally(() => (refreshPromise = null));
    const result = await refreshPromise;
    if (result === 'ok') {
      res = await doFetch();
      /**
       * ⚠️⚠️ REFRESH АМЖИЛТТАЙ БОЛСОН ЧЬ 401 ХЭВЭЭР → ТОКЕН ЦЭВЭРЛЭНЭ.
       *
       * Production nginx логт яг ийм гогцоо тэмдэглэгдсэн:
       *   POST /auth/refresh → 201 (24 удаа)
       *   GET  /auth/me      → 401 (34 удаа)
       * Refresh шинэ токен өгсөөр байхад тэр токен ажиллахгүй — өөрөөр
       * хэлбэл localStorage дахь өгөгдөл ЭВДЭРСЭН (өөр орчны/хуучин
       * хэрэглэгчийн үлдэгдэл). Цэвэрлэхгүй бол хэрэглэгч мөнхөд гацна:
       * "Нэвтрэх" товч харагдсаар, оролдох бүрт 401.
       */
      if (res.status === 401) clearTokens();
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

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
