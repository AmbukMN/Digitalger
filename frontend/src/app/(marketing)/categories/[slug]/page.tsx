import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductGrid } from '@/components/products/product-grid';
import { categoriesApi, productsApi } from '@/lib/api';
import { SITE_URL } from '@/lib/constants';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const cat = await categoriesApi.bySlug(slug);
    const title = cat.name;
    const description = cat.description ?? `${cat.name} ангиллын дижитал бүтээгдэхүүнүүд.`;
    const canonicalUrl = `${SITE_URL}/categories/${slug}`;
    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        type: 'website',
        title,
        description,
        url: canonicalUrl,
        // opengraph-image.tsx in this segment auto-generates the og:image
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    };
  } catch {
    return { title: 'Ангилал' };
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  let category: Awaited<ReturnType<typeof categoriesApi.bySlug>>;
  try {
    category = await categoriesApi.bySlug(slug);
  } catch {
    notFound();
  }

  let products: Awaited<ReturnType<typeof productsApi.list>>['items'] = [];
  try {
    const data = await productsApi.list({ category: slug, pageSize: 24 });
    products = data.items;
  } catch {
    products = [];
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Нүүр', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Ангилал', item: `${SITE_URL}/categories` },
      { '@type': 'ListItem', position: 3, name: category.name, item: `${SITE_URL}/categories/${slug}` },
    ],
  };

  // Ангилал = бүтээгдэхүүний цуглуулга → CollectionPage + ItemList (Google-д
  // тухайн ангилалд ямар бүтээгдэхүүн байгааг ойлгуулна).
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.name,
    url: `${SITE_URL}/categories/${slug}`,
    ...(category.description ? { description: category.description } : {}),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: products.slice(0, 24).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/products/${p.slug}`,
        name: p.title,
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold">{category.name}</h1>
        {category.description && (
          <p className="mt-2 text-muted-foreground">{category.description}</p>
        )}
        <div className="mt-8">
          <ProductGrid products={products} />
        </div>
      </div>
    </>
  );
}
