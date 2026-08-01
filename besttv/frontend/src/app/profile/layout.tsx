import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Миний профайл',
  robots: { index: false },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
