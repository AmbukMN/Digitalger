import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ||
    (() => {
      throw new Error('NEXTAUTH_SECRET тохируулагдаагүй байна');
    })(),
);

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

  if (data.user?.role !== 'ADMIN') {
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
    .sign(SECRET);

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
