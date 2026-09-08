import { currentAdminSite } from './site-store';

const API_BASE = '/api';

/**
 * ⚠️ Эдгээр зам нь САЙТААС ҮЛ ХАМААРНА — `X-Site` илгээхгүй.
 *
 * Нэвтрэх мөчид хэрэглэгч аль сайтынх нь мэдэгдэхгүй тул сайтын
 * толгой илгээвэл буруу сайтад хайж «нууц үг буруу» гэнэ.
 */
const AUTH_FREE_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

let refreshPromise: Promise<boolean> | null = null;

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('btv_admin_access');
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem('btv_admin_access', access);
  localStorage.setItem('btv_admin_refresh', refresh);
}

export function clearTokens() {
  localStorage.removeItem('btv_admin_access');
  localStorage.removeItem('btv_admin_refresh');
}

/**
 * ⚠️ ЭКСПОРТ — upload.ts-д ч хэрэгтэй. Access token 15 минутын настай тул
 * том файл байршуулж эхлэхэд хүчинтэй байсан ч дунд нь дуусаж 401 өгдөг
 * байв (`api()`-д refresh байсан ч XHR upload түүнийг ашигладаггүй).
 */
export async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem('btv_admin_refresh');
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
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
      headers: {
        ...(init.body && !(init.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        /**
         * ⚠️⚠️ САЙТЫН СОНГОЛТ — БҮХ дуудлагад автоматаар.
         *
         * Backend-ийн `SiteMiddleware` үүнийг уншиж, тухайн
         * хүсэлтийн БҮХ Prisma query-г шүүнэ. Мартвал админ
         * BestTV-ийн өгөгдлийг BestFilm гэж хараад засварлана.
         *
         * ⚠️⚠️ НЭВТРЭХ/ТОКЕН СЭРГЭЭХ дуудлагад ИЛГЭЭХГҮЙ.
         *
         * БОДИТ АЛДАА (2026-09-08, хэрэглэгч мэдээлсэн): админ сүүлд
         * BestFilm эсвэл «Бүх сайт» сонгоод гарсан бол тэр сонголт
         * `localStorage`-д үлдэнэ. Дараа нь нэвтрэхэд `X-Site:
         * bestfilm` явж, `admin@besttv.mn` нь BestTV-ийн хэрэглэгч
         * тул **401 «нууц үг буруу»** гэж ХУДАЛ мэдэгдэнэ. `all`
         * үед 403. Хэрэглэгч зөв нууц үгээ бичсэн ч ОГТ орж чадахгүй.
         *
         * ⚠️ Нэвтрэх мөчид хэрэглэгч аль сайтынх нь МЭДЭГДЭХГҮЙ —
         * `auth.service` өөрөө `X-Site`-гүй үед бүх сайтаас хайдаг.
         */
        ...(AUTH_FREE_PATHS.some((pp) => path.startsWith(pp))
          ? {}
          : { 'X-Site': currentAdminSite() }),
        ...init.headers,
      },
    });
  };

  let res = await doFetch();

  if (res.status === 401 && auth && getAccessToken()) {
    refreshPromise ??= tryRefresh().finally(() => (refreshPromise = null));
    const ok = await refreshPromise;
    if (ok) res = await doFetch();
    else clearTokens();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.message ?? 'Алдаа гарлаа');
  }
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
