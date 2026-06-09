'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { downloadsApi } from '@/lib/api';
import { ProductTestimonialsSection } from '@/components/products/testimonials-section';

interface Testimonial {
  id: string;
  name: string;
  avatar?: string | null;
  role?: string | null;
  content: string;
  rating: number;
}

interface Props {
  productId: string;
  /** Сургалт (LESSON) эсэх — paid үед нуухад ашиглана */
  isLesson: boolean;
  testimonials: Testimonial[];
}

/**
 * "Худалдан авагчид юу гэж хэлэв?" (testimonial) хэсгийг харуулах/нуух gate.
 * ⚠️ Сургалт (LESSON)-ыг ХУДАЛДАЖ АВСАН үед энэ хэсэг ХЭРЭГГҮЙ → нуудаг.
 *    (Бусад тохиолдол: худалдаагүй, эсвэл LESSON биш — хэвээр харагдана.)
 */
export function TestimonialsGate({ productId, isLesson, testimonials }: Props) {
  const { data: session } = useSession();
  const { data: library = [] } = useQuery({
    queryKey: ['downloads', 'history'],
    queryFn: () => downloadsApi.history(session!.accessToken!),
    enabled: !!session?.accessToken,
    staleTime: 60_000,
  });
  const purchased = library.some((item) => item.product.id === productId);

  // Сургалтыг худалдаж авсан бол энэ хэсгийг бүхэлд нь нуух.
  if (isLesson && purchased) return null;

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-bold">Худалдан авагчид юу гэж хэлэв?</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Мянга мянган хэрэглэгчид DigitalGer-ээр дамжуулан хэрэгтэй файл, сургалт, бэлэн шийдлүүдээ олж,
          цаг хугацаа болон зардлаа хэмнэж байна. Бодит хэрэглэгчдийн туршлага танд зөв сонголт хийхэд тусална.
        </p>
      </div>
      <ProductTestimonialsSection testimonials={testimonials} />
    </section>
  );
}
