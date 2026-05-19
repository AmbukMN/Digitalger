'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label } from '@digitalger/shared/ui';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { authApi } from '@/lib/api';

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
      const res = await signIn('credentials', {
        redirect: false,
        email: values.email,
        password: values.password,
      });
      if (res?.error) {
        toast.success('Бүртгэл амжилттай. Нэвтэрнэ үү.');
        router.push('/login');
        return;
      }
      toast.success('Тавтай морил!');
      router.push('/');
      router.refresh();
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

const forgotSchema = z.object({
  email: z.string().email(),
});

export function ForgotPasswordForm() {
  const form = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async () => {
    toast.info('Нууц үг сэргээх холбоос удахгүй идэвхжинэ');
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">И-мэйл</Label>
        <Input id="email" type="email" {...form.register('email')} />
      </div>
      <Button type="submit" className="w-full">
        Холбоос илгээх
      </Button>
    </form>
  );
}

const resetSchema = z
  .object({
    password: z.string().min(6),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Нууц үг таарахгүй байна',
    path: ['confirm'],
  });

export function ResetPasswordForm() {
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = async () => {
    toast.info('Нууц үг сэргээх API удахгүй нэмэгдэнэ');
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Шинэ нууц үг</Label>
        <PasswordInput id="password" {...form.register('password')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Давтах</Label>
        <PasswordInput id="confirm" {...form.register('confirm')} />
        {form.formState.errors.confirm && (
          <p className="text-sm text-destructive">{form.formState.errors.confirm.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full">
        Хадгалах
      </Button>
    </form>
  );
}
