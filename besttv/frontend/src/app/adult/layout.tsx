import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

/**
 * ⚠️ 18+ хэсэг — ЗААВАЛ noindex.
 * Хайлтын үр дүнд гарвал насанд хүрээгүй хүн санамсаргүй орох эрсдэлтэй,
 * мөн Google Safe Browsing/AdSense-д сөрөг.
 *
 * ⚠️ БОДИТ АЛДАА: өмнө нь `export const metadata` СТАТИК байсан тул админ
 * панелийн `/adult` SEO override нь хадгалагдаад ХЭЗЭЭ Ч уншигддаггүй байв.
 * `noindex` нь энд ХАТУУ — админ санамсаргүй индексжүүлэх боломжгүй.
 */
export async function generateMetadata(): Promise<Metadata> {
  const meta = await buildPageMetadata({
    path: '/adult',
    title: 'Насанд хүрэгчдийн',
    description: 'Зөвхөн 18 нас хүрсэн хэрэглэгчдэд зориулсан хэсэг.',
  });
  /* ⚠️ Админы override-оос ҮЛ ХАМААРАН индексжүүлэхгүй */
  return { ...meta, robots: { index: false, follow: false } };
}

export default function AdultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
