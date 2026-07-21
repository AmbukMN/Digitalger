import { Suspense } from 'react';
import { Loading } from '@digitalger/shared/ui';
import { LoginForm } from './login-form';
import { API_URL } from '@/lib/constants';

// Лого settings-ээс динамик татна → бүр request-д fetch (шинэ лого шууд харагдана).
export const dynamic = 'force-dynamic';

// Login хуудасны лого-г server дээр татна (нэвтрэхээс өмнө public endpoint).
// logoUrl байвал динамик лого, байхгүй бол brand PNG fallback (login-form дотор).
async function fetchLogoUrl(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/settings/public`, {
      // force-dynamic тул бүр request-д шинэ лого татна (кэшлэхгүй).
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { logoUrl?: string | null };
    return data.logoUrl ?? null;
  } catch {
    return null;
  }
}

export default async function LoginPage() {
  const logoUrl = await fetchLogoUrl();
  return (
    <Suspense fallback={<Loading label="..." />}>
      <LoginForm logoUrl={logoUrl} />
    </Suspense>
  );
}
