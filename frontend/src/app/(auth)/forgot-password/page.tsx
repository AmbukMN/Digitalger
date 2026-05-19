import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: 'Нууц үг сэргээх' };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Нууц үг сэргээх"
      description="И-мэйл хаягаа оруулбал сэргээх холбоос илгээнэ"
    >
      <ForgotPasswordForm />
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          ← Нэвтрэх рүү буцах
        </Link>
      </p>
    </AuthCard>
  );
}
