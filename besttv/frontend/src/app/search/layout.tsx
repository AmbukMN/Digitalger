import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

/**
 * ⚠️ БОДИТ АЛДАА: өмнө нь СТАТИК `metadata` байсан тул админ панелийн
 * `/search` SEO override нь хадгалагдаад ХЭЗЭЭ Ч уншигддаггүй байв.
 * `noindex` нь ХАТУУ — хайлтын үр дүнгийн хуудас индексжих ЁСГҮЙ.
 */
export async function generateMetadata(): Promise<Metadata> {
  const meta = await buildPageMetadata({
    path: '/search',
    title: 'Хайлт',
    description: 'BestTV дээрх кино, цуврал хайх.',
  });
  return { ...meta, robots: { index: false, follow: true } };
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
