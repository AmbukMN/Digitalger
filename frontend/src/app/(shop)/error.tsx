'use client';

import { useEffect } from 'react';
import { Button } from '@digitalger/shared/ui';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function ShopError({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <h2 className="text-xl font-bold">Алдаа гарлаа</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Хуудсыг ачаалахад алдаа гарлаа. Дахин оролдоно уу.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          Дахин оролдох
        </Button>
        <Button asChild>
          <Link href="/">Нүүр хуудас</Link>
        </Button>
      </div>
    </div>
  );
}
