'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, KeyRound, Loader2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { BrandLogo } from '@besttv/shared/ui';
import { api, ApiError } from '@/lib/api';
import { useBrand } from '@/lib/queries';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  /**
   * ⚠️ Илгээсний дараа формыг СОЛИНО (дахин илгээх талбар харуулахгүй).
   * Хэрэглэгч "ирсэнгүй" гэж дахин дахин дардаг тул хязгаарт (5/5мин)
   * хүрч, дараа нь үнэхээр хэрэгтэй үед нь блоклогддог.
   */
  const [sent, setSent] = useState(false);
  const { data: brand } = useBrand();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!mail) return;

    setLoading(true);
    try {
      const res = await api<{ ok: boolean; message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: mail }),
        auth: false,
      });
      setSent(true);
      toast.success(res.message ?? 'Сэргээх линк илгээгдлээ');
    } catch (err: unknown) {
      /* ⚠️ 429 (хэт олон хүсэлт)-д тодорхой мессеж — эс бөгөөс хэрэглэгч
         "яагаад ажиллахгүй байна" гэж ойлгохгүй дахин дахин оролдоно. */
      const msg =
        err instanceof ApiError && err.status === 429
          ? 'Хэт олон хүсэлт илгээлээ. Хэдэн минутын дараа дахин оролдоно уу.'
          : err instanceof Error
            ? err.message
            : 'Алдаа гарлаа';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 sm:px-4 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        <h1 className="flex items-center">
          <BrandLogo
            logoUrl={brand?.logoUrl ?? null}
            siteName={brand?.siteName ?? 'BestTV'}
            imgClassName="h-9 w-auto sm:h-11"
            textSize="text-2xl sm:text-3xl"
          />
        </h1>

        {sent ? (
          <div className="mt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
              <MailCheck size={22} />
            </div>
            <p className="mt-4 text-lg font-bold text-foreground">Имэйлээ шалгана уу</p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/60">
              Хэрэв <strong className="font-semibold text-foreground/80">{email.trim()}</strong>{' '}
              хаяг бүртгэлтэй бол нууц үг сэргээх линк илгээгдсэн байна.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-foreground/40">
              Линк <strong className="font-semibold text-foreground/60">1 цаг</strong> хүчинтэй.
              Имэйл ирээгүй бол спам (junk) хавтсаа шалгаарай.
            </p>
            <Link
              href="/login"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.99] sm:py-3 sm:text-base"
            >
              Нэвтрэх рүү буцах
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <KeyRound size={22} />
            </div>
            <p className="mt-4 text-lg font-bold text-foreground">Нууц үг сэргээх</p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/55">
              Бүртгэлтэй имэйл хаягаа оруулна уу. Бид сэргээх линк илгээнэ.
            </p>

            <form onSubmit={submit} className="mt-5 space-y-3.5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  Имэйл хаяг
                </span>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tanii@mail.mn"
                  autoComplete="email"
                  className="input-dark"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-all hover:brightness-110 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.99] disabled:opacity-50 sm:py-3 sm:text-base"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Илгээж байна...' : 'Сэргээх линк илгээх'}
              </button>
            </form>

            {/* ⚠️ Сошиал хаягаар нэвтэрсэн хүн энд ирвэл имэйл ирэхгүй
                (нууц үг байхгүй) — шалтгааныг урьдчилан хэлнэ, эс бөгөөс
                "линк ирэхгүй байна" гэсэн гомдол болно. */}
            <p className="mt-4 rounded-xl border border-border/60 bg-foreground/4 px-3.5 py-2.5 text-xs leading-relaxed text-foreground/50">
              Google эсвэл Facebook-ээр бүртгүүлсэн бол нууц үг байхгүй тул линк илгээгдэхгүй —
              шууд тухайн сошиал хаягаараа нэвтэрнэ үү.
            </p>

            <p className="mt-5 text-center text-sm">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-foreground/55 underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                <ArrowLeft size={14} />
                Нэвтрэх рүү буцах
              </Link>
            </p>
          </>
        )}
      </motion.div>

    </main>
  );
}
