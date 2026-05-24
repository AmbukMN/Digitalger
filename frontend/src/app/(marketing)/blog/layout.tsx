import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://digitalger.mn';

export const metadata: Metadata = {
  title: 'Нийтлэл',
  description: 'Дижитал бизнес, загвар хэрэглээ, мэргэжлийн зөвлөгөө болон шинэ мэдлэг авах нийтлэлүүд.',
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    type: 'website',
    title: 'Нийтлэл — DigitalGer',
    description: 'Дижитал бизнес, загвар хэрэглээ, мэргэжлийн зөвлөгөө болон шинэ мэдлэг авах нийтлэлүүд.',
    url: `${SITE_URL}/blog`,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Нийтлэл — DigitalGer',
    description: 'Дижитал бизнес, загвар хэрэглээ, мэргэжлийн зөвлөгөө болон шинэ мэдлэг авах нийтлэлүүд.',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
