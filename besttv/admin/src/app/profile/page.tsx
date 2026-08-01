'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Eye, EyeOff, KeyRound, Loader2, Mail, Save, User } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { api } from '@/lib/api';
import { uploadImage } from '@/lib/upload';
import { useAdminAuth } from '@/lib/auth-store';

export default function AdminProfilePage() {
  const { user, refreshMe } = useAdminAuth();

  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [showEmailPw, setShowEmailPw] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ⚠️ user нь async ирдэг тул useState-ийн эхний утга хоцордог
  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setEmail(user.email);
    }
  }, [user]);

  if (!user) {
    return (
      <AdminShell>
        <AdminTopbar title="Профайл" />
        <main className="flex items-center justify-center p-8 pt-16 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
        </main>
      </AdminShell>
    );
  }

  const initial = (user.name?.[0] ?? user.email[0]).toUpperCase();
  const nameDirty = name.trim() !== (user.name ?? '');
  const emailDirty = email.trim().toLowerCase() !== user.email.toLowerCase();

  const saveName = async () => {
    setSavingName(true);
    try {
      await api('/auth/me', { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) });
      await refreshMe();
      toast.success('Нэр шинэчлэгдлээ');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Хадгалж чадсангүй');
    } finally {
      setSavingName(false);
    }
  };

  const saveEmail = async () => {
    if (!emailPassword) {
      toast.error('Одоогийн нууц үгээ оруулна уу');
      return;
    }
    setSavingEmail(true);
    try {
      await api('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ email: email.trim(), currentPassword: emailPassword }),
      });
      await refreshMe();
      setEmailPassword('');
      toast.success('Имэйл шинэчлэгдлээ');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Солиж чадсангүй');
    } finally {
      setSavingEmail(false);
    }
  };

  const savePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Шинэ нууц үг доод тал нь 8 тэмдэгт байна');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Нууц үг таарахгүй байна');
      return;
    }
    setSavingPassword(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Нууц үг солигдлоо');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Солиж чадсангүй');
    } finally {
      setSavingPassword(false);
    }
  };

  const onAvatar = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const res = await uploadImage(file, 'avatar').promise;
      await api('/auth/me', { method: 'PATCH', body: JSON.stringify({ avatarKey: res.key }) });
      await refreshMe();
      toast.success('Зураг шинэчлэгдлээ');
    } catch {
      // toast-ыг helper харуулсан
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const pwMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const pwTooShort = newPassword.length > 0 && newPassword.length < 8;

  return (
    <AdminShell>
      <AdminTopbar title="Профайл" subtitle="Өөрийн мэдээллийг засах" />

      <main className="max-w-3xl p-8 pt-6">
        {/* ── Хэрэглэгчийн карт ── */}
        <div className="admin-card flex items-center gap-4 rounded-xl p-5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onAvatar(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Профайл зураг солих"
            className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xl font-bold text-primary-foreground"
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
              {uploadingAvatar ? (
                <Loader2 size={18} className="animate-spin text-white" />
              ) : (
                <Camera size={18} className="text-white" />
              )}
            </span>
          </button>

          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-foreground">{user.name ?? 'Админ'}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Check size={10} /> Администратор
            </span>
          </div>
        </div>

        {/* ── Нэр ── */}
        <Section icon={User} title="Нэр">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Харагдах нэр" className="min-w-56 flex-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Таны нэр"
                maxLength={60}
                aria-label="Харагдах нэр"
                className="admin-input"
              />
            </Field>
            <button
              onClick={saveName}
              disabled={savingName || !nameDirty}
              className="btn-primary"
            >
              {savingName ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Хадгалах
            </button>
          </div>
        </Section>

        {/* ── Имэйл ── */}
        <Section
          icon={Mail}
          title="Имэйл хаяг"
          hint="Солихын тулд одоогийн нууц үгээ баталгаажуулна"
        >
          <div className="space-y-3">
            <Field label="Имэйл">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Имэйл хаяг"
                autoComplete="email"
                className="admin-input"
              />
            </Field>

            {emailDirty && (
              <div className="rounded-lg border border-premium/30 bg-premium/8 p-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  ⚠️ Имэйл солиход <strong className="text-foreground">энэ шинэ хаягаар</strong>{' '}
                  нэвтрэх болно. Баталгаажуулахын тулд нууц үгээ оруулна уу.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Одоогийн нууц үг" className="min-w-56 flex-1">
                    <div className="relative">
                      <input
                        type={showEmailPw ? 'text' : 'password'}
                        value={emailPassword}
                        onChange={(e) => setEmailPassword(e.target.value)}
                        placeholder="••••••••"
                        aria-label="Одоогийн нууц үг"
                        autoComplete="current-password"
                        className="admin-input pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmailPw((v) => !v)}
                        aria-label={showEmailPw ? 'Нуух' : 'Харах'}
                        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground"
                      >
                        {showEmailPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </Field>
                  <button
                    onClick={saveEmail}
                    disabled={savingEmail || !emailPassword}
                    className="btn-primary"
                  >
                    {savingEmail ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    Имэйл солих
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ── Нууц үг ── */}
        <Section icon={KeyRound} title="Нууц үг солих">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Одоогийн">
              <input
                type={showPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                aria-label="Одоогийн нууц үг"
                autoComplete="current-password"
                className="admin-input"
              />
            </Field>
            <Field label="Шинэ (8+ тэмдэгт)">
              <input
                type={showPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                aria-label="Шинэ нууц үг"
                autoComplete="new-password"
                aria-invalid={pwTooShort}
                className={cn('admin-input', pwTooShort && 'border-destructive')}
              />
            </Field>
            <Field label="Давтах">
              <input
                type={showPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                aria-label="Шинэ нууц үг давтах"
                autoComplete="new-password"
                aria-invalid={pwMismatch}
                className={cn('admin-input', pwMismatch && 'border-destructive')}
              />
            </Field>
          </div>

          {pwMismatch && (
            <p className="mt-2 text-xs text-destructive">Нууц үг таарахгүй байна</p>
          )}

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={savePassword}
              disabled={
                savingPassword || !currentPassword || newPassword.length < 8 || pwMismatch
              }
              className="btn-primary"
            >
              {savingPassword ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <KeyRound size={14} />
              )}
              Нууц үг солих
            </button>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showPw}
                onChange={(e) => setShowPw(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-input"
              />
              Нууц үг харах
            </label>
          </div>
        </Section>
      </main>
    </AdminShell>
  );
}

function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof User;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-card mt-4 rounded-xl p-5">
      <div className="mb-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Icon size={14} className="text-primary" />
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
