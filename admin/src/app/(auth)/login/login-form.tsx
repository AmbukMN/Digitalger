'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
} from '@digitalger/shared/ui';
import { SITE_NAME } from '@/lib/constants';

// Динамик лого байхгүй үед brand PNG fallback (DG badge БИШ — жинхэнэ лого).
const FALLBACK_LOGO = '/brand/logo-color.png';

export function LoginForm({ logoUrl }: { logoUrl?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState('admin@digitalger.mn');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Динамик лого ачаалахад алдвал fallback PNG-руу шилжинэ.
  const [logoSrc, setLogoSrc] = useState(logoUrl || FALLBACK_LOGO);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!res.ok) {
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
          {/* Динамик лого (settings-ээс), алдвал brand PNG fallback */}
          <div className="mb-3 flex justify-center">
            <Image
              src={logoSrc}
              alt={SITE_NAME}
              width={180}
              height={56}
              priority
              unoptimized
              onError={() => setLogoSrc(FALLBACK_LOGO)}
              className="h-14 w-auto object-contain"
            />
          </div>
          <h1 className="text-center text-2xl font-bold">{SITE_NAME}</h1>
          <p className="text-center text-sm text-muted-foreground">
            Зөвхөн ADMIN эрхтэй хэрэглэгч нэвтэрнэ
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {formError && (
              <p className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-destructive">
                {formError}
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
              {/* Нууц үг харах toggle (eye icon) */}
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Нууц үг нуух' : 'Нууц үг харах'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
