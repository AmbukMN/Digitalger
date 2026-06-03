'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label } from '@digitalger/shared/ui';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { authApi } from '@/lib/api';
import { trackCompleteRegistration } from '@/lib/analytics';
import { OtpInput } from './otp-input';

function PasswordInput({ id, ...props }: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} className="pr-10" {...props} />
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

const loginSchema = z.object({
  email: z.string().email('Зөв и-мэйл оруулна уу'),
  password: z.string().min(6, 'Хамгийн багадаа 6 тэмдэгт'),
});

const signupSchema = loginSchema.extend({
  name: z.string().min(2, 'Нэр хэт богино').optional(),
});

type LoginValues = z.infer<typeof loginSchema>;
type SignupValues = z.infer<typeof signupSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginValues) => {
    const res = await signIn('credentials', {
      redirect: false,
      email: values.email,
      password: values.password,
    });
    if (res?.error) {
      toast.error('И-мэйл эсвэл нууц үг буруу');
      return;
    }
    toast.success('Амжилттай нэвтэрлээ');
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">И-мэйл</Label>
        <Input id="email" type="email" {...form.register('email')} />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Нууц үг</Label>
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Мартсан уу?
          </Link>
        </div>
        <PasswordInput id="password" {...form.register('password')} />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
      </Button>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', name: '' },
  });

  const onSubmit = async (values: SignupValues) => {
    try {
      await authApi.register({
        email: values.email,
        password: values.password,
        name: values.name,
      });
      trackCompleteRegistration();
      toast.success('Бүртгэл амжилттай. И-мэйл баталгаажуулна уу.');
      router.push('/login');
    } catch {
      toast.error('Бүртгэл амжилтгүй — и-мэйл давхардаж байж болно');
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Нэр</Label>
        <Input id="name" {...form.register('name')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">И-мэйл</Label>
        <Input id="email" type="email" {...form.register('email')} />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Нууц үг</Label>
        <PasswordInput id="password" {...form.register('password')} />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Бүртгэж байна...' : 'Бүртгүүлэх'}
      </Button>
    </form>
  );
}

type ForgotStep = 'email' | 'otp';

export function ForgotPasswordForm() {
  const router = useRouter();
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
    } catch {
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
      router.push('/login');
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('expired')) toast.error('Код хугацаа дуусжээ. Дахин илгээнэ үү.');
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
          {emailError && <p className="text-sm text-destructive">{emailError}</p>}
        </div>
        <Button type="button" className="w-full" onClick={handleSendOtp} disabled={sending}>
          {sending ? 'Илгээж байна...' : 'Код илгээх'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground text-center">
        <span className="font-medium text-foreground">{email}</span> руу код илгээлээ
      </p>

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
        {pwError && <p className="text-sm text-destructive">{pwError}</p>}
      </div>

      <Button
        type="button"
        className="w-full"
        onClick={handleReset}
        disabled={otp.length !== 6 || submitting}
      >
        {submitting ? 'Шинэчилж байна...' : 'Нууц үг шинэчлэх'}
      </Button>

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

// ResetPasswordForm is no longer needed as standalone — handled in ForgotPasswordForm above
// Keeping for backwards compatibility
export function ResetPasswordForm() {
  return <ForgotPasswordForm />;
}
