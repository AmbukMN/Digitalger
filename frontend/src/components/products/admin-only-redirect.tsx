'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import Link from 'next/link';
import { Inbox } from 'lucide-react';

/**
 * adminOnly бүтээгдэхүүн public `/products/[slug]` (ISR static)-д 404 болдог.
 * Энэ client component public 404 байрлалд render хийгдэж, session шалгаад:
 *  - ADMIN/SUPERADMIN/EDITOR → /products/[slug]/preview руу шилжинэ (adminOnly харагдана)
 *  - зочин/энгийн хэрэглэгч → "Хуудас олдсонгүй" харуулна
 * ⚠️ Session-ийг CLIENT талд шалгана — server (ISR) дээр огт дуудахгүй тул хуудас
 * static хэвээр (500 static→dynamic алдаа гарахгүй).
 */
export function AdminOnlyRedirect({ slug }: { slug: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAdmin = ['ADMIN', 'SUPERADMIN', 'EDITOR'].includes(session?.user?.role as string);

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) {
      router.replace(`/products/${slug}/preview`);
    }
  }, [status, isAdmin, slug, router]);

  // Админ руу шилжих хүртэл (эсвэл зочин бол үргэлж) "олдсонгүй" харагдана
  if (status === 'loading' || (status === 'authenticated' && isAdmin)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border p-8 text-center">
        <Inbox className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="mb-2 text-xl font-bold">Хуудас олдсонгүй</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Уучлаарай, энэ хуудас байхгүй эсвэл устгагдсан байж болно. Нүүр хуудас руу буцаад
          эргэн хайна уу.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ background: '#022179' }}
        >
          Нүүр хуудас руу буцах
        </Link>
      </div>
    </div>
  );
}
