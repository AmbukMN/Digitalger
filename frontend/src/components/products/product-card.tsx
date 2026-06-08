'use client';

import { Badge, Button, Card, CardContent, CardFooter, productTypeBadgeVariant } from '@digitalger/shared/ui';
import { formatPrice } from '@digitalger/shared';
import { BookOpen, CheckCircle, Download, Flame, Heart, ShoppingCart, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useProductTypeIcon, useProductTypeLabel } from '@/hooks/use-product-types';
import { DynamicLucideIcon } from '@/components/ui/lucide-icon';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import { downloadsApi, wishlistApi } from '@/lib/api';
import { trackProductClick, trackAddToCart, trackAddToWishlist } from '@/lib/analytics';
import { LazyCardVideo } from '@/components/products/lazy-card-video';
import type { ProductSummary } from '@/types/api';

export function ProductCard({ product }: { product: ProductSummary }) {
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.accessToken;

  const add = useCartStore((s) => s.add);
  const has = useCartStore((s) => s.has);
  const toggleWishlistLocal = useWishlistStore((s) => s.toggle);
  const inWishlistRaw = useWishlistStore((s) => s.has(product.id));
  const [mounted, setMounted] = useState(false);
  const typeLabel = useProductTypeLabel(product.type);
  const typeIcon = useProductTypeIcon(product.type);
  useEffect(() => setMounted(true), []);

  const { data: purchased } = useQuery({
    queryKey: ['downloads', 'history'],
    queryFn: () => downloadsApi.history(token!),
    enabled: !!token,
    staleTime: 5 * 60_000,
  });

  // Expired (хугацаа дууссан) худалдан авалтыг "эзэмшээгүй" гэж үзнэ —
  // ингэснээр card дээр энгийн "худалдаж авах" статус харагдана (#6).
  const isPurchased =
    mounted && !!purchased?.some((p) => p.product.id === product.id && p.isExpired !== true);
  const inWishlist = mounted && inWishlistRaw;
  const inCart = mounted && has(product.id);

  const handleAddToCart = () => {
    if (isPurchased) return;
    if (inCart) {
      toast.info('Энэ бүтээгдэхүүн сагсанд байна', {
        description: product.title,
        action: { label: 'Сагс харах', onClick: () => window.location.href = '/checkout' },
      });
      return;
    }
    add(product);
    trackAddToCart(product.id, product.slug, Number(product.price) || 0);
    toast.success('Сагсанд нэмэгдлээ', { description: product.title });
  };

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    trackProductClick(product.id, product.slug);
    router.push(`/products/${product.slug}`);
  };

  const handleWishlist = async () => {
    toggleWishlistLocal(product);
    if (token) {
      try {
        await wishlistApi.toggle(token, product.id);
      } catch {
        toggleWishlistLocal(product);
      }
    }
    if (!inWishlist) {
      trackAddToWishlist(product.id, Number(product.price) || 0);
      toast.success('Хадгалсанд нэмэгдлээ', { description: product.title });
    } else {
      toast.info('Хадгалсанаас хасагдлаа', { description: product.title });
    }
  };

  return (
    <Card className="group flex h-full flex-col overflow-hidden hover:-translate-y-0.5 hover:shadow-xl hover:border-primary/30">
      <Link href={`/products/${product.slug}`} className="block" onClick={handleCardClick}>
        <div className="relative aspect-4/3 overflow-hidden bg-muted">
          {product.mainVideoUrl ? (
            <LazyCardVideo
              videoUrl={product.mainVideoUrl}
              posterUrl={product.thumbnailUrl}
              alt={product.title}
            />
          ) : product.thumbnailUrl ? (
            <Image
              src={product.thumbnailUrl}
              alt={product.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              unoptimized={product.thumbnailUrl.split('?')[0].toLowerCase().endsWith('.svg')}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
              Зураггүй
            </div>
          )}

          {/* Top-right badges */}
          <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
            {product.featured && (
              <div className="flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-secondary-foreground shadow-sm">
                <Star className="h-2.5 w-2.5 fill-current" />
                Онцлох
              </div>
            )}
            {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price) && (
              <div className="rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground shadow-sm">
                -{Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)}%
              </div>
            )}
          </div>
        </div>
      </Link>

      <CardContent className="flex flex-1 flex-col p-3 sm:p-4">
        {/* Категори арилгасан. Desktop: төрөл зүүн (0), үнэлгээ/татсан баруун (0)
            нэг мөрөнд тэлнэ. Mobile: багтахгүй тул үнэлгээ/татсан төрлийн ДООД мөрөнд. */}
        <div className="mb-1.5">
          {/* 1-р мөр: төрөл (зүүн) + үнэлгээ/татсан (desktop баруун, mobile нуугдана) */}
          <div className="flex items-center gap-1.5">
            <Badge variant={productTypeBadgeVariant(product.type)} className="text-[10px] sm:text-xs px-1.5 py-0 gap-1 shrink-0">
              {mounted && <DynamicLucideIcon name={typeIcon} className="h-2.5 w-2.5" />}
              {typeLabel}
            </Badge>
            {product.lessonCount != null && product.lessonCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] sm:text-xs text-primary font-medium shrink-0">
                <BookOpen className="h-3 w-3" />
                {product.lessonCount}
              </span>
            )}
            {/* Desktop: баруун 0-д — sm-ээс дээш л харагдана */}
            <div className="ml-auto hidden sm:flex items-center gap-2.5 shrink-0">
              {product.ratingCount > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold text-foreground">{product.rating.toFixed(1)}</span>
                  <span>({product.ratingCount})</span>
                </span>
              )}
              {product.downloadCount > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-orange-600 dark:text-orange-400 font-medium">
                  <Flame className="h-3 w-3" />
                  {product.downloadCount} татсан
                </span>
              )}
            </div>
          </div>
          {/* Mobile: 2-р мөрөнд бүтэн — sm-ээс доош л харагдана */}
          {(product.ratingCount > 0 || product.downloadCount > 0) && (
            <div className="mt-1 flex sm:hidden items-center gap-2.5 text-[10px] text-muted-foreground">
              {product.ratingCount > 0 && (
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold text-foreground">{product.rating.toFixed(1)}</span>
                  <span>({product.ratingCount})</span>
                </span>
              )}
              {product.downloadCount > 0 && (
                <span className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400 font-medium">
                  <Flame className="h-3 w-3" />
                  {product.downloadCount} татсан
                </span>
              )}
            </div>
          )}
        </div>

        <Link href={`/products/${product.slug}`} className="flex-1" onClick={handleCardClick}>
          <h3 className="text-xs sm:text-sm font-medium leading-snug transition-colors hover:text-primary" style={{ lineHeight: 1.4 }}>
            {product.title}
          </h3>
        </Link>

        <div className="mt-2 flex items-baseline justify-end gap-1.5">
          {(product.price == null || Number(product.price) === 0) ? (
            <p className="text-sm sm:text-base font-extrabold tabular-nums tracking-tight text-green-600 dark:text-green-400">
              Үнэгүй
            </p>
          ) : (
            <>
              <p className="text-sm sm:text-base font-extrabold tabular-nums tracking-tight text-foreground">
                {formatPrice(Number(product.price))}
              </p>
              {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price) && (
                <p className="text-[10px] sm:text-xs tabular-nums text-muted-foreground line-through">
                  {formatPrice(Number(product.compareAtPrice))}
                </p>
              )}
            </>
          )}
        </div>

      </CardContent>

      <CardFooter className="flex gap-1.5 p-3 sm:p-4 pt-0">
        {isPurchased ? (
          <Button
            size="sm"
            className="flex-1 h-8 text-xs sm:text-sm"
            variant="secondary"
            disabled
          >
            <CheckCircle className="mr-1 h-3.5 w-3.5" />
            Авсан
          </Button>
        ) : (product.price == null || Number(product.price) === 0) ? (
          /* Үнэгүй — сагсанд биш, шууд бүтээгдэхүүн рүү (тэнд татна) */
          <Button
            asChild
            size="sm"
            className="flex-1 h-8 text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white"
          >
            <Link href={`/products/${product.slug}`}>
              <Download className="mr-1 h-3.5 w-3.5" />
              Үнэгүй татах
            </Link>
          </Button>
        ) : (
          <Button
            size="sm"
            className="flex-1 h-8 text-xs sm:text-sm"
            variant={inCart ? 'secondary' : 'default'}
            onClick={handleAddToCart}
          >
            <ShoppingCart className="mr-1 h-3.5 w-3.5" />
            {inCart ? 'Сагслагдсан' : 'Сагсанд'}
          </Button>
        )}
        <Button
          size="icon"
          variant={inWishlist ? 'default' : 'outline'}
          className="h-8 w-8 shrink-0"
          onClick={handleWishlist}
          aria-label="Хадгалах"
        >
          <Heart className={`h-3.5 w-3.5 transition-transform ${inWishlist ? 'fill-current scale-110' : ''}`} />
        </Button>
      </CardFooter>
    </Card>
  );
}
