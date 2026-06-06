'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, Ghost, Mail, RotateCcw, X } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, Input, Label } from '@digitalger/shared/ui';
import { authApi } from '@/lib/api';
import {
  loadGuestSession,
  saveGuestSession,
  clearGuestSession,
} from '@/lib/guest-session';
import { OtpInput } from './otp-input';
import { BrowserSwitchModal } from '@/components/browser-switch-modal';
import { isInAppBrowser } from '@/lib/download-helper';

// "Зочноор нэвтрэх"-ийн үр дүн: амжилттай нэвтэрсэн эсэх.
//
// Логик:
//  - localStorage-д ХАДГАЛСАН зочин байгаа (tempPassword-тай) → тэр ХУУЧИН
//    зочин руугаа л орно (шинэ зочин үүсгэхгүй).
//  - localStorage хоосон → ШИНЭ зочин үүснэ.
//
// ⚠️ Зочин имэйл+нууц үг тохируулж БҮРЭН хэрэглэгч болоход (имэйл verify
// амжилттай болох үед) localStorage цэвэрлэгддэг (profile EmailChangeDialog →
// forgetGuestSession). Тиймээс бүрэн болсон зочин ЭНД дахин сэргэхгүй —
// "Зочноор нэвтрэх" дарвал шинэ зочин үүснэ, харин бүрэн хэрэглэгч нь зөвхөн
// login хуудсаар имэйл/нууц үгээрээ нэвтэрнэ.
async function loginAsGuestWithPersistence(
  router: ReturnType<typeof useRouter>,
  callbackUrl: string,
  onClose: () => void,
): Promise<boolean> {
  const stored = loadGuestSession();

  // Хадгалсан зочин байгаа (tempPassword-тай) → хуучин account руугаа орно.
  if (stored?.password) {
    const res = await signIn('credentials', {
      redirect: false,
      userId: stored.userId,
      password: stored.password,
    });
    if (!res?.error) {
      toast.success('Зочноор нэвтэрлээ.');
      onClose();
      router.push(callbackUrl);
      router.refresh();
      return true;
    }
    // tempPass буруу болсон (backend талд солигдсон г.м.) → цэвэрлээд шинээр.
    clearGuestSession();
  }

  // Хадгалсан зочин байхгүй (эсвэл хүчингүй) → ШИНЭ зочин үүснэ.
  const data = await authApi.loginAsGuest();
  saveGuestSession({ userId: data.user.id, password: data.tempPassword });
  const res = await signIn('credentials', {
    redirect: false,
    userId: data.user.id,
    password: data.tempPassword,
  });
  if (!res?.error) {
    toast.success('Зочноор нэвтэрлээ.');
    onClose();
    router.push(callbackUrl);
    router.refresh();
    return true;
  }
  return false;
}

function PasswordInput({ id, autoComplete, ...props }: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} className="pr-10" {...props} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={show ? 'Нуух' : 'Харуулах'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

type Tab = 'login' | 'signup';

const loginSchema = z.object({
  identifier: z.string().min(1, 'И-мэйл эсвэл утасны дугаар оруулна уу'),
  password: z.string().min(6, 'Хамгийн багадаа 6 тэмдэгт'),
});

const signupSchema = z.object({
  name: z.string().min(2, 'Нэр хамгийн багадаа 2 тэмдэгт'),
  phone: z.string().min(8, 'Утасны дугаар оруулна уу').regex(/^\+?[0-9]{8,15}$/, 'Утасны дугаар буруу'),
  email: z.string().email('Зөв и-мэйл оруулна уу'),
  password: z.string().min(8, 'Хамгийн багадаа 8 тэмдэгт'),
  confirmPassword: z.string().min(1, 'Нууц үг давтана уу'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Нууц үг таарахгүй байна',
  path: ['confirmPassword'],
});

type LoginValues = z.infer<typeof loginSchema>;
type SignupValues = z.infer<typeof signupSchema>;

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: Tab;
  callbackUrl?: string;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

function GuestButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <motion.div
      animate={{ x: [0, -3, 3, -3, 3, -1.5, 1.5, 0] }}
      transition={{ duration: 0.3, delay: 2, repeat: Infinity, repeatDelay: 5 }}
    >
      <button
        type="button"
        className="auth-guest-btn inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50"
        onClick={onClick}
        disabled={loading}
      >
        <Ghost className="h-4 w-4 shrink-0" />
        {loading ? 'Нэвтэрч байна...' : 'Бүртгэлгүйгээр шууд нэвтрэх'}
      </button>
    </motion.div>
  );
}

