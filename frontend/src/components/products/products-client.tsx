'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { ProductGrid } from '@/components/products/product-grid';
import { ProductsFilter } from '@/components/products/products-filter';
import { PageHeader } from '@/components/ui/page-header';
import { PagePagination } from '@/components/ui/page-pagination';
import { productsApi } from '@/lib/api';
import type { ProductTypeConfig } from '@/lib/api';
import type { Category, PaginatedProducts } from '@/types/api';

const PAGE_SIZE = 24;

interface Props {
  categories: Category[];
  productTypes: ProductTypeConfig[];
  // Server-ээс ирсэн АНХНЫ хуудасны дата (SSR first paint + SEO).
  initialData: PaginatedProducts;
  // Server fetch хийсэн filter — initialData яг энэ filter-т тохирно.
  // URL өөр filter-тэй (back/forward, share) ачаалбал initialData ашиглахгүй.
  initialKey: string;
}

// URL searchParams → productsApi.list-д өгөх параметр + cache key
function readFilters(sp: URLSearchParams) {
  const page = Number(sp.get('page')) || 1;
  const category = sp.get('category') ?? undefined;
  const types = sp.get('types') ?? undefined;
  const type = sp.get('type') ?? undefined;
  const sortBy = (sp.get('sortBy') as 'newest' | 'discount' | 'rating' | 'downloads' | null) ?? undefined;
  const onSale = sp.get('onSale') === 'true' ? true : undefined;
  const featured = sp.get('featured') === 'true' ? true : undefined;

  const parsePrice = (v: string | null): number | undefined => {
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const minPrice = parsePrice(sp.get('minPrice'));
  const maxPrice = parsePrice(sp.get('maxPrice'));

  return { page, category, types, type, sortBy, onSale, featured, minPrice, maxPrice };
}

// Filter-уудаас тогтвортой cache key (queryKey + initialData тааруулахад)
function filterKey(f: ReturnType<typeof readFilters>) {
  return JSON.stringify([
    f.page,
    f.category ?? '',
    f.types ?? f.type ?? '',
    f.sortBy ?? '',
    f.onSale ? 1 : 0,
    f.featured ? 1 : 0,
    f.minPrice ?? '',
    f.maxPrice ?? '',
  ]);
}

export function ProductsClient({ categories, productTypes, initialData, initialKey }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const filters = useMemo(() => readFilters(new URLSearchParams(sp.toString())), [sp]);
  const key = filterKey(filters);

  const { data, isPlaceholderData, isLoading } = useQuery({
    queryKey: ['products', key, token ?? ''],
    queryFn: () =>
      productsApi.list(
        {
          page: filters.page,
          pageSize: PAGE_SIZE,
          category: filters.category,
          featured: filters.featured,
          types: filters.types,
          type: filters.type,
          sortBy: filters.sortBy,
          onSale: filters.onSale,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
        },
        token,
      ),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    // Эхний URL нь server fetch хийсэн filter-тэй ИЖИЛ бөгөөд админ token-гүй
    // (public) үед л SSR датаг ашиглана — first paint шууд, дахин fetch хийхгүй.
    initialData: key === initialKey && !token ? initialData : undefined,
  });

  const products = data?.items ?? [];
  const total = data?.total ?? 0;

  // Гарчиг (server-ийн логиктой ижил) — filter-ээс хамаарч өөрчилнө
  const heading = useMemo(() => {
    const typesKey = filters.types ?? filters.type ?? '';
    if (typesKey) {
      const typeValues = typesKey.split(',');
      if (typeValues.length === 1) {
        const found = productTypes.find((t) => t.value === typeValues[0]);
        return found
          ? { title: found.label, desc: found.description ?? `${found.label} бүтээгдэхүүн` }
          : { title: typeValues[0], desc: 'Дижитал бүтээгдэхүүн' };
      }
      const labels = typeValues.map((v) => productTypes.find((t) => t.value === v)?.label ?? v);
      return { title: labels.join(' & '), desc: 'Дижитал бүтээгдэхүүн' };
    }
    if (filters.category) {
      const cat = categories.find((c) => c.slug === filters.category);
      return cat
        ? { title: cat.name, desc: cat.description ?? `${cat.name} ангиллын бүтээгдэхүүнүүд` }
        : { title: 'Бүтээгдэхүүн', desc: 'Дижитал бүтээгдэхүүн' };
    }
    return { title: 'Бүтээгдэхүүн', desc: 'Файл, загвар, хичээл болон бусад дижитал бүтээгдэхүүн' };
  }, [filters.types, filters.type, filters.category, productTypes, categories]);

  // Хуудас солих — URL replace (history спам багасгана), scroll хадгална.
  // Дата нь Query-ээс (keepPreviousData) тул skeleton дээр гацахгүй.
  const goToPage = (p: number) => {
    const params = new URLSearchParams(sp.toString());
    if (p > 1) params.set('page', String(p));
    else params.delete('page');
    const s = params.toString();
    router.replace(`/products${s ? `?${s}` : ''}`, { scroll: false });
  };

  const buildUrl = (p: number) => {
    const params = new URLSearchParams(sp.toString());
    if (p > 1) params.set('page', String(p));
    else params.delete('page');
    const s = params.toString();
    return `/products${s ? `?${s}` : ''}`;
  };

  // Subtle loading — хуучин дата (keepPreviousData) дээр шинэ ачаалах үед бүдгэрнэ.
  // Бүтэн skeleton БИШ → navigation INSTANT мэдрэгдэнэ.
  const showOverlay = isPlaceholderData;
  // Зөвхөн cache бүрэн хоосон (анхны load admin/share back) үед grid skeleton.
  const firstLoad = isLoading && !data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24 rounded-2xl border border-border bg-card p-4 dark:bg-card">
            <ProductsFilter categories={categories} productTypes={productTypes} total={total} />
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <PageHeader title={heading.title} description={heading.desc} className="mb-6" />

          {/* Mobile filter bar */}
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <p className="text-sm text-muted-foreground">{total.toLocaleString()} бүтээгдэхүүн</p>
            <ProductsFilter categories={categories} productTypes={productTypes} total={total} />
          </div>

          {/* Top progress bar — placeholder дата дээр шинэ ачаалж байгааг харуулна */}
          {showOverlay && (
            <div className="relative -mt-2 mb-2 h-0.5 w-full overflow-hidden rounded-full bg-primary/10">
              <div className="dg-progress-indeterminate absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary" />
            </div>
          )}

          {firstLoad ? (
            <ProductGrid products={[]} cols="three" loading />
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-lg font-semibold">Бүтээгдэхүүн олдсонгүй</p>
              <p className="mt-1 text-sm text-muted-foreground">Шүүлтүүрийг өөрчилж дахин хайна уу</p>
            </div>
          ) : (
            <>
              {/* keepPreviousData үед subtle opacity → агшин зуурын мэдрэмж, гацахгүй */}
              <div className={showOverlay ? 'opacity-60 transition-opacity duration-200' : 'transition-opacity duration-200'}>
                <ProductGrid products={products} cols="three" />
              </div>
              <div className="mt-8">
                <PagePagination
                  page={filters.page}
                  total={total}
                  pageSize={PAGE_SIZE}
                  buildUrl={buildUrl}
                  onNavigate={goToPage}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
