'use client';

import { useSession } from 'next-auth/react';
import { Lock } from 'lucide-react';

/**
 * "Зөвхөн админд" badge — adminOnly бүтээгдэхүүний detail хуудсанд харуулна.
 * ⚠️ Зөвхөн ADMIN role-той хэрэглэгчид харагдана (та ялгаж мэдэхэд).
 * adminOnly бус бол юу ч render хийхгүй (хоосон).
 */
export function AdminOnlyBadge({ adminOnly }: { adminOnly?: boolean }) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  if (!adminOnly || !isAdmin) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-xs font-bold text-black shadow-sm">
      <Lock className="h-3 w-3" />
      Зөвхөн админд харагдана (туршилт)
    </span>
  );
}