function LoginForm({ onClose, callbackUrl, onForgotPassword }: { onClose: () => void; callbackUrl?: string; onForgotPassword: () => void }) {
  const router = useRouter();
  const [guestLoading, setGuestLoading] = useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const onSubmit = async (values: LoginValues) => {
    const isPhone = /^\+?[0-9]{8,15}$/.test(values.identifier);
    const res = await signIn('credentials', {
      redirect: false,
      ...(isPhone ? { phone: values.identifier } : { email: values.identifier }),
      password: values.password,
    });
    if (res?.error) {
      toast.error('И-мэйл/утас эсвэл нууц үг буруу');
      return;
    }
    toast.success('Амжилттай нэвтэрлээ');
    onClose();
    router.push(callbackUrl ?? '/');
    router.refresh();
  };

  const handleGuest = async () => {
    setGuestLoading(true);
    try {
      const ok = await loginAsGuestWithPersistence(router, callbackUrl ?? '/', onClose);
      if (!ok) toast.error('Зочин нэвтрэхэд алдаа гарлаа');
    } catch {
      toast.error('Зочин нэвтрэхэд алдаа гарлаа');
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-id">И-мэйл эсвэл утас</Label>
        <Input
          id="login-id"
          type="text"
          autoComplete="username"
          placeholder="И-мэйл эсвэл утасны дугаар"
          {...form.register('identifier')}
        />
        <FieldError message={form.formState.errors.identifier?.message} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Нууц үг</Label>
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-xs text-primary hover:underline"
          >
            Нууц үгээ мартсан?
          </button>
        </div>
        <PasswordInput id="login-password" autoComplete="current-password" {...form.register('password')} />
        <FieldError message={form.formState.errors.password?.message} />
      </div>

      <button
        type="submit"
        className="auth-submit-btn inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
      </button>

      <GuestButton onClick={handleGuest} loading={guestLoading} />
    </form>
  );
}

interface SignupOtpScreenProps {
  email: string;
  password: string;
  onSuccess: () => void;
  onBack: () => void;
  callbackUrl?: string;
}

function SignupOtpScreen({ email, password, onSuccess, onBack, callbackUrl }: SignupOtpScreenProps) {
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      await authApi.verifySignupOtp({ email, otp });
      // Auto sign-in with email+password credentials
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });
      if (res?.error) {
        toast.success('И-мэйл баталгаажлаа! Нэвтэрнэ үү.');
        onBack();
        return;
      }
      toast.success('Тавтай морил! DigitalGer-д бүртгүүлсэнд баярлалаа 🎉');
      onSuccess();
      router.push(callbackUrl ?? '/');
      router.refresh();
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('expired')) {
        toast.error('Код хугацаа дуусжээ. Дахин илгээнэ үү.');
      } else if (msg.includes('attempts')) {
        toast.error('Оролдлогын тоо хэтэрлээ. Дахин илгээнэ үү.');
      } else {
        toast.error('Код буруу байна');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authApi.resendOtp({ email, purpose: 'verify' });
      toast.success('Шинэ код илгээлээ');
      setOtp('');
      setResendCountdown(60);
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('wait')) {
        toast.error(msg.includes('seconds') ? msg : 'Түр хүлээнэ үү');
      } else if (msg.includes('Too many')) {
        toast.error('Хэт олон хүсэлт. 1 цагийн дараа дахин оролдоно уу.');
      } else {
        toast.error('Код илгээхэд алдаа гарлаа');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mx-auto">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <h3 className="font-bold text-lg">И-мэйл баталгаажуулах</h3>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{email}</span> хаяг руу<br />
          6 оронтой код илгээлээ
        </p>
      </div>

      <OtpInput value={otp} onChange={setOtp} onComplete={handleVerify} autoFocus disabled={loading} />

      <button
        type="button"
        onClick={handleVerify}
        disabled={otp.length !== 6 || loading}
        className="auth-submit-btn inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50"
      >
        {loading ? 'Баталгаажуулж байна...' : 'Баталгаажуулах'}
      </button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Буцах
        </button>
        {resendCountdown > 0 ? (
          <span className="text-muted-foreground text-xs">{resendCountdown}с дараа дахин илгээх</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="flex items-center gap-1 text-primary hover:underline disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" />
            {resending ? 'Илгээж байна...' : 'Дахин илгээх'}
          </button>
        )}
      </div>
    </div>
  );
}

