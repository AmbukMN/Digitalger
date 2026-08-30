import * as SecureStore from 'expo-secure-store';

/**
 * BestTV API клиент.
 *
 * ⚠️⚠️ Токеныг `SecureStore`-д хадгална (iOS Keychain / Android Keystore) —
 * `AsyncStorage` нь ЭНГИЙН файл тул root/jailbreak төхөөрөмжөөс уншигдана.
 *
 * ⚠️ Access token 15 минут, refresh 30 хоног. 401 ирвэл АВТОМАТААР
 * шинэчилж, хүсэлтийг ДАХИН илгээнэ — хэрэглэгч гарахгүй.
 */
export const API_BASE = 'https://besttv.us/api';

const ACCESS = 'btv_access';
const REFRESH = 'btv_refresh';

export async function getAccess(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS);
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS, access);
  await SecureStore.setItemAsync(REFRESH, refresh);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
}

/**
 * ⚠️⚠️ НЭГ ЗЭРЭГ ОЛОН refresh явуулахгүй.
 *
 * Нүүр хуудас нээгдэхэд 5-6 хүсэлт зэрэг явдаг. Токен дуусмагц
 * бүгд 401 авч, тус бүр refresh дуудвал:
 *   · сервер рүү 6 refresh очно
 *   · backend нь `rotate()` хийдэг тул эхнийх нь ажиллаад бусад нь
 *     ХҮЧИНГҮЙ токеноор ирж, session УСТАНА → хэрэглэгч гэнэт гарна
 * Тиймээс нэг л refresh явж, бусад нь түүнийг ХҮЛЭЭНЭ.
 */
let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const rt = await SecureStore.getItemAsync(REFRESH);
      if (!rt) return false;
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) {
        /* ⚠️ 401 = refresh ч хүчингүй (30 хоног дууссан, эсвэл өөр
           төхөөрөмжөөс хязгаар давсан) → цэвэрлэж нэвтрэх рүү */
        if (res.status === 401) await clearTokens();
        return false;
      }
      const d = await res.json();
      await setTokens(d.accessToken, d.refreshToken);
      return true;
    } catch {
      /* ⚠️ Сүлжээний алдааг «гарах» гэж БҮҮ ойлго — офлайн байж болно */
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * API дуудлага.
 *
 * @param auth `false` бол токен хавсаргахгүй (нэвтрэх, бүртгүүлэх)
 */
export async function api<T = unknown>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, ...init } = options;

  const send = async (): Promise<Response> => {
    const token = auth ? await getAccess() : null;
    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  };

  let res = await send();

  /* ⚠️ 401 → нэг удаа refresh хийгээд ДАХИН оролдоно */
  if (res.status === 401 && auth) {
    if (await refreshTokens()) res = await send();
  }

  if (!res.ok) {
    /* ⚠️ Backend-ийн МОНГОЛ мессежийг гаргана — «Алдаа гарлаа» гэсэн
       ерөнхий текст юу буруу болсныг хэлдэггүй */
    let msg = 'Алдаа гарлаа';
    try {
      const body = await res.json();
      const m = body?.message;
      msg = Array.isArray(m) ? m[0] : (m ?? msg);
    } catch {
      /* JSON биш хариу — ерөнхий мессеж үлдэнэ */
    }
    throw new ApiError(msg, res.status);
  }

  /* 204 гэх мэт биегүй хариу */
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
