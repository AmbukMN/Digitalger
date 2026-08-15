import type { Metadata } from 'next';

/**
 * ⚠️ `noindex` — цуцлах хуудас Google-д индексжих ЁСГҮЙ.
 * Хайлтын үр дүнд гарвал хэрэглэгч санамсаргүй орж цуцалж болно.
 */
export const metadata: Metadata = {
  title: 'Имэйл цуцлах',
  robots: { index: false, follow: false },
};

export default function UnsubscribeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
