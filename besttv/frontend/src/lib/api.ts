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
 * Access токен хугацаа нь ДУУССАН эсэх (сүлжээгүй, зөвхөн JWT-г уншина).
 *
 * ⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: хуудас ачаалахад олон компонент ЗЭРЭГ хүсэлт
 * явуулдаг. Access хуучирсан бол тэд БҮГД 401 аваад л дараа нь refresh
 * эхэлдэг байв — хэрэглэгчийн console 401-ээр дүүрдэг гол шалтгаан.
 * Хугацааг УРЬДЧИЛАН мэдэж чадвал refresh-ыг ЭХЭЛЖ хийгээд, дараа нь
 * бүх хүсэлтийг ШИНЭ токеноор явуулна — 401 огт үүсэхгүй.
 *
 * ⚠️ Энэ нь ЗӨВХӨН оновчлол — эрхийн ШИЙДВЭР сервер дээр гардаг.
 * Задлахад алдвал `false` буцааж, хуучин зан төлөв рүү аюулгүй уналаа
 * (401 → refresh) хийнэ.
 */
export function isJwtExpired(token: string): boolean {
  return isAccessExpired(token);
}

function isAccessExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    if (!payload.exp) return false;
    // 10 секундын нөөц — сүлжээний саатал/цагийн бага зөрүүг тооцно
    return Date.now() >= payload.exp * 1000 - 10_000;
  } catch {
    return false;
  }
}

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
   * ⚠️ УРЬДЧИЛСАН REFRESH — 401 үүсгэлгүйгээр токеныг сэргээнэ.
   * Access хуучирсан ба refresh байгаа бол хүсэлт явуулахын ӨМНӨ сэргээнэ.
   * Олон зэрэг хүсэлт нэг `refreshPromise`-ыг хуваалцана.
   */
  if (auth) {
    const token = getAccessToken();
    const stale = !token || isAccessExpired(token);

    if (stale) {
      if (getRefreshToken()) {
        // Refresh боломжтой — сэргээнэ (олон зэрэг хүсэлт нэгийг хуваалцана)
        refreshPromise ??= tryRefresh().finally(() => (refreshPromise = null));
        const r = await refreshPromise;
        if (r === 'invalid') {
          clearTokens();
          throw new ApiError(401, 'Нэвтрэлт дууссан', 'TOKEN_EXPIRED');
        }
        // 'network' үед токен ХЭВЭЭР — доор хуучин токеноор оролдоно
        // (сервер сэргэвэл ажиллана, түр саатлаас болж гаргахгүй)
      } else {
        /**
         * ⚠️⚠️ ХУУЧИРСАН ТОКЕНООР ХҮСЭЛТ ОГТ БҮҮ ЯВУУЛ.
         *
         * Refresh token АЛГА бөгөөд access хуучирсан бол сервер рүү
         * явуулах нь 100% 401 буцаана — үр дүнгүй, зөвхөн хэрэглэгчийн
         * console-ыг дүүргэнэ.
         *
         * Production дээр хэрэглэгчийн дүр зургийг ЯГ давтан гаргав:
         *   auth/me=401, auth/me=401, my-list/ids=401, chat/link-session=401
         * — refresh алга + access хуучирсан үед 4 хүсэлт ЗЭРЭГ явж бүгд
         * унасан. Одоо 0 болсон.
         *
         * ⚠️ Зөвхөн энэ тохиолдолд эрт гарна. Refresh БАЙГАА үед хэзээ ч
         * эрт гарахгүй — эс бөгөөс хүчинтэй refresh-тэй хэрэглэгч
         * шалтгаангүй гарна (регресс тестээр илэрсэн).
         */
        clearTokens();
        throw new ApiError(401, 'Нэвтрэлт дууссан', 'TOKEN_EXPIRED');
      }
    }
  }

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