function SignupForm({ onClose, callbackUrl }: { onClose: () => void; callbackUrl?: string }) {
  const router = useRouter();
  const [guestLoading, setGuestLoading] = useState(false);
  const [otpData, setOtpData] = useState<{ email: string; password: string } | null>(null);
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', phone: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: SignupValues) => {
    try {
      await authApi.register({
        email: values.email,
        password: values.password,
        name: values.name,
        phone: values.phone,
      });
      setOtpData({ email: values.email, password: values.password });
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('Email already')) {
        form.setError('email', { message: 'Энэ и-мэйл аль хэдийн бүртгэлтэй байна' });
      } else if (msg.includes('Phone')) {
        form.setError('phone', { message: 'Энэ утасны дугаар бүртгэлтэй байна' });
      } else {
        toast.error('Бүртгэл амжилтгүй. Дахин оролдоно уу.');
      }
    }
  };

  const handleGuest = async () => {
    setGuestLoading(true);
    try {
      const ok = await loginAsGuestWithPersistence(router, callbackUrl ?? '/', onClose);
      if (!ok) toast.error('Зочин нэвтрэхэд алдаа гарлаа');
    } catch {
      toast.error('Зочин нэвтрэхэд алдаа гарлаа');
    } finally {
      setGuestLoading(false);
    }
  };

  if (otpData) {
    return (
      <SignupOtpScreen
        email={otpData.email}
        password={otpData.password}
        onSuccess={onClose}
        onBack={() => setOtpData(null)}
        callbackUrl={callbackUrl}
      />
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="signup-name">Нэр <span className="text-destructive">*</span></Label>
        <Input id="signup-name" autoComplete="name" placeholder="Таны бүтэн нэр" {...form.register('name')} />
        <FieldError message={form.formState.errors.name?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-phone">Утасны дугаар <span className="text-destructive">*</span></Label>
        <Input id="signup-phone" type="tel" autoComplete="tel" placeholder="99001122" {...form.register('phone')} />
        <FieldError message={form.formState.errors.phone?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-email">И-мэйл <span className="text-destructive">*</span></Label>
        <Input id="signup-email" type="email" autoComplete="email" placeholder="you@example.com" {...form.register('email')} />
        <FieldError message={form.formState.errors.email?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password">Нууц үг <span className="text-destructive">*</span></Label>
        <PasswordInput id="signup-password" autoComplete="new-password" placeholder="8+ тэмдэгт" {...form.register('password')} />
        <FieldError message={form.formState.errors.password?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-confirm">Нууц үг давтах <span className="text-destructive">*</span></Label>
        <PasswordInput id="signup-confirm" autoComplete="new-password" placeholder="Дахин оруулна уу" {...form.register('confirmPassword')} />
        <FieldError message={form.formState.errors.confirmPassword?.message} />
      </div>

      <button
        type="submit"
        className="auth-submit-btn inline-flex w-full items-center justify-center rounded-lg px-4 py-2 mt-1 text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? 'Бүртгэж байна...' : 'Бүртгүүлэх'}
      </button>

      <GuestButton onClick={handleGuest} loading={guestLoading} />
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
    </svg>
  );
}

function SocialButtons({ tab, callbackUrl }: { tab: Tab; callbackUrl?: string }) {
  const cb = callbackUrl ?? '/';
  const verb = tab === 'login' ? 'нэвтрэх' : 'бүртгүүлэх';

  return (
    <div className="space-y-2.5 pt-1">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">эсвэл</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl: cb })}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <GoogleIcon />
          Google
        </button>
        <button
          type="button"
          onClick={() => signIn('facebook', { callbackUrl: cb })}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <FacebookIcon />
          Facebook
        </button>
      </div>
    </div>
  );
}

export function AuthModal({ open, onClose, defaultTab = 'login', callbackUrl }: AuthModalProps) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  // FB/IG доторх браузар нь нэвтрэлт/төлбөрт тохиромжгүй (тусдаа орчин). Нэвтрэх
  // modal нээгдэхэд FB илэрвэл системийн браузар руу шилжүүлэх modal-руу шилжүүлнэ.
  const [switchOpen, setSwitchOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (isInAppBrowser()) {
        // FB/IG → нэвтрэх форм биш, шилжүүлэх modal харуулна
        setSwitchOpen(true);
      } else {
        setTab(defaultTab);
        setShowForgotPassword(false);
      }
    }
  }, [open, defaultTab]);

  // ⚠️ React hooks дүрэм: БҮХ hook нь ямар ч early return-аас ӨМНӨ дуудагдах
  // ёстой. Тиймээс Escape listener-ийг доорх switchOpen early return-аас ӨМНӨ
  // байрлуулна (эс бол FB-д switchOpen=true болоход hook count буурч крэш болно).
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // FB/IG илэрсэн бол нэвтрэх форм биш — шилжүүлэх modal л харуулна.
  // Intent: шинэ браузарт нэвтрэх modal АВТОМАТ нээгдэх ёстой (хэрэглэгч нэвтрэх
  // гэж байсан). targetPath-д ?showAuth=1 нэмж дамжуулна — providers тэр query-г
  // уншиж AuthModal-ийг автомат нээнэ. callbackUrl байвал нэвтэрсний дараа тийш
  // (autopay гэх мэт), эс бол одоо байгаа хуудсанд буцаж нэвтрэх modal нээнэ.
  if (open && switchOpen) {
    const base = callbackUrl ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
    const sep = base.includes('?') ? '&' : '?';
    const switchTarget = `${base}${sep}showAuth=1`;
    return (
      <BrowserSwitchModal
        open
        onClose={() => { setSwitchOpen(false); onClose(); }}
        targetPath={switchTarget}
      />
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card dark:bg-popover p-6 shadow-2xl"
            role="dialog"
            aria-modal
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {showForgotPassword ? 'Нууц үг сэргээх' : tab === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}
              </h2>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Хаах">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {!showForgotPassword && (
              <div className="mt-4 flex rounded-lg bg-muted p-1">
                {(['login', 'signup'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                      tab === t
                        ? 'bg-popover text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setTab(t)}
                  >
                    {t === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-5">
              {showForgotPassword ? (
                <ForgotPasswordModalFlow onBack={() => setShowForgotPassword(false)} />
              ) : tab === 'login' ? (
                <LoginForm onClose={onClose} callbackUrl={callbackUrl} onForgotPassword={() => setShowForgotPassword(true)} />
              ) : (
                <SignupForm onClose={onClose} callbackUrl={callbackUrl} />
              )}
            </div>

            {!showForgotPassword && (
              <SocialButtons tab={tab} callbackUrl={callbackUrl} />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Forgot password flow embedded inside auth modal
type ForgotStep = 'email' | 'otp';

function ForgotPasswordModalFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<ForgotStep>('email');
  const [email, setEmail] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sending, setSending] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const handleSendOtp = async () => {
    const v = emailInput.trim();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      setEmailError('Зөв и-мэйл оруулна уу');
      return;
    }
    setEmailError('');
    setSending(true);
    try {
      await authApi.forgotPassword(v);
      setEmail(v);
      setResendCountdown(60);
      setStep('otp');
    } catch (err: any) {
      // Бүртгэлгүй/зочин/OAuth имэйлд тодорхой алдаа (OTP алхам руу орохгүй)
      const raw = err?.message ?? '';
      let msg = 'Алдаа гарлаа. Дахин оролдоно уу.';
      if (raw.includes('бүртгэл олдсонгүй') || raw.toLowerCase().includes('not found'))
        msg = 'Энэ имэйлээр бүртгэл олдсонгүй';
      else if (raw.includes('нийгмийн сүлжээ') || raw.toLowerCase().includes('oauth'))
        msg = 'Энэ бүртгэл нийгмийн сүлжээгээр нэвтэрдэг тул нууц үг сэргээх боломжгүй';
      else if (raw && !raw.includes('{')) msg = raw;
      setEmailError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authApi.resendOtp({ email, purpose: 'reset' });
      toast.success('Шинэ код илгээлээ');
      setOtp('');
      setResendCountdown(60);
    } catch (err: any) {
      toast.error('Код илгээхэд алдаа гарлаа');
    } finally {
      setResending(false);
    }
  };

  const handleReset = async () => {
    if (otp.length !== 6) { toast.error('6 оронтой код оруулна уу'); return; }
    if (newPassword.length < 8) { setPwError('Хамгийн багадаа 8 тэмдэгт'); return; }
    if (newPassword !== confirmPassword) { setPwError('Нууц үг таарахгүй байна'); return; }
    setPwError('');
    setSubmitting(true);
    try {
      await authApi.resetPassword({ email, otp, newPassword });
      toast.success('Нууц үг амжилттай шинэчлэгдлээ. Нэвтэрнэ үү.');
      onBack();
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('expired')) toast.error('Код хугацаа дуусжээ');
      else if (msg.includes('Invalid')) toast.error('Код буруу байна');
      else toast.error('Алдаа гарлаа');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'email') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Бүртгэлтэй и-мэйл хаягаа оруулна уу. Нэг удаагийн код илгээнэ.</p>
        <div className="space-y-2">
          <Label htmlFor="forgot-email">И-мэйл</Label>
          <Input
            id="forgot-email"
            type="email"
            autoFocus
            autoComplete="email"
            placeholder="you@example.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSendOtp(); }}
          />
          {emailError && <p className="text-xs text-destructive">{emailError}</p>}
        </div>
        <button
          type="button"
          onClick={handleSendOtp}
          disabled={sending}
          className="auth-submit-btn inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50"
        >
          {sending ? 'Илгээж байна...' : 'Код илгээх'}
        </button>
        <button type="button" onClick={onBack} className="w-full text-sm text-muted-foreground hover:text-foreground text-center">
          ← Нэвтрэх хуудас руу буцах
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{email}</span> руу код илгээлээ
        </p>
      </div>

      <OtpInput value={otp} onChange={setOtp} onComplete={() => { document.getElementById('new-pw')?.focus(); }} autoFocus />

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="new-pw">Шинэ нууц үг</Label>
          <PasswordInput id="new-pw" autoComplete="new-password" placeholder="8+ тэмдэгт" value={newPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-pw">Нууц үг давтах</Label>
          <PasswordInput id="confirm-pw" autoComplete="new-password" placeholder="Дахин оруулна уу" value={confirmPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)} />
        </div>
        {pwError && <p className="text-xs text-destructive">{pwError}</p>}
      </div>

      <button
        type="button"
        onClick={handleReset}
        disabled={otp.length !== 6 || submitting}
        className="auth-submit-btn inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50"
      >
        {submitting ? 'Шинэчилж байна...' : 'Нууц үг шинэчлэх'}
      </button>

      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={() => setStep('email')} className="text-muted-foreground hover:text-foreground transition-colors">← Буцах</button>
        {resendCountdown > 0 ? (
          <span className="text-muted-foreground text-xs">{resendCountdown}с дараа дахин илгээх</span>
        ) : (
          <button type="button" onClick={handleResend} disabled={resending} className="flex items-center gap-1 text-primary hover:underline disabled:opacity-50">
            <RotateCcw className="h-3 w-3" />
            {resending ? 'Илгээж байна...' : 'Дахин илгээх'}
          </button>
        )}
      </div>
    </div>
  );
}
