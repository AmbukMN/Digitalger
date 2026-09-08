'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { reportError } from '@/lib/report-error';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    /* ⚠️ Серверт МЭДЭЭЛНЭ — эс бөгөөс энэ алдаа хаана ч үлдэхгүй,
       «зарим хэрэглэгч үзэж чадахгүй» гомдлыг хайх арга байхгүй */
    reportError(error.message || 'React render error', {
      stack: error.stack,
      meta: { kind: 'react-error-boundary', digest: error.digest },
    });
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-3xl font-black text-foreground">Алдаа гарлаа</h1>
      <p className="mt-2 max-w-sm text-foreground/60">
        Хуудас ачаалахад асуудал гарлаа. Дахин оролдоно уу.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:brightness-110"
        >
          <RotateCcw size={16} /> Дахин оролдох
        </button>
        <Link href="/" className="rounded-md bg-foreground/10 px-5 py-2.5 font-medium text-foreground hover:bg-foreground/20">
          Нүүр рүү буцах
        </Link>
      </div>
    </main>
  );
}
