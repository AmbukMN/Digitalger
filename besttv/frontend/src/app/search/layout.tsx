import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Хайлт',
  robots: { index: false }, // хайлтын үр дүнгийн хуудас индексжихгүй
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
