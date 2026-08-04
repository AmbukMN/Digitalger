import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';

// Server-талд ажилладаг тул NEXT_PUBLIC_ шаардлагагүй — Docker/VPS дээр ч
// runtime-д зөв утга уншина (build-д bake хийгдэхгүй).
const BACKEND_URL = process.env.API_URL ?? 'http://localhost:4100';

/** Access token хугацаа дуусахаас хэдэн мс өмнө урьдчилж шинэчлэх */
const REFRESH_SKEW_MS = 60_000;

/** JWT-ийн `exp`-ыг мс болгож уншина (шалгалтгүй — зөвхөн хугацаа мэдэхэд) */
function jwtExpiryMs(token?: string): number | undefined {
  if (!token) return undefined;
  const payload = token.split('.')[1];
  if (!payload) return undefined;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp?: number };
    return typeof exp === 'number' ? exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

/** Хугацаа дуусахад ойрхон эсэх (хугацаа мэдэгдэхгүй бол шинэчлүүлнэ) */
function isExpiringSoon(expiresAt?: number): boolean {
  if (!expiresAt) return true;
  return Date.now() >= expiresAt - REFRESH_SKEW_MS;
}

/** refreshToken-оор backend-ээс шинэ access token авна */
async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken?: string } | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      console.error(`[auth][refresh] амжилтгүй ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
    return data.accessToken ? { accessToken: data.accessToken, refreshToken: data.refreshToken } : null;
  } catch (e) {
    console.error('[auth][refresh] алдаа —', e instanceof Error ? e.message : String(e));
    return null;
  }
}

const providers: NextAuthOptions['providers'] = [];

// ⚠️ Client ID/Secret хоосон бол provider бүртгэгдэхгүй — .env дутуу үед
// build/dev цуцлагдахгүй, зөвхөн тухайн товч frontend дээр харагдахгүй.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  providers.push(
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...providers,
    // Custom credentials provider — email/password БОЛОН guest-login-ийн
    // JWT tokens-ыг NextAuth session рүү дамжуулах "bridge" (бодит нэвтрэлт
    // нь /lib/api.ts-ийн backend дуудлагаар аль хэдийн хийгдсэн байдаг,
    // энэ provider зөвхөн үр дүнгийн token-г NextAuth session болгодог).
    CredentialsProvider({
      id: 'besttv-bridge',
      name: 'BestTV',
      credentials: {
        accessToken: { label: 'Access Token', type: 'text' },
        refreshToken: { label: 'Refresh Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.accessToken) return null;
        try {
          const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${credentials.accessToken}` },
          });
          if (!res.ok) return null;
          const me = await res.json();
          return {
            id: me.id,
            email: me.email,
            name: me.name ?? me.email,
            image: me.avatarUrl ?? null,
            role: me.role,
            isGuest: me.isGuest ?? false,
            accessToken: credentials.accessToken,
            refreshToken: credentials.refreshToken,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  /**
   * ⚠️⚠️ COOKIES ТОХИРГОО ГАРААР ӨГӨХГҮЙ.
   *
   * Оролдлого хийж `state`/`pkce`-ыг SameSite=None болгосон нь НЭВТРЭЛТ
   * БҮРЭН ЭВДСЭН: NextAuth-д `cookies` объектыг гараар өгвөл анхдагч
   * утгуудтай НЭГТГЭДЭГГҮЙ — зөвхөн бичсэн түлхүүрүүд үйлчилнэ. Тиймээс
   * `sessionToken` тодорхойлолтгүй үлдэж, SESSION COOKIE ОГТ ТАВИГДАХГҮЙ
   * болж, callback амжилттай болсон ч хэрэглэгч /login руу буцдаг байв.
   *
   * NextAuth нь `NEXTAUTH_URL` https байхад аюулгүй анхдагчийг (__Secure-
   * угтвар, secure: true) ӨӨРӨӨ хэрэглэдэг тул гараар тохируулах
   * шаардлагагүй.
   */
  pages: {
    signIn: '/login',
    error: '/login',
  },

  /**
   * ⚠️ OAuth алдааг PRODUCTION ЛОГТ гаргана.
   * Анхдагчаар NextAuth production-д зөвхөн `error`-ыг хэвлэдэг ч
   * `signIn` callback доторх алдаа чимээгүй `false` болж, шалтгаан нь
   * хаана ч харагддаггүй байв. Одоо тодорхой мессежтэй.
   */
  logger: {
    error(code, metadata) {
      console.error('[auth][error]', code, JSON.stringify(metadata)?.slice(0, 500));
    },
    warn(code) {
      console.warn('[auth][warn]', code);
    },
    debug() {
      /* production-д debug хэвлэхгүй */
    },
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' || account?.provider === 'facebook') {
        try {
          const res = await fetch(`${BACKEND_URL}/api/auth/oauth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              email: user.email,
              name: user.name ?? profile?.name,
              image: user.image ?? (profile as { picture?: string })?.picture ?? null,
            }),
          });
          /**
           * ⚠️ Өмнө нь ЧИМЭЭГҮЙ `return false` байсан тул нэвтрэлт бүтэлгүй
           * болоод шалтгаан нь хаана ч харагддаггүй, хэрэглэгч зөвхөн
           * "нэвтрэх товч буцаж гарах" л хардаг байв.
           */
          if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.error(
              `[auth][oauth] ${account.provider} FAILED ${res.status} — ${body.slice(0, 300)}`,
            );
            return false;
          }

          /**
           * ⚠️ `as any` ХЭРЭГГҮЙ — `types/next-auth.d.ts`-д User/JWT/Session
           * төрлүүд аль хэдийн өргөтгөгдсөн. `as any` нь тэр хамгаалалтыг
           * үгүйсгэж, талбарын нэр солигдоход compile үед баригдахгүй болгож
           * байв.
           */
          const data = (await res.json()) as {
            user: { id: string; role: string; isGuest?: boolean };
            accessToken: string;
            refreshToken: string;
          };
          user.id = data.user.id;
          user.role = data.user.role;
          user.isGuest = data.user.isGuest ?? false;
          user.accessToken = data.accessToken;
          user.refreshToken = data.refreshToken;
        } catch (e) {
          // ⚠️ Сүлжээ/JSON алдаа — өмнө нь чимээгүй `false` байсан
          console.error(
            `[auth][oauth] ${account.provider} THREW —`,
            e instanceof Error ? e.message : String(e),
          );
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isGuest = user.isGuest ?? false;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.picture = user.image;
        token.accessExpires = jwtExpiryMs(user.accessToken);
      }
      // useSession().update()-аар client талаас дуудагдана (avatar шинэчлэх г.м.)
      if (trigger === 'update' && session?.picture) {
        token.picture = session.picture;
      }

      /**
       * ⚠️⚠️ НЭВТРЭЛТ БҮТЭЛГҮЙТЭЖ БАЙСНЫ ЖИНХЭНЭ ШАЛТГААН — ХУГАЦААНЫ ЗӨРҮҮ:
       *
       *   backend access token = 15 МИНУТ  (JWT_EXPIRES_IN=15m)
       *   NextAuth session     = 30 ХОНОГ  (maxAge)
       *
       * Дээрх блок зөвхөн `if (user)` буюу АНХНЫ нэвтрэлтэд ажилладаг тул
       * дараагийн зочилол бүрт NextAuth хуучин JWT-гээ дахин ашиглаж,
       * дотор нь ХУГАЦАА ДУУССАН токеныг session-д тавьдаг байв. Үр дүнд:
       *   session 200 (токентой) → /auth/me 401 → sync унана → "Нэвтрэх"
       * товч буцаж гарч, хэрэглэгч ХЭЗЭЭ Ч нэвтэрч чаддаггүй.
       *
       * Засвар: хугацаа дуусахаас өмнө refreshToken-оор (30 хоног, session-
       * тэй ижил урт) backend-ээс ШИНЭ access token авна. Ингэснээр session-
       * д ҮРГЭЛЖ хүчинтэй токен байна.
       */
      if (token.refreshToken && isExpiringSoon(token.accessExpires)) {
        const refreshed = await refreshAccessToken(String(token.refreshToken));
        if (refreshed) {
          token.accessToken = refreshed.accessToken;
          token.refreshToken = refreshed.refreshToken ?? token.refreshToken;
          token.accessExpires = jwtExpiryMs(refreshed.accessToken);
        } else {
          // refresh ч хүчингүй → session-ийг хүчингүйд тооцно (дахин нэвтэрнэ)
          token.accessToken = undefined;
          token.refreshToken = undefined;
          token.accessExpires = undefined;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.isGuest = token.isGuest ?? false;
        session.user.image = token.picture ?? session.user.image;
      }
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
