'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Input,
  Label,
  Loading,
  Separator,
} from '@digitalger/shared/ui';
import { Camera, Check, Eye, EyeOff, KeyRound, Pencil, X } from 'lucide-react';
import { adminApi } from '@/lib/api';
import type { AdminProfile } from '@/types/admin';

// ── Schemas ───────────────────────────────────────────────────
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Одоогийн нууц үгийг оруулна уу'),
    newPassword: z.string().min(8, 'Хамгийн багадаа 8 тэмдэгт'),
    confirm: z.string().min(1, 'Нууц үг давтана уу'),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Нууц үг таарахгүй байна',
    path: ['confirm'],
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

// ── Helpers ───────────────────────────────────────────────────
function PasswordField({ id, ...props }: React.ComponentProps<typeof Input> & { id: string }) {
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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? '—'}</span>
    </div>
  );
}

// ── Avatar component ──────────────────────────────────────────
function AdminAvatar({ profile, onUploaded }: { profile: AdminProfile; onUploaded: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const updated = await adminApi.profile.uploadAvatar(file);
      toast.success('Зураг шинэчлэгдлээ');
      onUploaded(updated.image ?? '');
    } catch {
      toast.error('Зураг ачаалахад алдаа гарлаа');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="relative shrink-0">
      {profile.image ? (
        <Image
          src={profile.image}
          alt={profile.name ?? 'Admin'}
          width={80}
          height={80}
          className="h-20 w-20 rounded-full object-cover ring-4 ring-background"
          unoptimized
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-3xl font-bold text-primary ring-4 ring-background">
          {(profile.name ?? profile.email).charAt(0).toUpperCase()}
        </div>
      )}
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors disabled:opacity-60"
        title="Зураг солих"
      >
        <Camera className="h-3.5 w-3.5" />
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── Password Dialog ───────────────────────────────────────────
function PasswordDialog() {
  const [open, setOpen] = useState(false);
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordValues) =>
      adminApi.profile.updatePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      toast.success('Нууц үг амжилттай солигдлоо');
      setOpen(false);
      form.reset();
    },
    onError: (err: any) => {
      const msg = err?.message ?? '';
      try {
        const parsed = JSON.parse(msg);
        toast.error(parsed?.message ?? 'Алдаа гарлаа');
      } catch {
        if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('нууц')) {
          toast.error('Одоогийн нууц үг буруу байна');
        } else {
          toast.error('Алдаа гарлаа. Дахин оролдоно уу.');
        }
      }
    },
  });

  function handleClose(val: boolean) {
    if (!val) form.reset();
    setOpen(val);
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <KeyRound className="h-3.5 w-3.5" />
        Нууц үг солих
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Нууц үг солих</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          >
            <div className="space-y-1.5">
              <Label htmlFor="cp-current">Одоогийн нууц үг</Label>
              <PasswordField id="cp-current" placeholder="Одоогийн нууц үг" {...form.register('currentPassword')} />
              <FieldError message={form.formState.errors.currentPassword?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-new">Шинэ нууц үг</Label>
              <PasswordField id="cp-new" placeholder="8+ тэмдэгт" {...form.register('newPassword')} />
              <FieldError message={form.formState.errors.newPassword?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-confirm">Шинэ нууц үг давтах</Label>
              <PasswordField id="cp-confirm" placeholder="Дахин оруулна уу" {...form.register('confirm')} />
              <FieldError message={form.formState.errors.confirm?.message} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" className="flex-1 gap-1.5" disabled={mutation.isPending}>
                <Check className="h-3.5 w-3.5" />
                {mutation.isPending ? 'Хадгалж байна...' : 'Солих'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)}>
                Болих
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function AccountPage() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'profile'],
    queryFn: () => adminApi.profile.get(),
  });

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });

  function startEdit() {
    if (!profile) return;
    setForm({ name: profile.name ?? '', email: profile.email });
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      adminApi.profile.update({ name: form.name.trim() || undefined, email: form.email.trim() || undefined }),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin', 'profile'], data);
      toast.success('Профайл хадгалагдлаа');
      setEditMode(false);
    },
    onError: (err: any) => {
      const msg = err?.message ?? '';
      try {
        const parsed = JSON.parse(msg);
        toast.error(parsed?.message ?? 'Хадгалахад алдаа гарлаа');
      } catch {
        if (msg.toLowerCase().includes('email')) toast.error('Энэ и-мэйл аль хэдийн бүртгэлтэй байна');
        else toast.error('Хадгалахад алдаа гарлаа');
      }
    },
  });

  if (isLoading) return <Loading label="Профайл ачаалж байна..." />;
  if (isError || !profile)
    return <ErrorState title="Профайл ачаалахад алдаа" onRetry={() => refetch()} />;

  const joined = new Date(profile.createdAt).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Миний бүртгэл</h1>
        <p className="text-sm text-muted-foreground">Профайл мэдээлэл, нууц үг, тохиргоо</p>
      </div>

      {/* Hero card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="h-24 bg-linear-to-br from-primary/30 via-primary/15 to-primary/5" />
        <div className="px-5 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10">
            <AdminAvatar
              profile={profile}
              onUploaded={(url) => {
                queryClient.setQueryData(['admin', 'profile'], (old: AdminProfile | undefined) =>
                  old ? { ...old, image: url } : old,
                );
              }}
            />
            <div className="min-w-0 sm:pb-1">
              <h2 className="text-xl font-bold truncate">{profile.name ?? 'Нэргүй'}</h2>
              <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Badge variant="default">{profile.role}</Badge>
                {joined && (
                  <span className="text-xs text-muted-foreground">{joined}-с</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit profile */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Профайл мэдээлэл</h3>
          {!editMode && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={startEdit}
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
                <Label htmlFor="edit-email">И-мэйл</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="И-мэйл хаяг"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" className="gap-1.5" disabled={updateMutation.isPending}>
                  <Check className="h-3.5 w-3.5" />
                  {updateMutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={cancelEdit}>
                  <X className="h-3.5 w-3.5" />
                  Цуцлах
                </Button>
              </div>
            </form>
          ) : (
            <div className="divide-y divide-border/60">
              <InfoRow label="Нэр" value={profile.name} />
              <InfoRow label="И-мэйл" value={profile.email} />
            </div>
          )}
        </div>
      </div>

      {/* Account info + actions */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Бүртгэлийн мэдээлэл</h3>
        </div>
        <div className="px-5 divide-y divide-border/60">
          <InfoRow
            label="Эрх"
            value={<Badge variant="default">{profile.role}</Badge>}
          />
          <InfoRow
            label="И-мэйл баталгаажсан"
            value={
              profile.emailVerified
                ? new Date(profile.emailVerified).toLocaleDateString('mn-MN')
                : <span className="text-amber-600 dark:text-amber-400">Баталгаажаагүй</span>
            }
          />
          <InfoRow label="Бүртгүүлсэн" value={joined} />
          <InfoRow
            label="Сүүлд шинэчлэгдсэн"
            value={new Date(profile.updatedAt).toLocaleDateString('mn-MN')}
          />
        </div>
        <div className="px-5 py-4">
          <PasswordDialog />
        </div>
      </div>
    </div>
  );
}
