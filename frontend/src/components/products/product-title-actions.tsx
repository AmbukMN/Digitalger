'use client';

import { useEffect, useRef, useState } from 'react';
import { Heart, Share2, Link as LinkIcon, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { useWishlistStore } from '@/store/wishlist';
import { wishlistApi } from '@/lib/api';
import type { ProductSummary } from '@/types/api';

interface ProductTitleActionsProps {
  product: Pick<ProductSummary, 'id' | 'title' | 'slug' | 'price' | 'thumbnailUrl' | 'type'> & {
    compareAtPrice?: string | number | null;
    category?: { id: string; name: string; slug: string } | null;
    featured?: boolean;
    rating?: number;
    ratingCount?: number;
    downloadCount?: number;
  };
}

export function ProductTitleActions({ product }: ProductTitleActionsProps) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const toggleWishlistLocal = useWishlistStore((s) => s.toggle);
  const inWishlistRaw = useWishlistStore((s) => s.has(product.id));
  const [mounted, setMounted] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!shareOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [shareOpen]);

  const inWishlist = mounted && inWishlistRaw;
  const pageUrl = typeof window !== 'undefined' ? window.location.href : `https://digitalger.mn/products/${product.slug}`;

  const handleWishlist = async () => {
    toggleWishlistLocal(product as any);
    if (token) {
      try {
        await wishlistApi.toggle(token, product.id);
      } catch {
        toggleWishlistLocal(product as any);
      }
    }
    toast.success(inWishlist ? 'Хадгалсанаас хасагдлаа' : 'Хадгалсанд нэмэгдлээ');
  };

  const handleFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`, '_blank', 'width=600,height=400');
    setShareOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      toast.success('Холбоос хуулагдлаа');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Хуулахад алдаа гарлаа');
    }
    setShareOpen(false);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Favourite */}
      <button
        type="button"
        onClick={handleWishlist}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
          inWishlist
            ? 'bg-muted/70 text-primary hover:bg-primary/20 dark:bg-muted'
            : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
        }`}
        aria-label={inWishlist ? 'Хадгалсанаас хасах' : 'Хадгалах'}
        title={inWishlist ? 'Хадгалсанаас хасах' : 'Хадгалах'}
      >
        <Heart className={`h-4 w-4 ${inWishlist ? 'fill-current' : ''}`} />
      </button>

      {/* Share */}
      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setShareOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          aria-label="Хуваалцах"
          title="Хуваалцах"
        >
          <Share2 className="h-4 w-4" />
        </button>

        {shareOpen && (
          <div className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
            <button
              type="button"
              onClick={handleFacebook}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors"
            >
              <svg className="h-4 w-4 shrink-0 fill-blue-600" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </button>
            <div className="h-px bg-border" />
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              {copied ? 'Хуулагдлаа' : 'Холбоос хуулах'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
