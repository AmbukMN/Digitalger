import type { Metadata } from 'next';

/**
 * ⚠️ 18+ хэсэг — ЗААВАЛ noindex.
 * Хайлтын үр дүнд гарвал насанд хүрээгүй хүн санамсаргүй орох эрсдэлтэй,
 * мөн Google Safe Browsing/AdSense-д сөрөг.
 */
export const metadata: Metadata = {
  title: 'Насанд хүрэгчдийн',
  description: 'Зөвхөн 18 нас хүрсэн хэрэглэгчдэд зориулсан хэсэг.',
  robots: { index: false, follow: false },
};

export default function AdultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
