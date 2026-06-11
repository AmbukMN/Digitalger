import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { getAuthSecret } from '@/lib/secret';

const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function POST(req: Request) {
  const { email, password } = await req.json();

  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const data = await res.json();

  // Admin panel-д нэвтрэх боломжтой бүх дүр (multi-tenant: EDITOR/ADMIN/SUPERADMIN).
  const ADMIN_ROLES = ['EDITOR', 'ADMIN', 'SUPERADMIN'];
  if (!ADMIN_ROLES.includes(data.user?.role)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const token = await new SignJWT({
    id: data.user.id,
    email: data.user.email,
    name: data.user.name,
    role: data.user.role,
    image: data.user.image,
    accessToken: data.accessToken,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(getAuthSecret());

  const response = NextResponse.json({ ok: true });
  response.cookies.set('admin-session', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: false,
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
