export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Search, FileText, Tag } from 'lucide-react';
import { productsApi, blogApi } from '@/lib/api';
import { applySeoOverride } from '@/lib/page-metadata';
import { ProductCard } from '@/components/products/product-card';
import { formatPrice } from '@digitalger/shared';
import { Badge } from '@digitalger/shared/ui';
import type { BlogPost, ProductSummary } from '@/types/api';
import { PageHeader } from '@/components/ui/page-header';
import { PagePagination } from '@/components/ui/page-pagination';
import { SearchTracker } from '@/components/search-tracker';

const SEARCH_PAGE_SIZE = 12;

export async function generateMetadata(): Promise<Metadata> {
  const defaultMeta: Metadata = {
    title: 'Хайлт',
  };
  // Admin override байвал дарж бичнэ, байхгүй бол default хэвээр
  return applySeoOverride('/search', defaultMeta);
}

function BlogResultCard({ post }: { post: BlogPost }) {
  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }
  const date = formatDate(post.publishedAt ?? post.createdAt);

  return (
    <Link href={`/blog/${post.slug}`} className="group flex gap-4 rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow">
      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
        {post.coverImageUrl ? (
          <Image
            src={post.coverImageUrl}
            alt={post.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 96px, 128px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FileText className="h-6 w-6 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {post.tags && post.tags.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1">
            {post.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
            ))}
          </div>
        )}
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{post.excerpt}</p>
        )}
        {date && <p className="mt-1.5 text-xs text-muted-foreground">{date}</p>}
      </div>
    </Link>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = '', page: pageStr } = await searchParams;
  const page = Number(pageStr) || 1;

  let products: ProductSummary[] = [];
  let blogPosts: BlogPost[] = [];
  let productsTotal = 0;

  if (q.trim()) {
    const [prodRes, blogRes] = await Promise.all([
      productsApi
        .search(q.trim(), page, SEARCH_PAGE_SIZE)
        .catch(() => ({ items: [] as ProductSummary[], total: 0 })),
      blogApi.search(q.trim()).catch(() => [] as BlogPost[]),
    ]);
    products = prodRes.items;
    productsTotal = prodRes.total ?? products.length;
    blogPosts = blogRes;
  }

  // Нийт тоо: бүтээгдэхүүний БҮХ үр дүн (зөвхөн энэ хуудас биш) + блог
  const total = productsTotal + blogPosts.length;

  return (
    <>
      {q.trim() && <SearchTracker query={q.trim()} results={total} />}
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Хайлтын үр дүн"
        description={
          q
            ? total > 0
              ? `«${q}» — ${total} үр дүн олдлоо`
              : `«${q}» — үр дүн олдсонгүй`
            : 'Хайх үгээ дээрх хайлтын талбарт оруулна уу'
        }
      />

      {q.trim() && total === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Илэрц олдсонгүй — өгүүлбэрийн оронд товч үг хэрэглэж үзнэ үү.</p>
        </div>
      )}

      {products.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">Бүтээгдэхүүн</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{productsTotal}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {/* Бүтээгдэхүүний хуудаслалт — 1 хуудаснаас илүү бол харагдана */}
          <PagePagination
            page={page}
            total={productsTotal}
            pageSize={SEARCH_PAGE_SIZE}
            buildUrl={(p) => `/search?q=${encodeURIComponent(q.trim())}&page=${p}`}
          />
        </section>
      )}

      {blogPosts.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">Нийтлэл</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{blogPosts.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {blogPosts.map((post) => (
              <BlogResultCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}
    </div>
    </>
  );
}
