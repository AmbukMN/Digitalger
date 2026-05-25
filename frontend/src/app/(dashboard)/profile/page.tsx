'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Loading,
} from '@digitalger/shared/ui';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Camera, Check, Eye, EyeOff, Ghost, KeyRound, LogOut, Mail, Pencil, RotateCcw, Shield, X } from 'lucide-react';
import Image from 'next/image';
import { usersApi, authApi } from '@/lib/api';
import { API_URL } from '@/lib/constants';
import type { AuthUser } from '@/types/api';
import { OtpInput } from '@/components/auth/otp-input';

// ── Password schemas ──────────────────────────────────────────
const setPasswordSchema = z
  .object({
    email: z.string().email('Зөв и-мэйл оруулна уу'),
    newPassword: z.string().min(8, 'Хамгийн багадаа 8 тэмдэгт'),
    confirm: z.string().min(1, 'Нууц үг давтана уу'),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Нууц үг таарахгүй байна',
    path: ['confirm'],
  });

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Одоогийн нууц үг оруулна уу'),
    newPassword: z.string().min(8, 'Хамгийн багадаа 8 тэмдэгт'),
    confirm: z.string().min(1, 'Нууц үг давтана уу'),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Нууц үг таарахгүй байна',
    path: ['confirm'],
  });

type SetPasswordValues = z.infer<typeof setPasswordSchema>;
type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

