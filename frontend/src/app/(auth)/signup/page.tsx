'use client';

import { useRouter } from 'next/navigation';
import { AuthModal } from '@/components/auth/auth-modal';

export default function SignupPage() {
  const router = useRouter();

  return (
    <AuthModal
      open
      onClose={() => router.replace('/')}
      defaultTab="signup"
    />
  );
}
