import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Миний жагсаалт',
  robots: { index: false }, // хувийн хуудас
};

export default function MyListLayout({ children }: { children: React.ReactNode }) {
  return children;
}
