import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { API_URL } from './constants';

// Server-side only: INTERNAL_API_URL is not NEXT_PUBLIC_ so it's never baked in.
// In Docker this points to the internal backend container (http://backend:4000).
// Falls back to API_URL (localhost) for local non-Docker dev.
const BACKEND_URL = process.env.INTERNAL_API_URL ?? API_URL;

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 хоног — admin гарахгүй
    updateAge: 24 * 60 * 60,   // 24 цаг тутамд token шинэчлэх
  },
  cookies: {
    sessionToken: {
      name: `admin.next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
        maxAge: 30 * 24 * 60 * 60,
      },
    },
  },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        if (!res.ok) return null;

        const data = (await res.json()) as {
          user: {
            id: string;
            email: string;
            name: string | null;
            role: string;
            image: string | null;
          };
          accessToken: string;
          refreshToken: string;
        };

        if (data.user.role !== 'ADMIN') return null;

        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          image: data.user.image,
          role: data.user.role,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      session.accessToken = token.accessToken;
      return session;
    },
  },
};
