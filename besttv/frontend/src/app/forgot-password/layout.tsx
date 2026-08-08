import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Нууц үг сэргээх',
  // ⚠️ noindex — auth хуудсууд хайлтын үр дүнд гарах ёсгүй
  robots: { index: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
