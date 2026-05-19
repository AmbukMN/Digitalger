import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, ChevronRight, Tag, User } from 'lucide-react';
import { Badge } from '@digitalger/shared/ui';
import { blogApi, productsApi } from '@/lib/api';
import { formatPrice } from '@digitalger/shared';
import type { BlogPost, ProductSummary } from '@/types/api';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await blogApi.bySlug(slug);
    return {
      title: `${post.title} | DigitalGer`,
      description: post.excerpt ?? post.title,
      openGraph: post.coverImageUrl
        ? { images: [{ url: post.coverImageUrl }] }
        : undefined,
    };
  } catch {
    return { title: 'Нийтлэл' };
  }
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function SmallPostCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group flex gap-3 items-start">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {post.coverImageUrl ? (
          <Image src={post.coverImageUrl} alt={post.title} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted">
            <Tag className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {post.title}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{formatDate(post.publishedAt ?? post.createdAt)}</p>
      </div>
    </Link>
  );
}

function FeaturedProductCard({ product }: { product: ProductSummary }) {
  const hasDiscount = product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price);
  return (
    <Link href={`/products/${product.slug}`} className="group flex gap-3 items-start">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {product.thumbnailUrl ? (
          <Image src={product.thumbnailUrl} alt={product.title} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center bg-primary/10">
            <Tag className="h-4 w-4 text-primary/40" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors leading-snug">
          {product.title}
        </p>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <p className="text-xs text-primary font-semibold">
            {formatPrice(Number(product.price))}
          </p>
          {hasDiscount && (
            <p className="text-[10px] text-muted-foreground line-through">
              {formatPrice(Number(product.compareAtPrice))}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params;

  let post: BlogPost;
  try {
    post = await blogApi.bySlug(slug);
  } catch {
    notFound();
  }

  const [latestPosts, featuredProducts] = await Promise.all([
    blogApi.latest(3).catch(() => []),
    productsApi.list({ featured: true, pageSize: 3 }).then((r) => r.items).catch(() => [] as ProductSummary[]),
  ]);

  const otherPosts = latestPosts.filter((p) => p.slug !== slug);
  const date = formatDate(post.publishedAt ?? post.createdAt);

  return (
    <>
      {/* Breadcrumb */}
      <div className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Нүүр</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/blog" className="hover:text-foreground transition-colors">Нийтлэл</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium truncate max-w-48">{post.title}</span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          {/* Main content */}
          <article>
            {/* Cover image */}
            {post.coverImageUrl && (
              <div className="relative w-full aspect-video overflow-hidden rounded-2xl bg-muted shadow-sm">
                <Image
                  src={post.coverImageUrl}
                  alt={post.title}
                  fill
                  className="object-cover"
                  priority
                  unoptimized
                />
              </div>
            )}

            {/* Title */}
            <h1 className="mt-6 text-2xl font-bold leading-snug sm:text-3xl lg:text-4xl">{post.title}</h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="mt-4 text-base text-muted-foreground leading-relaxed border-l-4 border-primary pl-4 italic">
                {post.excerpt}
              </p>
            )}

            {/* Content */}
            {post.content && (
              <div className="mt-6">
                {post.content.startsWith('<') ? (
                  <div
                    className="prose prose-sm sm:prose max-w-none text-foreground leading-relaxed
                      prose-headings:font-bold prose-headings:text-foreground
                      prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                      prose-img:rounded-xl prose-img:shadow-sm
                      prose-blockquote:border-primary prose-blockquote:text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
                    {post.content}
                  </p>
                )}
              </div>
            )}

            {/* Meta + Tags — after content */}
            <div className="mt-8 pt-6 border-t border-border flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {post.authorName}
              </span>
              {date && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {date}
                </span>
              )}
              {post.tags && post.tags.length > 0 && (
                <>
                  <span className="text-border">·</span>
                  {post.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </>
              )}
            </div>
          </article>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Latest posts */}
            {otherPosts.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold mb-4">Сүүлийн нийтлэлүүд</h3>
                <div className="space-y-3">
                  {otherPosts.map((p) => (
                    <SmallPostCard key={p.id} post={p} />
                  ))}
                </div>
                <Link
                  href="/blog"
                  className="mt-4 block text-xs text-primary hover:underline text-center"
                >
                  Бүгдийг харах
                </Link>
              </div>
            )}

            {/* Featured products */}
            {featuredProducts.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold mb-4">Онцлох бүтээгдэхүүн</h3>
                <div className="space-y-3">
                  {featuredProducts.map((p) => (
                    <FeaturedProductCard key={p.id} product={p} />
                  ))}
                </div>
                <Link
                  href="/products?featured=true"
                  className="mt-4 block text-xs text-primary hover:underline text-center"
                >
                  Бүх бүтээгдэхүүн
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
