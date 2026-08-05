import type { NextAuthOptions } from 'next-auth';
import { SERVER_API_URL } from '@/lib/server-api';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';

// Server-талд ажилладаг тул NEXT_PUBLIC_ шаардлагагүй — Docker/VPS дээр ч
// runtime-д зөв утга уншина (build-д bake хийгдэхгүй).

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
          const res = await fetch(`${SERVER_API_URL}/api/auth/me`, {
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
          const res = await fetch(`${SERVER_API_URL}/api/auth/oauth`, {
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
      /**
       * ⚠️⚠️ ЭНД ТОКЕН REFRESH ХИЙХГҮЙ.
       *
       * Өмнө нь энд access хуучирвал refresh хийдэг код байсан. Гэвч
       * NextAuth v4 нь jwt callback-ийн өөрчлөлтийг COOKIE-д ХАДГАЛДАГГҮЙ
       * (зөвхөн signIn/update trigger дээр л бичигдэнэ). Тиймээс session
       * уншигдах БҮРД (SessionProvider poll, tab focus, getServerSession)
       * refresh дахин дахин дуудагдаж — production лог 1-3 секунд тутам
       * [REFRESH] спамдсан, гэхдээ cookie доторх токен ХЭВЭЭР хуучин
       * үлдсээр байв. Утгагүй ачаалал + хуучин токен тараах эх үүсвэр.
       */
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).isGuest = token.isGuest ?? false;
        session.user.image = (token.picture as string) ?? session.user.image;
      }
      /**
       * ⚠️⚠️ SESSION-Д accessToken/refreshToken-ЫГ ОГТ ОРУУЛАХГҮЙ.
       *
       * ЭНЭ БОЛ "нэвтэрсэн байтлаа 401" АЛДААНЫ ҮНДЭС ШАЛТГААН БАЙВ:
       *
       * Cookie доторх токен нь signIn хийсэн МӨЧИД (жишээ нь 06:39-д)
       * хөлдөж, 30 хоногийн турш ХЭЗЭЭ Ч шинэчлэгддэггүй. Гэтэл
       * OAuthSessionSync (ялангуяа ХУУЧИН bundle ажиллуулж буй ӨӨР ТАБ)
       * тэр ХӨЛДСӨН ХУУЧИРСАН токеныг localStorage руу дахин дахин
       * бичдэг байв. localStorage табуудын дунд ХУВААЛЦАГДДАГ тул:
       *   таб-1 refresh хийж ШИНЭ токен бичнэ → таб-2 (хуучин bundle)
       *   session-ийн ХУУЧИН токеноор ДАРНА → таб-1-ийн дараагийн
       *   хүсэлт хуучин токеноор явж 401 → уралдаан, санамсаргүй 401.
       * Production лог үүнийг батлав: client ШИНЭ токен явуулсан гэж
       * үзсэн мөчид backend-д 06:39-ийн ХУУЧИН токен ирсээр байсан.
       *
       * Session-д токен байхгүй бол ЯМАР Ч таб (хуучин bundle ч) үүнийг
       * хийж чадахгүй. Client токеноо ЗӨВХӨН login эсвэл /api/auth/bridge
       * (сервер шинээр олгоно)-оос авна. Нэг л эх сурвалж = localStorage.
       */
      // ⚠️ /api/auth/bridge-д хэрэгтэй (токен сэргээхэд ЗӨВ provider)
      (session as any).provider = token.provider;
      (session as any).providerAccountId = token.providerAccountId;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
