'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@digitalger/shared/ui';
import { cn, formatPrice } from '@digitalger/shared';
import { productsApi, blogApi } from '@/lib/api';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface Props {
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  onNavigate?: () => void;
}

export function SearchAutocomplete({ placeholder = 'Хайх...', className, inputClassName, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQ = useDebounce(query, 250);

  const { data: productResults } = useQuery({
    queryKey: ['search-ac', 'products', debouncedQ],
    queryFn: () => productsApi.search(debouncedQ, 1, 4),
    enabled: debouncedQ.length >= 2,
    staleTime: 30_000,
  });

  const { data: blogResults } = useQuery({
    queryKey: ['search-ac', 'blog', debouncedQ],
    queryFn: () => blogApi.search(debouncedQ),
    enabled: debouncedQ.length >= 2,
    staleTime: 30_000,
  });

  const products = productResults?.items?.slice(0, 4) ?? [];
  const posts = (blogResults ?? []).slice(0, 2);
  const hasResults = products.length > 0 || posts.length > 0;
  const showDropdown = open && debouncedQ.length >= 2;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const navigate = (href: string) => {
    router.push(href);
    setQuery('');
    setOpen(false);
    onNavigate?.();
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <form onSubmit={submit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            placeholder={placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className={cn('pl-9 pr-8', inputClassName)}
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          {!hasResults ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Илэрц олдсонгүй
            </div>
          ) : (
            <>
              {products.length > 0 && (
                <div>
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Бүтээгдэхүүн
                  </p>
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigate(`/products/${p.slug}`)}
                      className="flex w-full items-center gap-3 px-3 py-2 hover:bg-muted transition-colors text-left"
                    >
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {p.thumbnailUrl ? (
                          <Image src={p.thumbnailUrl} alt={p.title} fill className="object-cover" sizes="40px" />
                        ) : (
                          <div className="h-full w-full bg-primary/10" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium line-clamp-1">{p.title}</p>
                        <p className="text-xs text-primary font-semibold">{formatPrice(Number(p.price))}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {posts.length > 0 && (
                <div className={products.length > 0 ? 'border-t border-border' : ''}>
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Нийтлэл
                  </p>
                  {posts.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => navigate(`/blog/${post.slug}`)}
                      className="flex w-full items-center gap-3 px-3 py-2 hover:bg-muted transition-colors text-left"
                    >
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {post.coverImageUrl ? (
                          <Image src={post.coverImageUrl} alt={post.title} fill className="object-cover" sizes="40px" />
                        ) : (
                          <div className="h-full w-full bg-muted" />
                        )}
                      </div>
                      <p className="text-sm font-medium line-clamp-1 min-w-0 flex-1">{post.title}</p>
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-sm text-primary hover:bg-primary/5 transition-colors font-medium"
              >
                <Search className="h-3.5 w-3.5" />
                "{query}" -г бүгдийг харах
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
