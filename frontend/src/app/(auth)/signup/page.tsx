'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthModal } from '@/components/auth/auth-modal';

function SignupModal() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/';

  return (
    <AuthModal
      open
      onClose={() => router.back()}
      defaultTab="signup"
      callbackUrl={callbackUrl}
    />
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupModal />
    </Suspense>
  );
}
