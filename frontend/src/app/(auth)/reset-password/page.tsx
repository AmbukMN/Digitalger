import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: 'Шинэ нууц үг' };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Шинэ нууц үг тохируулах">
      <ResetPasswordForm />
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          ← Нэвтрэх
        </Link>
      </p>
    </AuthCard>
  );
}
