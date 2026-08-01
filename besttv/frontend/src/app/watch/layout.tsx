import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Үзэж байна',
  robots: { index: false }, // тоглуулах хуудас индексжихгүй
};

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
