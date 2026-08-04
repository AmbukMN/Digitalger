'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { BrandLogo } from '@besttv/shared/ui';
import { useAuth } from '@/lib/auth-store';
import { useBrand } from '@/lib/queries';
import { SocialButtons } from '@/components/auth/social-buttons';

const PERKS = ['Мянга мянган кино', 'Хүссэн үедээ, хүссэн төхөөрөмжөөрөө', 'Хэзээ ч цуцалж болно'];

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { data: brand } = useBrand();
  const logoUrl = brand?.logoUrl ?? null;
  const siteName = brand?.siteName ?? 'BestTV';

  // Нэвтрэх шаардсан хуудаснаас ирсэн бол буцаж тэр рүү нь явуулна.
  // ⚠️ Зөвхөн дотоод зам зөвшөөрнө ("//evil.com" гэх мэт гадаад руу чиглүүлэх
  // open-redirect эмзэг байдлаас сэргийлнэ).
  const rawNext = params.get('next');
  const nextUrl = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
  /** Ямар нэг хуудаснаас чиглүүлэгдэж ирсэн эсэх — хэрэглэгчид САНАМЖ харуулна */
  const cameFrom = nextUrl !== '/';

  // Аль хэдийн нэвтэрсэн хэрэглэгч энэ хуудсанд саатах хэрэггүй
  useEffect(() => {
    if (!authLoading && user) router.replace(nextUrl);
  }, [authLoading, user, nextUrl, router]);

  const passwordsMismatch =
    mode === 'register' && confirmPassword.length > 0 && password !== confirmPassword;
  const passwordTooShort = mode === 'register' && password.length > 0 && password.length < 8;

  // Таб солиход өмнөх алдааны төлөв үлдэхгүй
  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setConfirmPassword('');
    setShowPassword(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    if (mode === 'register') {
      if (password !== confirmPassword) {
        toast.error('Нууц үг таарахгүй байна');
        return;
      }
      if (password.length < 8) {
        toast.error('Нууц үг доод тал нь 8 тэмдэгт байна');
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === 'login') await login(mail, password);
      else await register(mail, password, name.trim() || undefined);
      toast.success(mode === 'login' ? 'Тавтай морил!' : 'Бүртгэл амжилттай үүслээ');
      router.replace(nextUrl);
    } catch (err: any) {
      toast.error(err?.message ?? 'Алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-background">
      {/* Зүүн — cinematic brand хэсэг (desktop) */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(229,9,20,0.28),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(237,178,0,0.14),transparent_55%)]"
        />
        <div aria-hidden className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M0%2059h60M59%200v60%22%20stroke%3D%22%23ffffff08%22/%3E%3C/svg%3E')]" />
        <div className="relative z-10 max-w-md px-10">
          <p className="text-4xl font-black leading-tight text-white">
            Үз. Мэдэр.
            <br />
            <span className="text-primary">Дахин үз.</span>
          </p>
          <ul className="mt-8 space-y-3.5">
            {PERKS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-white/75">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <Check size={13} strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Баруун — форм */}
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          <h1 className="flex items-center">
            <BrandLogo logoUrl={logoUrl} siteName={siteName} imgClassName="h-11 w-auto" textSize="text-3xl" />
          </h1>
          <p className="mt-1.5 text-sm text-white/55">
            {mode === 'login' ? 'Дахин тавтай морил 👋' : 'Шинэ бүртгэл үүсгэх'}
          </p>

          {/* Login/Register segmented toggle */}
          <div className="mt-6 flex rounded-lg bg-white/6 p-1" role="tablist">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={cn(
                  'flex-1 rounded-md py-2 text-sm font-semibold transition-all',
                  mode === m ? 'bg-primary text-white shadow-lg' : 'text-white/55 hover:text-white',
                )}
              >
                {m === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}
              </button>
            ))}
          </div>

          {/* ⚠️ САНАМЖ — хэрэглэгч ямар үйлдэл хийх гэж байгаад ирснээ мэдэх
              ёстой. Эс бөгөөс нэвтэрсний дараа "би юу хийж байсан бэ?" гэж
              төөрнө. */}
          {cameFrom && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/8 px-3.5 py-2.5">
              <ArrowLeft size={15} className="mt-0.5 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-white/70">
                Нэвтэрсний дараа{' '}
                <strong className="font-semibold text-white">үргэлжлүүлж байсан үйлдэл рүүгээ</strong>{' '}
                буцна
              </p>
            </div>
          )}

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            {mode === 'register' && (
              <Field label="Нэр">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Таны нэр"
                  className="input-dark"
                />
              </Field>
            )}
            <Field label="Имэйл хаяг">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tanii@mail.mn"
                autoComplete="email"
                className="input-dark"
              />
            </Field>
            <Field label="Нууц үг">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Доод тал нь 8 тэмдэгт"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  aria-invalid={passwordTooShort}
                  className={cn('input-dark pr-11', passwordTooShort && 'input-dark-error')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Нууц үг нуух' : 'Нууц үг харах'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-white/40 transition-colors hover:text-white/80"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordTooShort && (
                <p className="mt-1.5 text-xs text-destructive">Доод тал нь 8 тэмдэгт байх ёстой</p>
              )}
            </Field>
            {mode === 'register' && (
              <Field label="Нууц үг давтах">
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Нууц үгээ дахин оруулна уу"
                  aria-invalid={passwordsMismatch}
                  className={cn('input-dark', passwordsMismatch && 'input-dark-error')}
                />
                {passwordsMismatch && (
                  <p className="mt-1.5 text-xs text-destructive">Нууц үг таарахгүй байна</p>
                )}
              </Field>
            )}

            <button
              type="submit"
              disabled={loading || passwordsMismatch}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-bold text-white transition-all hover:brightness-110 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.99] disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading
                ? mode === 'login'
                  ? 'Нэвтэрч байна...'
                  : 'Бүртгэж байна...'
                : mode === 'login'
                  ? 'Нэвтрэх'
                  : 'Бүртгэл үүсгэх'}
            </button>

            {/* Нэвтрэлт автоматаар санагдана (refresh token 30 хоног) */}
            <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-white/40">
              <ShieldCheck size={13} className="shrink-0 text-success" />
              Энэ төхөөрөмж дээр нэвтрэлт{' '}
              <strong className="font-semibold text-white/60">30 хоног</strong> санагдана
            </p>
          </form>

          {/* ⚠️ Social товч формын ДООР — дээр байвал Нэвтрэх/Бүртгүүлэх табтай
              зэрэгцэж 4 товч мэт харагддаг байсан */}
          <div className="mt-5">
            <SocialButtons callbackUrl={nextUrl} />
          </div>

          <p className="mt-5 text-center text-xs text-white/35">
            Үргэлжлүүлснээр та манай{' '}
            <Link href="/p/terms" className="text-white/55 underline hover:text-white/80">
              үйлчилгээний нөхцөл
            </Link>{' '}
            болон{' '}
            <Link href="/p/privacy" className="text-white/55 underline hover:text-white/80">
              нууцлалын бодлогыг
            </Link>{' '}
            зөвшөөрч байна.
          </p>
        </motion.div>
      </div>

      <style jsx global>{`
        .input-dark {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.04);
          padding: 0.72rem 1rem;
          color: white;
          outline: none;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .input-dark::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }
        .input-dark:focus {
          border-color: var(--primary);
          background: rgba(255, 255, 255, 0.07);
        }
        .input-dark-error {
          border-color: var(--destructive);
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/45">
        {label}
      </span>
      {children}
    </label>
  );
}
