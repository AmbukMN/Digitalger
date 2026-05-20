import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';
import type { Theme } from '@digitalger/shared/ui';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Admin | DigitalGer',
    template: '%s | DigitalGer Admin',
  },
  robots: { index: false, follow: false },
};

async function getDefaultTheme(): Promise<Theme> {
  try {
    const apiUrl =
      process.env.INTERNAL_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:4000';
    const res = await fetch(`${apiUrl}/api/settings/public`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return 'system';
    const data = await res.json();
    const t = data?.defaultTheme;
    if (t === 'light' || t === 'dark' || t === 'system') return t;
    return 'system';
  } catch {
    return 'system';
  }
}

function buildThemeScript(serverDefault: Theme): string {
  return `(function(){try{var s=localStorage.getItem('digitalger-admin-theme');var d='${serverDefault}';var t=s||d||'system';var r=t==='system'?(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t;document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(r);}catch(e){}})();`;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const defaultTheme = await getDefaultTheme();

  return (
    <html lang="mn" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: buildThemeScript(defaultTheme) }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers defaultTheme={defaultTheme}>{children}</Providers>
      </body>
    </html>
  );
}
