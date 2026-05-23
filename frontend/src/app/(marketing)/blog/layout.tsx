import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Нийтлэл | DigitalGer',
  description: 'Дижитал бизнес, загвар хэрэглээ, мэргэжлийн зөвлөгөө',
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
