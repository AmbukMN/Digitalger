import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, clearTokens, getAccess, setTokens } from './api';
import { registerPush, unregisterPush } from './push';
import { syncDownloads } from './downloads';
import { linkChatSession } from './chat';
import type { Me } from './types';

/**
 * Нэвтрэлтийн төлөв.
 *
 * ⚠️ Апп нээгдэхэд токен байгаа эсэхийг ЭХЛЭЭД шалгана (`loading`) —
 * эс бөгөөс нэвтэрсэн хэрэглэгчид нэвтрэх дэлгэц гялсхийж эвгүй.
 */
interface AuthState {
  me: Me | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  /**
   * ⚠️ Сошиал нэвтрэлт — провайдерын `id_token`-оор.
   * Backend нь түүнийг провайдерын НИЙТИЙН түлхүүрээр шалгана
   * (нууц хуваалцахгүй — апп-д нууц хадгалж БОЛОХГҮЙ).
   */
  signInWithProvider: (p: {
    provider: 'apple' | 'google';
    idToken: string;
    name?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  /** ⚠️ Гарахад устгахын тулд токеныг санана */
  const pushToken = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const load = useCallback(async () => {
    try {
      const token = await getAccess();
      if (!token) {
        setMe(null);
        return;
      }
      setMe(await api<Me>('/auth/me'));
      /* ⚠️ Аль хэдийн нэвтэрсэн — токен ӨӨРЧЛӨГДСӨН байж болно
         (апп шинэчлэгдэх, өгөгдөл цэвэрлэгдэх үед) тул дахин бүртгэнэ */
      pushToken.current = await registerPush();

      /**
       * ⚠️⚠️ ОФЛАЙН ТАТАЦЫН HEARTBEAT — DRM-ийн ОРЛУУЛАГЧ.
       *
       * Багцаа цуцалсан/дууссан хэрэглэгчийн локал файлыг устгана.
       * Хийхгүй бол төлбөрөө больсон хүн контентыг ҮҮРД хадгална.
       *
       * ⚠️ `void` — унасан ч нэвтрэлт зогсох ЁСГҮЙ (офлайн байж болно).
       */
      void syncDownloads();

      /* ⚠️ Чатын session-ыг бүртгэлтэй хэрэглэгчтэй холбоно — админ
         хэнтэй ярьж байгаагаа мэдэх ёстой */
      void linkChatSession();
    } catch {
      /* ⚠️ Алдааг «гараагүй» гэж БҮҮ ойлго — офлайн байж болно.
         Токен үнэхээр хүчингүй бол `api()` дотор цэвэрлэгдсэн байна. */
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const afterAuth = useCallback(
    async (d: { accessToken: string; refreshToken: string }) => {
      await setTokens(d.accessToken, d.refreshToken);
      setMe(await api<Me>('/auth/me'));
      /* ⚠️⚠️ Push зөвшөөрлийг НЭВТЭРСНИЙ ДАРАА асууна — апп нээгдмэгц
         асуувал ихэнх нь «Үгүй» дарж, iOS дахин асуухыг зөвшөөрдөггүй */
      pushToken.current = await registerPush();
      void linkChatSession();
      /* ⚠️ Кэшийг цэвэрлэнэ — өмнөх хэрэглэгчийн «дуртай», «үргэлжлүүлэх»
         шинэ хэрэглэгчид харагдах ёсгүй */
      qc.clear();
    },
    [qc],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const d = await api<{ accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password }),
      });
      await afterAuth(d);
    },
    [afterAuth],
  );

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      const d = await api<{ accessToken: string; refreshToken: string }>('/auth/register', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password, name }),
      });
      await afterAuth(d);
    },
    [afterAuth],
  );

  const signInWithProvider = useCallback(
    async (p: { provider: 'apple' | 'google'; idToken: string; name?: string }) => {
      const d = await api<{ accessToken: string; refreshToken: string }>(
        '/auth/mobile/oauth',
        { method: 'POST', auth: false, body: JSON.stringify(p) },
      );
      await afterAuth(d);
    },
    [afterAuth],
  );

  const signOut = useCallback(async () => {
    /* ⚠️⚠️ `/auth/logout` ЗААВАЛ дуудна — эс бөгөөс session мөр 30 хоног
       үлдэж, төхөөрөмжийн хязгаарын НЭГ БАЙРЫГ дэмий эзэлнэ. */
    try {
      const SecureStore = await import('expo-secure-store');
      const rt = await SecureStore.getItemAsync('btv_refresh');
      if (rt) {
        await api('/auth/logout', {
          method: 'POST',
          auth: false,
          body: JSON.stringify({ refreshToken: rt }),
        });
      }
    } catch {
      /* Сүлжээгүй ч локал токеныг цэвэрлэнэ */
    }
    /* ⚠️ Push токеныг УСТГАНА — эс бөгөөс гарсан хэрэглэгчид
       (эсвэл утсыг авсан шинэ эзэнд) мэдэгдэл ирсээр байна */
    await unregisterPush(pushToken.current);
    pushToken.current = null;

    await clearTokens();
    setMe(null);
    qc.clear();
  }, [qc]);

  const value = useMemo(
    () => ({ me, loading, signIn, signUp, signInWithProvider, signOut, refresh: load }),
    [me, loading, signIn, signUp, signInWithProvider, signOut, load],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth нь AuthProvider дотор байх ёстой');
  return c;
}
