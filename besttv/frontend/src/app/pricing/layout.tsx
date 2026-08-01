import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Багцууд',
  description: 'BestTV-ийн сарын, улирлын, жилийн багцууд — QPay-ээр хялбар төлбөр.',
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
