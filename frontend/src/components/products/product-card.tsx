'use client';

import { Badge, Button, Card, CardContent, CardFooter } from '@digitalger/shared/ui';
import { formatPrice } from '@digitalger/shared';
import { BookOpen, Heart, ShoppingCart, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PRODUCT_TYPE_LABELS } from '@/lib/constants';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import type { ProductSummary } from '@/types/api';

export function ProductCard({ product }: { product: ProductSummary }) {
  const addToCart = useCartStore((s) => s.add);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const inWishlistRaw = useWishlistStore((s) => s.has(product.id));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const inWishlist = mounted && inWishlistRaw;

  const handleWishlist = () => {
    toggleWishlist(product);
  };

  return (
    <>
      <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
        <Link href={`/products/${product.slug}`} className="block">
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
                className="object-cover transition-transform group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
                Зураггүй
              </div>
            )}
            {product.featured && (
              <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground shadow-sm">
                <Star className="h-3 w-3 fill-current" />
                Онцлох
              </div>
            )}
          </div>
        </Link>

        <CardContent className="flex flex-1 flex-col p-3 sm:p-4">
          <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0">
              {PRODUCT_TYPE_LABELS[product.type] ?? product.type}
            </Badge>
            {product.category && (
              <Link
                href={`/categories/${product.category.slug}`}
                className="text-[10px] sm:text-xs text-muted-foreground hover:text-primary truncate max-w-20"
              >
                {product.category.name}
              </Link>
            )}
            {(product.type === 'LESSON' || product.type === 'BUNDLE') && product.lessonCount != null && product.lessonCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] sm:text-xs text-primary font-medium">
                <BookOpen className="h-3 w-3" />
                {product.lessonCount} хичээл
              </span>
            )}
          </div>
          <Link href={`/products/${product.slug}`} className="flex-1">
            <h3 className="line-clamp-2 text-xs sm:text-sm font-semibold leading-snug hover:text-primary">
              {product.title}
            </h3>
          </Link>
          <div className="mt-2 flex items-baseline gap-1.5">
            <p className="text-sm sm:text-base font-bold text-primary">
              {formatPrice(Number(product.price))}
            </p>
            {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price) && (
              <p className="text-[10px] sm:text-xs text-muted-foreground line-through">
                {formatPrice(Number(product.compareAtPrice))}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex gap-1.5 p-3 sm:p-4 pt-0">
          <Button
            size="sm"
            className="flex-1 h-8 text-xs sm:text-sm"
            onClick={() => addToCart(product)}
          >
            <ShoppingCart className="mr-1 h-3.5 w-3.5" />
            Сагсанд
          </Button>
          <Button
            size="icon"
            variant={inWishlist ? 'default' : 'outline'}
            className="h-8 w-8 shrink-0"
            onClick={handleWishlist}
            aria-label="Хадгалах"
          >
            <Heart className={`h-3.5 w-3.5 ${inWishlist ? 'fill-current' : ''}`} />
          </Button>
        </CardFooter>
      </Card>

    </>
  );
}
