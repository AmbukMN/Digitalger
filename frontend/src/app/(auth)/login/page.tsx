'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { AuthModal } from '@/components/auth/auth-modal';

// NextAuth алдааны код → ойлгомжтой Монгол мессеж (OAuth чимээгүй бүтэлгүйтэхгүй).
const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: 'Энэ имэйл өөр аргаар бүртгэгдсэн байна. Анх ашигласан нэвтрэх аргаа сонгоно уу.',
  AccessDenied: 'Нэвтрэх боломжгүй байна. Дахин оролдоно уу.',
  Configuration: 'Системийн тохиргооны алдаа. Түр хүлээгээд дахин оролдоно уу.',
  Verification: 'Баталгаажуулалт амжилтгүй. Дахин оролдоно уу.',
  OAuthSignin: 'Нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу.',
  OAuthCallback: 'Нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу.',
  default: 'Нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу.',
};

function LoginRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/';

  // OAuth (Google/Facebook) бүтэлгүйтэхэд NextAuth ?error=... залгадаг — хэрэглэгчид
  // toast харуулна (өмнө чимээгүй /login руу буцаж юу болсныг мэддэггүй байсан).
  const errorShown = useRef(false);
  const error = params.get('error');
  useEffect(() => {
    if (error && !errorShown.current) {
      errorShown.current = true;
      toast.error(ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default);
    }
  }, [error]);

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
