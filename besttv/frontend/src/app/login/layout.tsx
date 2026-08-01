import { Suspense } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Нэвтрэх',
  robots: { index: false },
};

// ⚠️ Хуудас `useSearchParams` (?next=...) ашигладаг тул Suspense ЗААВАЛ —
// эс бөгөөс production build дээр prerender алдаа гарна.
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen bg-background" />}>{children}</Suspense>;
}
