const API_BASE = '/api';

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

async function tryRefresh(): Promise<boolean> {
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
