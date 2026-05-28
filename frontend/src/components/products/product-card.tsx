'use client';

import { Badge, Button, Card, CardContent, CardFooter, productTypeBadgeVariant } from '@digitalger/shared/ui';
import { formatPrice } from '@digitalger/shared';
import { BookOpen, CheckCircle, Heart, ShoppingCart, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useProductTypeIcon, useProductTypeLabel } from '@/hooks/use-product-types';
import { DynamicLucideIcon } from '@/components/ui/lucide-icon';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import { downloadsApi, wishlistApi } from '@/lib/api';
import { trackProductClick, trackAddToCart } from '@/lib/analytics';
import type { ProductSummary } from '@/types/api';

export function ProductCard({ product }: { product: ProductSummary }) {
  const { data: session } = useSession();
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

  const isPurchased = mounted && !!purchased?.some((p) => p.product.id === product.id);
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
    trackAddToCart(product.id, product.slug);
    toast.success('Сагсанд нэмэгдлээ', { description: product.title });
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
    if (!inWishlist) toast.success('Хадгалсанд нэмэгдлээ', { description: product.title });
    else toast.info('Хадгалсанаас хасагдлаа', { description: product.title });
  };

  return (
    <Card className="group flex h-full flex-col overflow-hidden hover:-translate-y-0.5 hover:shadow-xl hover:border-primary/30">
      <Link href={`/products/${product.slug}`} className="block" onClick={() => trackProductClick(product.id, product.slug)}>
        <div className="relative aspect-4/3 overflow-hidden bg-muted">
          {product.mainVideoUrl ? (
            <video
              src={product.mainVideoUrl}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
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
        <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
          <Badge variant={productTypeBadgeVariant(product.type)} className="text-[10px] sm:text-xs px-1.5 py-0 gap-1">
            {mounted && <DynamicLucideIcon name={typeIcon} className="h-2.5 w-2.5" />}
            {typeLabel}
          </Badge>
          {product.category && (
            <Link
              href={`/categories/${product.category.slug}`}
              className="text-[9px] sm:text-[10px] uppercase tracking-wider font-medium text-muted-foreground hover:text-primary transition-colors truncate max-w-24"
            >
              {product.category.name}
            </Link>
          )}
          {product.lessonCount != null && product.lessonCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] sm:text-xs text-primary font-medium">
              <BookOpen className="h-3 w-3" />
              {product.lessonCount} хичээл
            </span>
          )}
        </div>

        <Link href={`/products/${product.slug}`} className="flex-1">
          <h3 className="text-xs sm:text-sm font-medium leading-snug transition-colors hover:text-primary" style={{ lineHeight: 1.4 }}>
            {product.title}
          </h3>
        </Link>

        <div className="mt-2 flex items-baseline gap-1.5">
          <p className="text-sm sm:text-base font-extrabold tabular-nums tracking-tight text-foreground">
            {formatPrice(Number(product.price))}
          </p>
          {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price) && (
            <p className="text-[10px] sm:text-xs tabular-nums text-muted-foreground line-through">
              {formatPrice(Number(product.compareAtPrice))}
            </p>
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
