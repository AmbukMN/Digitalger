import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

/**
 * ⚠️ /blog нь client component тул metadata эндээс. Өмнө нь ОГТ байгаагүй —
 * линк хуваалцахад сайтын ерөнхий гарчиг гарч байсан.
 */
export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    path: '/blog',
    title: 'Мэдээ & Нийтлэл',
    description:
      'Монголын кино урлагийн мэдээ, шинэ нээлт, ярилцлага, зөвлөмж — BestTV блог.',
  });
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
