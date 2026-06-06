import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ||
    (() => {
      throw new Error('NEXTAUTH_SECRET тохируулагдаагүй байна');
    })(),
);

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin-session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return NextResponse.json({ accessToken: payload.accessToken as string });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
