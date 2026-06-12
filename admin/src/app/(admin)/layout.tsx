import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { AdminShell } from '@/components/layout/admin-shell';
import { getAuthSecret } from '@/lib/secret';

// ⚠️ Энгийн wrapper — server-side ХҮНД fetch (profile/permission) ХИЙХГҮЙ.
// Гэхдээ cookie доторх admin-session JWT-ээс хэрэглэгчийн role-ийг ШУУД задлаж
// (middleware-тэй ижил pattern: jwtVerify + admin-session) AdminShell-д initialRole
// болгон дамжуулна. Ингэснээр sidebar эхний render-д л зөв цэс (SUPERADMIN цэс)
// гарч ирнэ — profile query ирэхийг хүлээхгүй (цэс хожуу гарах flicker арилна).
//
// ⚠️ Энэ нь session-specific cookie JWT (localStorage кэш БИШ) тул өөр хэрэглэгч
// нэвтэрвэл cookie солигдоно → role холилдохгүй. Аюулгүй.
async function getRoleFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin-session')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, getAuthSecret());
    return (payload as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const initialRole = await getRoleFromCookie();
  return <AdminShell initialRole={initialRole}>{children}</AdminShell>;
}
