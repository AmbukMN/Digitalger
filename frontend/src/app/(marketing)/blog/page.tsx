export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDays, User, Tag, ArrowRight } from 'lucide-react';
import { Badge } from '@digitalger/shared/ui';
import { blogApi } from '@/lib/api';
import type { BlogPost } from '@/types/api';

export const metadata: Metadata = {
  title: 'Нийтлэл | DigitalGer',
  description: 'Дижитал бизнес, загвар хэрэглээ, мэргэжлийн зөвлөгөө',
};

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

async function getPosts(): Promise<BlogPost[]> {
  try {
    return await blogApi.list({ pageSize: 24 });
  } catch {
    return [];
  }
}

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Нийтлэл</h1>
        <p className="mt-3 text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
          Дижитал бизнес, загвар хэрэглээ, мэргэжлийн зөвлөгөө
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Tag className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-lg">Нийтлэл байхгүй байна</p>
          <p className="text-sm text-muted-foreground mt-1">Удахгүй шинэ нийтлэлүүд нэмэгдэнэ</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

function BlogCard({ post }: { post: BlogPost }) {
  const date = formatDate(post.publishedAt ?? post.createdAt);

  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <article className="h-full rounded-2xl border border-border bg-card overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        {/* Cover image */}
        <div className="relative aspect-video bg-muted overflow-hidden">
          {post.coverImageUrl ? (
            <Image
              src={post.coverImageUrl}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-linear-to-br from-primary/10 to-accent/10">
              <Tag className="h-10 w-10 text-primary/30" />
            </div>
          )}
        </div>

        <div className="p-5">
          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {post.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Title */}
          <h2 className="font-bold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h2>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
              {post.excerpt}
            </p>
          )}

          {/* Meta */}
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {post.authorName}
              </span>
              {date && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {date}
                </span>
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </article>
    </Link>
  );
}
