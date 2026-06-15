'use client';

// Root route segment error boundary (App Router).
// Энэ нь App доторх аль ч segment-д гарсан runtime алдааг барьж авч,
// цэвэр brand UI харуулна. reset() нь segment-ийг дахин ачаална.
import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@digitalger/shared/ui';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO(Sentry): DSN тохируулсан үед энд captureException(error) нэмнэ.
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-col items-center gap-6"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 dark:bg-red-950/40">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>

        <div className="max-w-md space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Алдаа гарлаа
          </h1>
          <p className="text-sm text-muted-foreground">
            Уучлаарай, хуудсыг ачаалахад гэнэтийн алдаа гарлаа. Дахин оролдоно
            уу. Хэрэв алдаа давтагдвал тусламж аваарай.
          </p>
          {error.digest && (
            <p className="pt-1 text-xs text-muted-foreground/60">
              Алдааны код: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={reset} className="gap-2">
            <RotateCw className="h-4 w-4" />
            Дахин ачаалах
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              Нүүр хуудас
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
