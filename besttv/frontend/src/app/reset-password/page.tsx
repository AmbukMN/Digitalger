'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { BrandLogo } from '@besttv/shared/ui';
import { api, ApiError } from '@/lib/api';
import { useBrand } from '@/lib/queries';

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { data: brand } = useBrand();

  const logo = (
    <h1 className="flex items-center">
      <BrandLogo
        logoUrl={brand?.logoUrl ?? null}
        siteName={brand?.siteName ?? 'BestTV'}
        imgClassName="h-9 w-auto sm:h-11"
        textSize="text-2xl sm:text-3xl"
      />
    </h1>
  );

  // ⚠️ Backend-ийн RegisterDto-той ИЖИЛ дүрэм (доод тал нь 8)
  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Нууц үг доод тал нь 8 тэмдэгт байна');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Нууц үг таарахгүй байна');
      return;
    }

    setLoading(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
        auth: false,
      });
      setDone(true);
      toast.success('Нууц үг амжилттай солигдлоо');
      /**
       * ⚠️ АВТОМАТААР НЭВТРҮҮЛЭХГҮЙ — санаатай шийдвэр. Нууц үгээ
       * сэргээх шалтгаан нь ихэвчлэн бүртгэл эрсдэлд орсон явдал тул
       * хэрэглэгч шинэ нууц үгээрээ ГАРААР нэвтэрч, тэр нь ажиллаж
       * байгааг өөрөө батлах нь зөв.
       */
      setTimeout(() => router.replace('/login'), 2500);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError && err.status === 429
          ? 'Хэт олон оролдлого. Хэдэн минутын дараа дахин оролдоно уу.'
          : err instanceof Error
            ? err.message
            : 'Алдаа гарлаа';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ⚠️ Токенгүй орж ирсэн (линкийг таслан хуулсан / гараар бичсэн) —
     хоосон формыг харуулаад сүүлд нь бүтэлгүйтүүлэхийн оронд ШУУД
     тайлбарлаж, зөв зам руу нь чиглүүлнэ. */
  if (!token) {
    return (
      <Shell>
        {logo}
        <div className="mt-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <TriangleAlert size={22} />
          </div>
          <p className="mt-4 text-lg font-bold text-foreground">Линк буруу байна</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/60">
            Нууц үг сэргээх линк дутуу эсвэл гэмтсэн байна. Имэйл дэх линкийг бүтнээр нь дарна уу.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.99] sm:py-3 sm:text-base"
          >
            Шинэ линк хүсэх
          </Link>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        {logo}
        <div className="mt-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 size={22} />
          </div>
          <p className="mt-4 text-lg font-bold text-foreground">Нууц үг солигдлоо</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/60">
            Одоо шинэ нууц үгээрээ нэвтэрнэ үү. Нэвтрэх хуудас руу шилжиж байна...
          </p>
          <Link
            href="/login"
            className="mt-6 flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.99] sm:py-3 sm:text-base"
          >
            Нэвтрэх
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {logo}
      <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <LockKeyhole size={22} />
      </div>
      <p className="mt-4 text-lg font-bold text-foreground">Шинэ нууц үг тохируулах</p>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground/55">
        Шинэ нууц үгээ оруулна уу. Хуучин нууц үг ажиллахаа болино.
      </p>

      <form onSubmit={submit} className="mt-5 space-y-3.5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-foreground/45">
            Шинэ нууц үг
          </span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Доод тал нь 8 тэмдэгт"
              autoComplete="new-password"
              aria-invalid={tooShort}
              className={cn('input-dark pr-11', tooShort && 'input-dark-error')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Нууц үг нуух' : 'Нууц үг харах'}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-foreground/40 transition-colors hover:text-foreground/80"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {tooShort && (
            <p className="mt-1.5 text-xs text-destructive">Доод тал нь 8 тэмдэгт байх ёстой</p>
          )}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-foreground/45">
            Нууц үг давтах
          </span>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Шинэ нууц үгээ дахин оруулна уу"
            autoComplete="new-password"
            aria-invalid={mismatch}
            className={cn('input-dark', mismatch && 'input-dark-error')}
          />
          {mismatch && <p className="mt-1.5 text-xs text-destructive">Нууц үг таарахгүй байна</p>}
        </label>

        <button
          type="submit"
          disabled={loading || mismatch || tooShort}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-all hover:brightness-110 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.99] disabled:opacity-50 sm:py-3 sm:text-base"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Хадгалж байна...' : 'Нууц үг солих'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm">
        <Link
          href="/login"
          className="text-foreground/55 underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Нэвтрэх рүү буцах
        </Link>
      </p>
    </Shell>
  );
}

/** Гурван төлөв (токенгүй / форм / амжилттай) НЭГ хүрээ хуваалцана */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 sm:px-4 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        {children}
      </motion.div>

      <style jsx global>{`
        /* Login хуудастай ИЖИЛ талбарын загвар (theme дагана) */
        .input-dark {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          background: color-mix(in srgb, var(--foreground) 5%, transparent);
          padding: 0.72rem 1rem;
          color: var(--foreground);
          outline: none;
          transition:
            border-color 0.15s ease,
            background 0.15s ease;
        }
        .input-dark::placeholder {
          color: color-mix(in srgb, var(--foreground) 45%, transparent);
        }
        .input-dark:focus {
          border-color: var(--primary);
          background: color-mix(in srgb, var(--foreground) 8%, transparent);
        }
        .input-dark-error {
          border-color: var(--destructive);
        }
      `}</style>
    </main>
  );
}
