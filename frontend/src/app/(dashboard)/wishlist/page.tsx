'use client';

import { useState } from 'react';
import { Button, EmptyState } from '@digitalger/shared/ui';
import Link from 'next/link';
import { ProductGrid } from '@/components/products/product-grid';
import { Pagination } from '@/components/ui/pagination';
import { useWishlistStore } from '@/store/wishlist';

const PAGE_SIZE = 12;

export default function WishlistPage() {
  const products = useWishlistStore((s) => s.items);
  const [page, setPage] = useState(1);

  const paged = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Хадгалсан</h1>
          <p className="mt-1 text-sm text-muted-foreground">Дараа нь худалдан авах бүтээгдэхүүн</p>
        </div>
        {products.length > 0 && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {products.length} бүтээгдэхүүн
          </span>
        )}
      </div>

      {products.length === 0 ? (
        <EmptyState
          title="Хоосон"
          description="Таалагдсан бүтээгдэхүүнээ энд хадгална"
          className="mt-8"
          action={
            <Button asChild>
              <Link href="/products">Дэлгүүр рүү</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ProductGrid products={paged} />
          <Pagination
            page={page}
            total={products.length}
            pageSize={PAGE_SIZE}
            onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        </>
      )}
    </div>
  );
}
