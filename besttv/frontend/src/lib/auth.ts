import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';

// Server-талд ажилладаг тул NEXT_PUBLIC_ шаардлагагүй — Docker/VPS дээр ч
// runtime-д зөв утга уншина (build-д bake хийгдэхгүй).
const BACKEND_URL = process.env.API_URL ?? 'http://localhost:4100';

/**
 * JWT-ийн хугацаа дууссан эсэх (сервер тал, сүлжээгүй).
 * ⚠️ 30 секундын нөөц — refresh-ыг ЭРТ хийж, зааг дээр 401 гарахаас сэргийлнэ.
 */
function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('utf8'),
    ) as { exp?: number };
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000 - 30_000;
  } catch {
    return false;
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
  pages: {
    signIn: '/login',
    error: '/login',
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
          if (!res.ok) return false;

          const data = await res.json();
          user.id = data.user.id;
          (user as any).role = data.user.role;
          (user as any).isGuest = data.user.isGuest ?? false;
          (user as any).accessToken = data.accessToken;
          (user as any).refreshToken = data.refreshToken;
        } catch {
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.isGuest = (user as any).isGuest ?? false;
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.picture = user.image;
        /**
         * ⚠️ Provider-ыг ХАДГАЛНА — `/api/auth/bridge` нь токен сэргээхдээ
         * ЗӨВ provider-ыг backend рүү дамжуулах ёстой. Facebook-ээр
         * нэвтэрсэн хэрэглэгчийг 'google' гэж дамжуулбал буруу/шинэ
         * бүртгэл үүсэх эрсдэлтэй.
         */
        if (account?.provider) token.provider = account.provider;
        if ((user as any).providerAccountId) {
          token.providerAccountId = (user as any).providerAccountId;
        } else if (account?.providerAccountId) {
          token.providerAccountId = account.providerAccountId;
        }
      }
      // useSession().update()-аар client талаас дуудагдана (avatar шинэчлэх г.м.)
      if (trigger === 'update' && session?.picture) {
        token.picture = session.picture;
      }

      /**
       * ⚠️⚠️ ХАМГИЙН ЧУХАЛ — SESSION ДОТОРХ ТОКЕНЫГ ШИНЭЧЛЭНЭ.
       *
       * АЛДАА: `if (user)` нь ЗӨВХӨН ЭХНИЙ нэвтрэлтэд ажилладаг тул
       * session доторх backend accessToken (15 МИНУТ) нь 30 ХОНОГИЙН
       * турш ХӨЛДӨЖ, хэзээ ч шинэчлэгддэггүй байв.
       *
       * Үр дүнд хэрэглэгч 15 минутын дараа:
       *   - session хүчинтэй (hasAccess: true) харагдана
       *   - гэтэл доторх токен нь ХУУЧИРСАН → /auth/me 401
       *   - client тал түүнийг localStorage-д бичээд л мөнхийн 401
       * (бодит гомдол: SESSION hasAccess=true, hasRefresh=true байтал
       *  besttv.us дээр "Нэвтрэх" товч харагдаж, орж чадахгүй байсан)
       *
       * Одоо access хуучирсныг мэдмэгц refreshToken-оор ШИНЭЧИЛНЭ.
       * `jwt` callback нь session уншигдах бүрд ажилладаг тул session
       * ҮРГЭЛЖ ХҮЧИНТЭЙ токентой байна.
       */
      const at = token.accessToken as string | undefined;
      const rt = token.refreshToken as string | undefined;
      if (at && rt && isExpired(at)) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt }),
          });
          if (res.ok) {
            const d = (await res.json()) as { accessToken: string; refreshToken: string };
            token.accessToken = d.accessToken;
            token.refreshToken = d.refreshToken;
          }
          // Амжилтгүй бол хуучныг үлдээнэ — client тал /api/auth/bridge-ээр
          // сэргээхийг оролдоно (сүлжээний түр саатлаас болж гаргахгүй)
        } catch {
          /* сүлжээний алдаа — хуучин токеныг хэвээр үлдээнэ */
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).isGuest = token.isGuest ?? false;
        session.user.image = (token.picture as string) ?? session.user.image;
      }
      (session as any).accessToken = token.accessToken;
      (session as any).refreshToken = token.refreshToken;
      // ⚠️ /api/auth/bridge-д хэрэгтэй (токен сэргээхэд ЗӨВ provider)
      (session as any).provider = token.provider;
      (session as any).providerAccountId = token.providerAccountId;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
