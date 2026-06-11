import { AdminShell } from '@/components/layout/admin-shell';
import { adminApi } from '@/lib/api';
import type { AdminProfile } from '@/types/admin';

// ⚠️ Server Component — profile + permission-ийг SERVER-SIDE урьдчилан татаж
// AdminShell-д initial data болгож дамжуулна. Тэгснээр sidebar refresh хийхэд
// анивчихгүй (client query хүлээхгүй) — анхнаасаа зөв role/permission-той цэс.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, permissions] = await Promise.all([
    adminApi.profile.get().catch(() => null),
    adminApi.staff.myPermissions().catch(() => null),
  ]);

  return (
    <AdminShell
      initialProfile={profile as AdminProfile | null}
      initialPermissions={permissions}
    >
      {children}
    </AdminShell>
  );
}