function PasswordField({
  id,
  ...props
}: React.ComponentProps<typeof Input> & { id: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} className="pr-10" {...props} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

function UserAvatar({
  image,
  name,
  isGuest,
  token,
  size = 'md',
  onUploaded,
}: {
  image?: string | null;
  name?: string | null;
  isGuest?: boolean;
  token?: string;
  size?: 'md' | 'lg';
  onUploaded?: (newImageUrl: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const dim = size === 'lg' ? 'h-24 w-24' : 'h-16 w-16';
  const initSize = size === 'lg' ? 'text-3xl' : 'text-xl';

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_URL}/api/users/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error('Upload failed');
      const updated: AuthUser = await res.json();
      toast.success('Зураг шинэчлэгдлээ');
      onUploaded?.(updated.image ?? '');
    } catch {
      toast.error('Зураг ачаалахад алдаа гарлаа');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const avatarEl = isGuest ? (
    <div
      className={`flex ${dim} items-center justify-center rounded-full bg-muted text-muted-foreground ring-4 ring-background`}
    >
      <Ghost className={size === 'lg' ? 'h-10 w-10' : 'h-7 w-7'} />
    </div>
  ) : image ? (
    <Image
      src={image}
      alt={name ?? 'Профайл'}
      width={size === 'lg' ? 96 : 64}
      height={size === 'lg' ? 96 : 64}
      className={`${dim} rounded-full object-cover ring-4 ring-background`}
    />
  ) : (
    <div
      className={`flex ${dim} items-center justify-center rounded-full bg-primary/20 ${initSize} font-bold text-primary ring-4 ring-background`}
    >
      {name ? name.charAt(0).toUpperCase() : '?'}
    </div>
  );

  return (
    <div className="relative shrink-0">
      {avatarEl}
      {!isGuest && token && (
        <>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors disabled:opacity-60"
            title="Зураг солих"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? '—'}</span>
    </div>
  );
}

function PasswordDialog({
  token,
  isGuest,
  currentEmail,
}: {
  token: string;
  isGuest: boolean;
  currentEmail?: string | null;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const setForm = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { email: currentEmail ?? '', newPassword: '', confirm: '' },
  });

  const changeForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  const mutation = useMutation({
    mutationFn: (body: { email?: string; currentPassword?: string; newPassword: string }) =>
      usersApi.updatePassword(token, body),
    onSuccess: async (_data, variables) => {
      toast.success(isGuest ? 'Бүртгэл амжилттай үүслээ!' : 'Нууц үг амжилттай солигдлоо');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      if (isGuest && variables.email && variables.newPassword) {
        await signIn('credentials', {
          redirect: false,
          email: variables.email,
          password: variables.newPassword,
        });
      }
    },
    onError: (err: any) => {
      const msg = err?.message ?? '';
      try {
        const parsed = JSON.parse(msg);
        toast.error(parsed?.message ?? 'Алдаа гарлаа');
      } catch {
        if (msg.toLowerCase().includes('email')) toast.error('Энэ и-мэйл аль хэдийн бүртгэлтэй байна');
        else if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('нууц')) toast.error('Одоогийн нууц үг буруу байна');
        else toast.error('Алдаа гарлаа. Дахин оролдоно уу.');
      }
    },
  });

  function handleClose(val: boolean) {
    if (!val) {
      setForm.reset();
      changeForm.reset();
    }
    setOpen(val);
  }

  const onSetSubmit = (values: SetPasswordValues) => {
    mutation.mutate({ email: values.email, newPassword: values.newPassword });
  };

  const onChangeSubmit = (values: ChangePasswordValues) => {
    mutation.mutate({ currentPassword: values.currentPassword, newPassword: values.newPassword });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <KeyRound className="h-3.5 w-3.5" />
        {isGuest ? 'Бүтэн бүртгэл үүсгэх' : 'Нууц үг солих'}
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {isGuest ? 'Бүтэн бүртгэл үүсгэх' : 'Нууц үг солих'}
            </DialogTitle>
          </DialogHeader>

          {isGuest ? (
            <form className="space-y-4" onSubmit={setForm.handleSubmit(onSetSubmit)}>
              <p className="text-sm text-muted-foreground">
                И-мэйл болон нууц үг тохируулж бүрэн бүртгэл болгоно уу.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="sp-email">И-мэйл</Label>
                <Input id="sp-email" type="email" placeholder="you@example.com" {...setForm.register('email')} />
                <FieldError message={setForm.formState.errors.email?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-pw">Нууц үг</Label>
                <PasswordField id="sp-pw" placeholder="8+ тэмдэгт" {...setForm.register('newPassword')} />
                <FieldError message={setForm.formState.errors.newPassword?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-confirm">Нууц үг давтах</Label>
                <PasswordField id="sp-confirm" placeholder="Дахин оруулна уу" {...setForm.register('confirm')} />
                <FieldError message={setForm.formState.errors.confirm?.message} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" className="gap-1.5 flex-1" disabled={mutation.isPending}>
                  <Check className="h-3.5 w-3.5" />
                  {mutation.isPending ? 'Хадгалж байна...' : 'Бүртгэл үүсгэх'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)}>
                  Болих
                </Button>
              </div>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={changeForm.handleSubmit(onChangeSubmit)}>
              <div className="space-y-1.5">
                <Label htmlFor="cp-current">Одоогийн нууц үг</Label>
                <PasswordField id="cp-current" placeholder="Одоогийн нууц үг" {...changeForm.register('currentPassword')} />
                <FieldError message={changeForm.formState.errors.currentPassword?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-new">Шинэ нууц үг</Label>
                <PasswordField id="cp-new" placeholder="8+ тэмдэгт" {...changeForm.register('newPassword')} />
                <FieldError message={changeForm.formState.errors.newPassword?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-confirm">Шинэ нууц үг давтах</Label>
                <PasswordField id="cp-confirm" placeholder="Дахин оруулна уу" {...changeForm.register('confirm')} />
                <FieldError message={changeForm.formState.errors.confirm?.message} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" className="gap-1.5 flex-1" disabled={mutation.isPending}>
                  <Check className="h-3.5 w-3.5" />
                  {mutation.isPending ? 'Хадгалж байна...' : 'Нууц үг солих'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)}>
                  Болих
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmailVerifySection({
  email,
  emailVerified,
  token,
  onVerified,
}: {
  email: string;
  emailVerified: Date | null | undefined;
  token: string;
  onVerified: () => void;
}) {
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const handleSendOtp = async () => {
    setSending(true);
    try {
      await authApi.sendVerifyOtp(token);
      setShowOtp(true);
      setResendCountdown(60);
      toast.success('Код илгээлээ');
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('already')) toast.error('И-мэйл аль хэдийн баталгаажсан байна');
      else toast.error('Код илгээхэд алдаа гарлаа');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setVerifying(true);
    try {
      await authApi.verifyEmail(token, otp);
      toast.success('И-мэйл амжилттай баталгаажлаа!');
      onVerified();
      setShowOtp(false);
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('expired')) toast.error('Код хугацаа дуусжээ. Дахин илгээнэ үү.');
      else if (msg.includes('attempts')) toast.error('Оролдлогын тоо хэтэрлээ. Дахин илгээнэ үү.');
      else toast.error('Код буруу байна');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authApi.resendOtp({ email, purpose: 'verify' });
      toast.success('Шинэ код илгээлээ');
      setOtp('');
      setResendCountdown(60);
    } catch {
      toast.error('Код илгээхэд алдаа гарлаа');
    } finally {
      setResending(false);
    }
  };

  if (emailVerified) {
    return (
      <div className="flex items-center gap-2 py-3">
        <span className="text-sm text-muted-foreground">И-мэйл</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm font-medium">{email}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
            <Check className="h-3 w-3" />
            Баталгаажсан
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="py-3 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{email}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              Баталгаажаагүй
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">И-мэйл хаягаа баталгаажуулна уу</p>
        </div>
        {!showOtp && (
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={handleSendOtp} disabled={sending}>
            <Mail className="h-3.5 w-3.5" />
            {sending ? 'Илгээж байна...' : 'Баталгаажуулах'}
          </Button>
        )}
      </div>

      {showOtp && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
          <p className="text-xs text-muted-foreground text-center">И-мэйлд ирсэн 6 оронтой кодыг оруулна уу</p>
          <OtpInput value={otp} onChange={setOtp} autoFocus disabled={verifying} />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleVerify} disabled={otp.length !== 6 || verifying}>
              {verifying ? 'Баталгаажуулж байна...' : 'Баталгаажуулах'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowOtp(false); setOtp(''); }}>
              Болих
            </Button>
          </div>
          <div className="flex justify-end">
            {resendCountdown > 0 ? (
              <span className="text-xs text-muted-foreground">{resendCountdown}с дараа дахин илгээх</span>
            ) : (
              <button type="button" onClick={handleResend} disabled={resending} className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50">
                <RotateCcw className="h-3 w-3" />
                {resending ? 'Илгээж байна...' : 'Дахин илгээх'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const token = session?.accessToken;

  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ['me', token],
    queryFn: () => usersApi.me(token!),
    enabled: !!token,
  });

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? '',
        phone: user.phone ?? '',
        email: user.email ?? '',
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!token) throw new Error('Нэвтэрч орно уу');
      const canEditEmail = user?.isGuest || !user?.oauthProvider;
      const body: Record<string, string | null> = {
        name: form.name,
        phone: form.phone.trim() || null,
      };
      if (canEditEmail) {
        body.email = form.email.trim() || null;
      }
      return usersApi.updateMe(token, body as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Профайл хадгалагдлаа');
      setEditMode(false);
    },
    onError: (err: any) => {
      const raw = err?.message ?? '';
      let msg = 'Хадгалахад алдаа гарлаа';
      try {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed?.message) ? parsed.message : null;
        const m: string = arr ? arr.join(', ') : (parsed?.message ?? '');
        if (m.toLowerCase().includes('phone') || raw.toLowerCase().includes('phone')) {
          msg = 'Энэ утасны дугаар бүртгэлтэй байна';
        } else if (m.toLowerCase().includes('email') || raw.toLowerCase().includes('email')) {
          msg = 'Энэ и-мэйл бүртгэлтэй байна';
        } else if (parsed?.statusCode === 401 || m.toLowerCase().includes('unauthorized')) {
          msg = 'Нэвтрэлт дууссан, дахин нэвтэрнэ үү';
        } else if (m) {
          msg = m;
        }
      } catch {
        if (raw.toLowerCase().includes('phone')) msg = 'Энэ утасны дугаар бүртгэлтэй байна';
        else if (raw.toLowerCase().includes('email')) msg = 'Энэ и-мэйл бүртгэлтэй байна';
        else if (raw.includes('401') || raw.toLowerCase().includes('unauthorized'))
          msg = 'Нэвтрэлт дууссан, дахин нэвтэрнэ үү';
      }
      toast.error(msg);
    },
  });

  if (!session) return null;
  if (isLoading) return <Loading className="mt-8" />;

  const isGuest = user?.isGuest ?? session.user?.email?.endsWith('@guest.digitalger.mn') ?? false;
  const provider = user?.oauthProvider ?? (session.user as any)?.oauthProvider ?? null;
  const emailVerified: Date | null = user?.emailVerified ? new Date(user.emailVerified as any) : null;
  const canEditEmail = isGuest || !provider;
  const displayName = user?.name ?? (isGuest ? 'Зочин' : session.user?.email ?? '—');

  const joined = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('mn-MN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Hero card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Gradient banner */}
        <div className="h-28 bg-linear-to-br from-primary/30 via-primary/15 to-primary/5" />

        <div className="px-5 pb-5">
          {/* Avatar overlapping banner */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
            <UserAvatar
              image={user?.image ?? session.user?.image}
              name={displayName}
              isGuest={isGuest}
              token={token}
              size="lg"
              onUploaded={async (newImageUrl) => {
                await updateSession({ picture: newImageUrl });
                queryClient.invalidateQueries({ queryKey: ['me'] });
                router.refresh();
              }}
            />
            <div className="min-w-0 sm:pb-1">
              <h2 className="text-xl font-bold truncate">{displayName}</h2>
              {!isGuest && (
                <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-2">
                {provider && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    {provider.charAt(0).toUpperCase() + provider.slice(1)}-ээр нэвтэрсэн
                  </span>
                )}
                {joined && (
                  <span className="text-xs text-muted-foreground">{joined}-с гишүүн</span>
                )}
              </div>
            </div>
          </div>

          {isGuest && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Та зочноор нэвтэрсэн байна. И-мэйл болон нууц үг тохируулж бүтэн бүртгэл болгосноор худалдан авалтын түүх, давуу эрхтэй болно.
            </div>
          )}
        </div>
      </div>

      {/* Edit info card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Хувийн Мэдээлэл</h3>
          {!editMode && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setEditMode(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Засах
            </Button>
          )}
        </div>

        <div className="px-5">
          {editMode ? (
            <form
              className="space-y-4 py-4"
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Нэр</Label>
                <Input
                  id="edit-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Нэрээ оруулна уу"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Утасны дугаар</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="99001122"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-email">
                  И-мэйл
                  {!canEditEmail && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      (OAuth бүртгэлд засах боломжгүй)
                    </span>
                  )}
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={!canEditEmail}
                  className={!canEditEmail ? 'bg-muted' : ''}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" className="gap-1.5" disabled={updateMutation.isPending}>
                  <Check className="h-3.5 w-3.5" />
                  {updateMutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setEditMode(false);
                    setForm({
                      name: user?.name ?? '',
                      phone: user?.phone ?? '',
                      email: user?.email ?? '',
                    });
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  Цуцлах
                </Button>
              </div>
            </form>
          ) : (
            <div className="divide-y divide-border/60">
              <InfoRow label="Нэр" value={user?.name} />
              <InfoRow label="Утас" value={user?.phone} />
              <InfoRow label="И-мэйл" value={isGuest ? null : user?.email} />
            </div>
          )}
        </div>
      </div>

      {/* Account card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Бүртгэлийн Мэдээлэл</h3>
        </div>
        <div className="px-5 divide-y divide-border/60">
          <InfoRow
            label="Эрх"
            value={
              <span className={user?.role === 'ADMIN' ? 'text-primary font-semibold' : undefined}>
                {user?.role === 'ADMIN' ? 'Админ' : 'Хэрэглэгч'}
              </span>
            }
          />
          <InfoRow
            label="Нэвтрэх арга"
            value={
              <span className="capitalize">
                {provider ?? (isGuest ? 'Зочин' : 'И-мэйл / нууц үг')}
              </span>
            }
          />
          <InfoRow label="Бүртгүүлсэн" value={joined} />
          {!isGuest && !provider && user?.email && token && (
            <EmailVerifySection
              email={user.email}
              emailVerified={emailVerified}
              token={token}
              onVerified={async () => {
                await updateSession({ emailVerified: new Date().toISOString() });
                queryClient.invalidateQueries({ queryKey: ['me'] });
              }}
            />
          )}
        </div>
        <div className="flex items-center gap-2 px-5 py-4">
          {!provider && token && (
            <PasswordDialog token={token} isGuest={isGuest} currentEmail={user?.email} />
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            <LogOut className="h-3.5 w-3.5" />
            Гарах
          </Button>
        </div>
      </div>
    </div>
  );
}
