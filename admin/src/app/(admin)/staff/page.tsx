'use client';

// ─── Багийн админ (Staff management) — тусдаа route, зөвхөн SUPERADMIN ─────────
// Тохиргоо групп доорх /staff цэс. SUPERADMIN биш бол "эрх байхгүй" харагдана.

import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { StaffPanel } from '@/components/staff-panel';
import { adminApi } from '@/lib/api';

// SUPERADMIN эсэхийг профайлаар тодорхойлно — admin-shell-тэй ижил query key
// (['admin','profile']) тул кэшээс шууд авна.
function useIsSuperadmin() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'profile'],
    queryFn: () => adminApi.profile.get(),
    staleTime: 5 * 60 * 1000,
  });
  // role нь UserRole ('ADMIN'|'USER') гэж typed боловч backend SUPERADMIN-ийг ч
  // буцаадаг тул string-ээр харьцуулна.
  return {
    isSuperadmin: (data?.role as string | undefined) === 'SUPERADMIN',
    isLoading,
  };
}

export default function StaffPage() {
  const { isSuperadmin, isLoading } = useIsSuperadmin();

  // Профайл ачаалж дуустал юу ч render хийхгүй (анивчилт зайлсхийх).
  if (isLoading) return null;

  if (!isSuperadmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-20 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground/60" />
        <div>
          <p className="text-lg font-semibold">Эрх байхгүй</p>
          <p className="text-sm text-muted-foreground">
            Энэ хуудсыг зөвхөн системийн эзэн (Superadmin) үзэх боломжтой.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Багийн админ</h1>
        <p className="text-sm text-muted-foreground">
          Админ ажилтан нэмэх, хэсэг бүрд эрх (харах/нэмэх/засах/устгах) тохируулах.
        </p>
      </div>
      <StaffPanel />
    </div>
  );
}
