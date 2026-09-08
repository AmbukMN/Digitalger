import { Suspense } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Шинэ нууц үг тохируулах',
  robots: { index: false },
};

// ⚠️ Хуудас `useSearchParams` (?token=...) ашигладаг тул Suspense ЗААВАЛ —
// эс бөгөөс production build дээр prerender алдаа гарна (login-той адил).
export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen bg-background" />}>{children}</Suspense>;
}
