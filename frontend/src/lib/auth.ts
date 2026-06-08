import type { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import { authApi } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
// Not NEXT_PUBLIC_ → not baked at build time, reads runtime env in Docker
const BACKEND_URL = process.env.INTERNAL_API_URL ?? API_URL;

const providers: NextAuthOptions['providers'] = [];

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
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'И-мэйл', type: 'text' },
        phone: { label: 'Утас', type: 'text' },
        userId: { label: 'User ID', type: 'text' },
        password: { label: 'Нууц үг', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.password) return null;
        if (!credentials.email && !credentials.phone && !credentials.userId) return null;

        try {
          const data = await authApi.login({
            ...(credentials.userId ? { userId: credentials.userId } : {}),
            ...(credentials.email ? { email: credentials.email } : {}),
            ...(credentials.phone ? { phone: credentials.phone } : {}),
            password: credentials.password,
          });

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name ?? data.user.email,
            image: data.user.image,
            role: data.user.role,
            phone: (data.user as any).phone ?? null,
            isGuest: (data.user as any).isGuest ?? false,
            oauthProvider: (data.user as any).oauthProvider ?? null,
            emailVerified: (data.user as any).emailVerified ?? null,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
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
              image: user.image ?? (profile as any)?.picture ?? null,
            }),
          });

          if (!res.ok) return false;

          const data = await res.json();
          // Attach backend data to user object
          user.id = data.user.id;
          (user as any).role = data.user.role;
          (user as any).phone = data.user.phone ?? null;
          (user as any).isGuest = data.user.isGuest ?? false;
          (user as any).oauthProvider = account.provider;
          (user as any).emailVerified = data.user.emailVerified ?? null;
          (user as any).accessToken = data.accessToken;
          (user as any).refreshToken = data.refreshToken;
          // Keep image from OAuth provider
          if (!user.image && data.user.image) user.image = data.user.image;
        } catch {
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, trigger, session }: any) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.phone = (user as any).phone ?? null;
        token.isGuest = (user as any).isGuest ?? false;
        token.oauthProvider = (user as any).oauthProvider ?? null;
        token.emailVerified = (user as any).emailVerified ?? null;
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.picture = user.image;
      }
      if (trigger === 'update') {
        if (session?.picture) token.picture = session.picture;
        if (session?.emailVerified !== undefined) token.emailVerified = session.emailVerified;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        (session.user as any).phone = token.phone ?? null;
        (session.user as any).isGuest = token.isGuest ?? false;
        (session.user as any).oauthProvider = token.oauthProvider ?? null;
        (session.user as any).emailVerified = token.emailVerified ?? null;
        session.user.image = (token.picture as string) ?? session.user.image;
      }
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

/**
 * Server component-д ADMIN-ийн accessToken-ийг авах туслах.
 * ⚠️ Зөвхөн ADMIN role-той хэрэглэгчид token буцаана — энгийн хэрэглэгч/зочинд
 * undefined буцаана. Ингэснээр productsApi-д дамжуулахад зөвхөн админд adminOnly
 * бүтээгдэхүүн харагдана (энгийн SSR хэвээр public/нуугдсан).
 */
export async function getAdminAccessToken(): Promise<string | undefined> {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role === 'ADMIN' && session.accessToken) {
      return session.accessToken;
    }
  } catch {
    /* SSR session авч чадаагүй — public fetch үлдэнэ */
  }
  return undefined;
}
