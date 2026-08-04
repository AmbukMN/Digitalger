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

/**
 * ⚠️⚠️ ТОКЕНЫГ COOKIE-Д Ч БИЧНЭ — ЗӨВХӨН HEADER-Д НАЙДАЖ БОЛОХГҮЙ.
 *
 * Production-д нэг хэрэглэгч ГАНЦ Chrome profile дээрээ нэвтэрч чаддаггүй
 * байв (incognito-д БОЛОН гар утсан дээр асуудалгүй — хэрэглэгч баталсан).
 * Ганц ялгаа нь EXTENSION: зарим өргөтгөл `fetch`/`XHR`-ыг залгаж
 * `Authorization` header-ыг арилгадаг → бүх хүсэлт 401 → "Нэвтрэх" товч
 * буцаж гарна. Ямар ч код засвар тус болохгүй байв.
 *
 * Cookie-г browser ӨӨРӨӨ явуулдаг тул JS давхаргад залгагдахгүй.
 * Backend `jwt.strategy.ts` нь header → cookie гэсэн дарааллаар уншина.
 *
 * ⚠️ `SameSite=Lax` — CSRF-ээс хамгаална (гуравдагч сайтаас POST явуулахад
 *    cookie ЯВАХГҮЙ). GET навигацид явдаг тул нэвтрэлт тасрахгүй.
 */
function writeTokenCookie(access: string | null) {
  if (typeof document === 'undefined') return;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  if (access) {
    // 15 минут — access token-ийн настай ижил
    document.cookie = `btv_token=${access}; path=/; max-age=900; SameSite=Lax${secure}`;
  } else {
    document.cookie = `btv_token=; path=/; max-age=0; SameSite=Lax${secure}`;
  }
}

export function setTokens(access: string, refresh: string) {
  lsSet('btv_access', access);
  lsSet('btv_refresh', refresh);
  writeTokenCookie(access);
}

export function clearTokens() {
  lsRemove('btv_access');
  lsRemove('btv_refresh');
  writeTokenCookie(null);
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
      // ⚠️ ТҮР ОНОШИЛГОО — refresh 201 өгсөн токен ХАДГАЛАГДСАН эсэх
      const saved = getAccessToken();
      console.log('[api] refresh 201 →', {
        авсан: data.accessToken ? `${String(data.accessToken).slice(0, 12)}…` : 'ХООСОН',
        хадгалсан: saved ? `${saved.slice(0, 12)}…` : 'ХАДГАЛАГДААГҮЙ!',
        таарсан: saved === data.accessToken ? 'тийм' : '❌ ЗӨРСӨН',
      });
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
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, ...init } = options;

  const doFetch = () => {
    const token = auth ? getAccessToken() : null;
    /**
     * ⚠️ ТҮР ОНОШИЛГОО — `/auth/me` 401 болох ЯГ шалтгааныг console-д гаргана.
     * Нэг хэрэглэгчийн browser дээр л нэвтрэлт унаж байгаа ч (incognito,
     * гар утас, Playwright бүгд ✅) шалтгаан нь ХААНА Ч ХАРАГДАХГҮЙ байв.
     * Асуудал шийдэгдмэгц ЭНЭ БЛОКЫГ ХАСНА.
     */
    if (path === '/auth/me') {
      let exp = 'задрахгүй';
      if (token) {
        try {
          const p = JSON.parse(
            atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
          ) as { exp?: number; sub?: string };
          exp = `${p.sub?.slice(0, 8)} дуусах=${new Date((p.exp ?? 0) * 1000).toLocaleTimeString()}${(p.exp ?? 0) * 1000 < Date.now() ? ' ДУУССАН!' : ''}`;
        } catch {
          exp = 'ЭВДЭРСЭН';
        }
      }
      console.log('[api] /auth/me →', {
        token: token ? `${token.slice(0, 12)}… (${token.length})` : 'АЛГА',
        payload: exp,
        cookie: document.cookie.includes('btv_token') ? 'бий' : 'алга',
        refresh: getRefreshToken() ? 'бий' : 'алга',
      });
    }
    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.body && !(init.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  };

  let res = await doFetch();
  if (path === '/auth/me' && res.status === 401) {
    console.warn('[api] /auth/me 401 — дээрх токеныг сервер ТАТГАЛЗСАН');
  }

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
