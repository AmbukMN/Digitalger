import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

/**
 * ⚠️ БОДИТ АЛДАА: өмнө нь СТАТИК `metadata` байсан тул админ панелийн
 * `/my-list` SEO override нь хадгалагдаад ХЭЗЭЭ Ч уншигддаггүй байв.
 * `noindex` нь ХАТУУ — хувийн хуудас индексжих ЁСГҮЙ.
 */
export async function generateMetadata(): Promise<Metadata> {
  const meta = await buildPageMetadata({
    path: '/my-list',
    title: 'Миний жагсаалт',
    description: 'Хадгалсан кино, цувралууд.',
  });
  return { ...meta, robots: { index: false, follow: true } };
}

export default function MyListLayout({ children }: { children: React.ReactNode }) {
  return children;
}
