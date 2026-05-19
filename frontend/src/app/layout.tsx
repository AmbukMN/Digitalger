import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';
import { SITE_NAME, SITE_URL } from '@/lib/constants';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Дижитал бүтээгдэхүүний marketplace`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Файл, загвар, баримт, видео, курс зэрэг дижитал бүтээгдэхүүн худалдаж авах Монголын marketplace.',
  openGraph: {
    type: 'website',
    locale: 'mn_MN',
    siteName: SITE_NAME,
    url: SITE_URL,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
