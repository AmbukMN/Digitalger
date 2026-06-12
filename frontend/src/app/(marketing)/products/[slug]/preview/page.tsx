import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { productsApi } from '@/lib/api';
import { getAdminAccessToken } from '@/lib/auth';
import { ProductDetailView } from '@/components/products/product-detail-view';

// ── Админ preview (dynamic) ──
// adminOnly бүтээгдэхүүн public `/products/[slug]` дээр 404 болдог (ISR static).
// Энэ route нь ADMIN/SUPERADMIN/EDITOR-ийн session token-оор adminOnly detail-ийг
// харах боломж олгоно. cookies() (getServerSession) ашигладаг тул заавал dynamic —
// гэхдээ зөвхөн админ дуудна (хэрэглэгчийн ачаалалд нөлөөлөхгүй).
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = {
  title: 'Урьдчилан үзэх (Админ)',
  robots: { index: false, follow: false },
};

export default async function ProductPreviewPage({ params }: Props) {
  const { slug } = await params;
  const adminToken = await getAdminAccessToken();
  // Зөвхөн админ — token байхгүй бол public route руу шилжих шаардлагагүй, 404.
  if (!adminToken) notFound();

  let product: Awaited<ReturnType<typeof productsApi.bySlug>>;
  try {
    product = await productsApi.bySlug(slug, adminToken);
  } catch {
    notFound();
  }

  const [suggestedProducts] = await Promise.all([
    productsApi.suggested(slug, 8, adminToken).catch(() => []),
  ]);

  return <ProductDetailView product={product} suggestedProducts={suggestedProducts} />;
}
