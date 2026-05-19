'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthModal } from '@/components/auth/auth-modal';

function LoginRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/';

  return (
    <AuthModal
      open
      onClose={() => router.replace('/')}
      defaultTab="login"
      callbackUrl={callbackUrl}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginRedirect />
    </Suspense>
  );
}
