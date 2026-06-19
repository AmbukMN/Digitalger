import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { productsApi } from '@/lib/api';
import { getAdminAccessToken } from '@/lib/auth';
import { SITE_URL } from '@/lib/constants';
import { ProductDetailView } from '@/components/products/product-detail-view';

// ── First-visit хурд: бүтээгдэхүүний detail хуудсыг STATIC ISR болгов ──
// ⚠️ ISR ажиллахын тулд энэ хуудас cookies()/headers()/getServerSession ОГТ
// дуудахгүй (token-гүй public fetch). adminOnly бүтээгдэхүүний админ preview-г
// тусдаа dynamic route `products/[slug]/preview`-д шилжүүлсэн.
// revalidate=300 → product дата 5 минут тутам шинэчилнэ (ховор өөрчлөгддөг).
export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

function stripHtmlForMeta(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Build үед хамгийн их үзэгддэг (featured) бүтээгдэхүүний slug-уудыг урьдчилан
// render (SSG). Бусад нь анх ороход on-demand ISR-ээр үүсч cache-лагдана.
// ⚠️ Бүгдийг биш — top featured (build хурдан байлгах). Token-гүй public list.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const data = await productsApi.list({ featured: true, pageSize: 50 });
    return data.items.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    // Token-гүй public fetch — ISR static хадгалахын тулд (adminOnly бол 404 → fallback meta)
    const product = await productsApi.bySlug(slug);
    const seo = product as { seoTitle?: string; seoDescription?: string };
    const title = seo.seoTitle ?? product.title;
    const rawDesc = seo.seoDescription ?? product.description;
    const description = stripHtmlForMeta(rawDesc).slice(0, 160);
    const canonicalUrl = `${SITE_URL}/products/${product.slug}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        type: 'website',
        title,
        description,
        url: canonicalUrl,
        ...(product.thumbnailUrl ? { images: [{ url: product.thumbnailUrl, alt: title }] } : {}),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        ...(product.thumbnailUrl ? { images: [product.thumbnailUrl] } : {}),
      },
    };
  } catch {
    return { title: 'Бүтээгдэхүүн' };
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  // Token-гүй public fetch → ISR static (ердийн бүтээгдэхүүн хурдан, cache-тэй).
  let product: Awaited<ReturnType<typeof productsApi.bySlug>>;
  try {
    product = await productsApi.bySlug(slug);
  } catch {
    // ⚠️ Public-д олдсонгүй (adminOnly байж магадгүй). Admin/SUPERADMIN нэвтэрсэн
    // бол token-той дахин оролдоно (adminOnly бүтээгдэхүүнийг харуулна). Зочин/
    // энгийн хэрэглэгч бол token undefined → дахин 404 → notFound.
    // ⚠️ getAdminAccessToken (getServerSession) зөвхөн ЭНД (404 fallback) дуудагдана —
    // ердийн бүтээгдэхүүн public-аас олдоход дуудагдахгүй тул ISR хэвээр.
    try {
      const adminToken = await getAdminAccessToken();
      if (!adminToken) notFound();
      product = await productsApi.bySlug(slug, adminToken);
    } catch {
      notFound();
    }
  }

  const [suggestedProducts] = await Promise.all([
    productsApi.suggested(slug, 8).catch(() => []),
  ]);

  return <ProductDetailView product={product} suggestedProducts={suggestedProducts} />;
}
