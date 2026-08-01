'use client';

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-2xl font-bold text-foreground">Алдаа гарлаа</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">{error.message || 'Хуудас ачаалахад асуудал гарлаа.'}</p>
      <button
        onClick={reset}
        className="mt-6 flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:brightness-110"
      >
        <RotateCcw size={16} /> Дахин оролдох
      </button>
    </main>
  );
}
