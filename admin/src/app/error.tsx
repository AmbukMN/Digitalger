'use client';

// Admin route segment error boundary (App Router).
// Admin доторх аль ч segment-д гарсан runtime алдааг барьж авна.
// reset() нь segment-ийг дахин ачаална.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@digitalger/shared/ui';
import { AlertTriangle, RotateCw, LayoutDashboard, LogOut } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    // TODO(Sentry): DSN тохируулсан үед энд captureException(error) нэмнэ.
    console.error('[admin/error]', error);
  }, [error]);

  // ⚠️ ЧУХАЛ: admin гацвал session-аа цэвэрлэж ДАХИН нэвтрэх боломж. Буруу кэш
  // (localStorage) эсвэл хүчингүй session-аас болж гацсан бол энэ нь гаргалгаа.
  async function handleSignOut() {
    setSigningOut(true);
    try {
      // localStorage кэш цэвэрлэх (буруу profile/permission-аас болж гацахаас сэргийлэх).
      try {
        localStorage.removeItem('dg_admin_profile');
        localStorage.removeItem('dg_admin_perms');
      } catch { /* ignore */ }
      await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    } finally {
      // Session cookie цэвэрлэгдсэн → login руу (hard reload — бүх state шинэчилнэ).
      window.location.href = '/login';
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-col items-center gap-6"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-destructive/10">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>

        <div className="max-w-md space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Алдаа гарлаа
          </h1>
          <p className="text-sm text-muted-foreground">
            Админ хэсгийг ачаалахад гэнэтийн алдаа гарлаа. Дахин оролдоно уу.
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
              <LayoutDashboard className="h-4 w-4" />
              Хяналтын самбар
            </Link>
          </Button>
        </div>

        {/* ⚠️ Гацсан үед гаргалгаа — session/кэш цэвэрлэж дахин нэвтрэх. */}
        <div className="flex flex-col items-center gap-1.5 pt-2">
          <p className="text-xs text-muted-foreground">Дээрх ажиллахгүй бол:</p>
          <Button
            onClick={handleSignOut}
            disabled={signingOut}
            variant="ghost"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            {signingOut ? 'Гарч байна...' : 'Гарах ба дахин нэвтрэх'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
