import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { productsApi } from '@/lib/api';
import { LearnClient } from '@/components/course/learn-client';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await productsApi.bySlug(slug);
    return {
      title: `${product.title} — Хичээл үзэх`,
      // Сургалтын хуудсыг хайлтын системд индексжүүлэхгүй
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: 'Хичээл үзэх' };
  }
}

export default async function LearnPage({ params }: Props) {
  const { slug } = await params;

  let product: Awaited<ReturnType<typeof productsApi.bySlug>>;
  try {
    product = await productsApi.bySlug(slug);
  } catch {
    notFound();
  }

  // Хичээлтэй (course) эсэхийг шалгана — байхгүй бол product page руу буцаана
  const allLessons = [
    ...(product.course?.lessons ?? []),
    ...(product.course?.modules?.flatMap((m) => m.lessons) ?? []),
  ];
  if (allLessons.length === 0) {
    redirect(`/products/${product.slug}`);
  }

  return <LearnClient product={product} />;
}
