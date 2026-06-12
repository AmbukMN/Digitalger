// force-dynamic ХАСав — filter СОЛИХ үед client-side (TanStack Query) шилжинэ.
// searchParams нь async тул хуудас автоматаар dynamic байх ба анхны load SSR хэвээр
// (SEO + first paint). Filter навигац server re-render хийхгүй → skeleton дээр гацахгүй.
import type { Metadata } from 'next';
import { productsApi, productTypesApi, categoriesApi, siteSettingsApi } from '@/lib/api';
import { applySeoOverride } from '@/lib/page-metadata';
import { getAdminAccessToken } from '@/lib/auth';
import { SITE_URL } from '@/lib/constants';
import type { ProductSummary } from '@/types/api';
import { ProductsClient } from '@/components/products/products-client';

export async function generateMetadata(): Promise<Metadata> {
  let ogImageUrl: string | null = null;
  try {
    const s = await siteSettingsApi.getPublic();
    ogImageUrl = s.ogImageUrl ?? null;
  } catch { /* fallback */ }
  const defaultMeta: Metadata = {
    title: 'Бүтээгдэхүүн',
    description: 'Бүх дижитал бүтээгдэхүүн — файл, загвар, хичээл.',
    alternates: { canonical: `${SITE_URL}/products` },
    openGraph: {
      title: 'Бүтээгдэхүүн',
      description: 'Бүх дижитал бүтээгдэхүүн — файл, загвар, хичээл.',
      url: `${SITE_URL}/products`,
      ...(ogImageUrl ? { images: [{ url: ogImageUrl, width: 1200, height: 630, alt: 'DigitalGer Бүтээгдэхүүн' }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  };
  // Admin override байвал дарж бичнэ, байхгүй бол default хэвээр
  return applySeoOverride('/products', defaultMeta);
}

type SearchParams = {
  page?: string;
  category?: string;
  featured?: string;
  type?: string;
  types?: string;
  sortBy?: string;
  onSale?: string;
  minPrice?: string;
  maxPrice?: string;
};

const PAGE_SIZE = 24;

// products-client.tsx-ийн filterKey-тэй ЯГ ИЖИЛ дараалал/формат байх ёстой —
// ингэснээр client анхны URL дээр server датаг (initialData) дахин fetch
// хийхгүйгээр шууд ашиглана (SSR first paint).
function buildInitialKey(params: SearchParams): string {
  const page = Number(params.page) || 1;
  const parsePrice = (v?: string): number | undefined => {
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const sortBy = (params.sortBy as 'newest' | 'discount' | 'rating' | 'downloads' | undefined) ?? undefined;
  const minPrice = parsePrice(params.minPrice);
  const maxPrice = parsePrice(params.maxPrice);
  return JSON.stringify([
    page,
    params.category ?? '',
    params.types ?? params.type ?? '',
    sortBy ?? '',
    params.onSale === 'true' ? 1 : 0,
    params.featured === 'true' ? 1 : 0,
    minPrice ?? '',
    maxPrice ?? '',
  ]);
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const typesKey = params.types ?? params.type ?? '';
  const sortBy = (params.sortBy as 'newest' | 'discount' | 'rating' | 'downloads' | undefined) ?? undefined;
  const onSale = params.onSale === 'true' ? true : undefined;
  const featured = params.featured === 'true' ? true : undefined;
  // Үнийн range — тоо болгож parse (буруу/сөрөг утга алгасна)
  const parsePrice = (v?: string): number | undefined => {
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const minPrice = parsePrice(params.minPrice);
  const maxPrice = parsePrice(params.maxPrice);

  // ADMIN бол token дамжуулна → adminOnly бүтээгдэхүүн ч жагсаалтад харагдана.
  // (Client-side filter дээр token нь useSession-аас дахин уншигдана.)
  const adminToken = await getAdminAccessToken();

  // SSR анхны хуудас + filter options — first paint + SEO. Filter СОЛИХ үед
  // дахин энд орохгүй, client-side TanStack Query шилжинэ.
  const [productsData, productTypeConfigs, categories] = await Promise.all([
    productsApi.list({
      page,
      pageSize: PAGE_SIZE,
      category: params.category,
      featured,
      types: params.types,
      type: params.type,
      sortBy,
      onSale,
      minPrice,
      maxPrice,
    }, adminToken).catch(() => ({ items: [] as ProductSummary[], total: 0, page: 1, pageSize: PAGE_SIZE })),
    productTypesApi.list().catch(() => []),
    categoriesApi.list().catch(() => []),
  ]);

  // SEO heading (JSON-LD) — server дээр тооцоолно
  let title = 'Бүтээгдэхүүн';
  let desc = 'Файл, загвар, хичээл болон бусад дижитал бүтээгдэхүүн';
  if (typesKey) {
    const typeValues = typesKey.split(',');
    if (typeValues.length === 1) {
      const found = productTypeConfigs.find((t) => t.value === typeValues[0]);
      if (found) { title = found.label; desc = found.description ?? `${found.label} бүтээгдэхүүн`; }
      else { title = typeValues[0]; desc = 'Дижитал бүтээгдэхүүн'; }
    } else {
      title = typeValues.map((v) => productTypeConfigs.find((t) => t.value === v)?.label ?? v).join(' & ');
      desc = 'Дижитал бүтээгдэхүүн';
    }
  } else if (params.category) {
    const cat = categories.find((c) => c.slug === params.category);
    if (cat) { title = cat.name; desc = cat.description ?? `${cat.name} ангиллын бүтээгдэхүүнүүд`; }
  }

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description: desc,
    url: `${SITE_URL}/products${params.category ? `?category=${params.category}` : ''}`,
    numberOfItems: productsData.total,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <ProductsClient
        categories={categories}
        productTypes={productTypeConfigs}
        initialData={productsData}
        // adminToken байвал client дахин (token-той) fetch хийнэ — admin-only
        // бүтээгдэхүүн зөрчилгүй харагдана; зочин/энгийн үед SSR дата шууд.
        initialKey={adminToken ? '__admin__' : buildInitialKey(params)}
      />
    </>
  );
}
