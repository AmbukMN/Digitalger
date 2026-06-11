'use client';

// ─── Одоо нэвтэрсэн админы id + role ──────────────────────────────────────────
// SHARED resource (blog/testimonials/faqs/categories/product-types) жагсаалтад
// бүх админ БҮГДИЙГ харна. Гэхдээ зөвхөн ӨӨРИЙН (createdByUserId===myId) мөрийн
// edit/delete товч идэвхтэй. SUPERADMIN бүгдийг засна.
//
// canModify(row) — тухайн мөрийн edit/delete товч харагдах эсэх.

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';

export function useCurrentAdmin() {
  const { data } = useQuery({
    queryKey: ['admin', 'profile'],
    queryFn: () => adminApi.profile.get(),
    staleTime: 5 * 60 * 1000, // 5 минут — өөрчлөгддөггүй
  });

  const myId = data?.id ?? null;
  const myRole = data?.role ?? null;
  // AdminProfile.role нь UserRole ('ADMIN'|'USER') гэж нарийсгасан тул SUPERADMIN-г
  // string-ээр харьцуулна (backend SUPERADMIN дүр буцааж болно).
  const isSuperadmin = (myRole as string) === 'SUPERADMIN';

  // SUPERADMIN бүгдийг засна; бусад нь зөвхөн өөрийн контентыг.
  const canModify = (row: { createdByUserId?: string | null }) =>
    isSuperadmin || (!!myId && row.createdByUserId === myId);

  return { myId, myRole, isSuperadmin, canModify };
}
