'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { BrandLogo } from '@besttv/shared/ui';
import { useAdminAuth } from '@/lib/auth-store';
import { useBrand } from '@/lib/queries';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAdminAuth((s) => s.login);
  const router = useRouter();
  const { data: brand } = useBrand();
  const logoUrl = brand?.logoUrl ?? null;
  const siteName = brand?.siteName ?? 'BestTV';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Нэвтрэхэд алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(229,9,20,0.14),transparent_60%)]"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <BrandLogo logoUrl={logoUrl} siteName={siteName} imgClassName="h-10 w-auto" textSize="text-lg" />
          <p className="text-xs text-muted-foreground">Admin самбар</p>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">Үргэлжлүүлэхийн тулд нэвтэрнэ үү</p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Имэйл хаяг"
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Нууц үг"
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            Нэвтрэх
          </button>
        </form>
      </div>
    </main>
  );
}
