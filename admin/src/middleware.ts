import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET!,
    cookieName: 'admin.next-auth.session-token',
  });

  if (pathname.startsWith('/login')) {
    if (token?.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (!token || token.role !== 'ADMIN') {
    const url = new URL('/login', req.url);
    url.searchParams.set('error', 'unauthorized');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
