import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getAuthSecret } from '@/lib/secret';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/')) return NextResponse.next();

  const token = req.cookies.get('admin-session')?.value;

  let payload: { role?: string } | null = null;
  if (token) {
    try {
      const { payload: p } = await jwtVerify(token, getAuthSecret());
      payload = p as { role?: string };
    } catch {}
  }

  // Admin panel-д нэвтрэх боломжтой бүх дүр (multi-tenant Phase 4).
  const ADMIN_ROLES = ['EDITOR', 'ADMIN', 'SUPERADMIN'];
  const isAdmin = !!payload?.role && ADMIN_ROLES.includes(payload.role);

  if (pathname.startsWith('/login')) {
    if (isAdmin) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (!isAdmin) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
