import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function getPublicSettings() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/api/settings/public`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return res.json() as Promise<{ siteName: string; logoUrl: string | null }>;
  } catch {
    return null;
  }
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPublicSettings();
  const siteName = settings?.siteName ?? 'DigitalGer';
  const logoSrc = settings?.logoUrl ?? '/brand/logo.svg';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Image src={logoSrc} alt={siteName} width={40} height={40} unoptimized />
        <span className="text-xl font-bold text-primary">{siteName}</span>
      </Link>
      {children}
    </div>
  );
}
