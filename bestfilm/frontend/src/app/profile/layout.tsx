import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Миний профайл',
  robots: { index: false },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  // ⚠️ useSearchParams (?tab=wallet) нь Suspense boundary ЗААВАЛ шаардана
  return <Suspense fallback={<div className="min-h-screen bg-background pt-24" />}>{children}</Suspense>;
}
