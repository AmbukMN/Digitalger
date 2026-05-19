'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
} from '@digitalger/shared/ui';
import { SITE_NAME } from '@/lib/constants';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const [email, setEmail] = useState('admin@digitalger.mn');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setFormError('И-мэйл эсвэл нууц үг буруу байна');
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-bold">{SITE_NAME}</h1>
          <p className="text-sm text-muted-foreground">
            Зөвхөн ADMIN эрхтэй хэрэглэгч нэвтэрнэ
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {(error === 'unauthorized' || formError) && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError ?? 'Эрх хүрэлцэхгүй'}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">И-мэйл</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Нууц үг</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
