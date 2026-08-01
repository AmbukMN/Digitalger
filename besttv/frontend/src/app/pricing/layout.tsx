import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

// ⚠️ Админ панелаас (SEO → Хуудасны тохиргоо) дарж бичих боломжтой
export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    path: '/pricing',
    title: 'Багцууд',
    description: 'BestTV-ийн сарын, улирлын, жилийн багцууд — QPay-ээр хялбар төлбөр.',
  });
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
