'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal, Tag, X } from 'lucide-react';
import { Badge, Button, Sheet, SheetContent, SheetTrigger } from '@digitalger/shared/ui';
import { cn } from '@digitalger/shared';
import type { Category } from '@/types/api';
import type { ProductTypeConfig } from '@/lib/api';

const SORT_OPTIONS = [
  { value: '', label: 'Хамгийн шинэ' },
  { value: 'newest', label: 'Шинэ эхэнд' },
  { value: 'discount', label: 'Хямдралтай' },
  { value: 'rating', label: 'Үнэлгээгээр' },
  { value: 'downloads', label: 'Таталтаар' },
] as const;

const COLLAPSE_AT = 5;

interface Props {
  categories: Category[];
  productTypes: ProductTypeConfig[];
  total: number;
}

function SectionLabel({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
    </button>
  );
}

function FilterSection({ label, children, defaultOpen = true }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border/60 pt-1">
      <SectionLabel label={label} open={open} onToggle={() => setOpen((v) => !v)} />
      {open && <div className="pb-1 space-y-0.5">{children}</div>}
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
  count,
  emoji,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
  emoji?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-all duration-150 text-left gap-2',
        active
          ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
          : 'text-foreground/80 hover:bg-muted hover:text-foreground dark:hover:bg-muted/50',
      )}
    >
      <span className="flex items-center gap-2 min-w-0">
        {emoji && <span className="shrink-0 text-base leading-none">{emoji}</span>}
        <span className="truncate">{children}</span>
      </span>
      {count !== undefined && (
        <span className={cn('text-[11px] tabular-nums shrink-0 font-medium', active ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {count}
        </span>
      )}
    </button>
  );
}

function CollapseList<T>({
  items,
  renderItem,
}: {
  items: T[];
  renderItem: (item: T, idx: number) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, COLLAPSE_AT);
  const remaining = items.length - COLLAPSE_AT;

  return (
    <>
      {visible.map((item, idx) => renderItem(item, idx))}
      {items.length > COLLAPSE_AT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 pl-2.5 py-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" />Хураах</>
          ) : (
            <><ChevronDown className="h-3 w-3" />+{remaining} дэлгэх</>
          )}
        </button>
      )}
    </>
  );
}

function FilterContent({ categories, productTypes, total, onClose }: Props & { onClose?: () => void }) {
  const router = useRouter();
  const sp = useSearchParams();

  const currentCategory = sp.get('category') ?? '';
  const currentType = sp.get('type') ?? sp.get('types') ?? '';
  const currentSort = sp.get('sortBy') ?? '';
  const currentOnSale = sp.get('onSale') === 'true';
  const currentFeatured = sp.get('featured') === 'true';

  const push = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(sp.toString());
      params.delete('page');
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '') params.delete(k);
        else params.set(k, v);
      }
      router.push(`/products?${params.toString()}`);
      onClose?.();
    },
    [router, sp, onClose],
  );

  const activeCount = [currentCategory, currentType, currentSort, currentOnSale, currentFeatured].filter(Boolean).length;
  const clearAll = () => { router.push('/products'); onClose?.(); };

  return (
    <div className="space-y-0">
      {/* Top: total + clear */}
      <div className="flex items-center justify-between py-2">
        <span className="text-xs text-muted-foreground font-medium">
          {total.toLocaleString()} бүтээгдэхүүн
        </span>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 font-medium transition-colors"
          >
            <X className="h-3 w-3" />
            Цэвэрлэх
          </button>
        )}
      </div>

      {/* Sort */}
      <FilterSection label="Эрэмбэлэх">
        {SORT_OPTIONS.map((opt) => (
          <FilterBtn
            key={opt.value}
            active={currentSort === opt.value}
            onClick={() => push({ sortBy: opt.value })}
          >
            {opt.label}
          </FilterBtn>
        ))}
      </FilterSection>

      {/* Special */}
      <FilterSection label="Тусгай">
        <FilterBtn active={currentOnSale} onClick={() => push({ onSale: currentOnSale ? null : 'true' })} emoji="🏷️">
          Хямдралтай
        </FilterBtn>
        <FilterBtn active={currentFeatured} onClick={() => push({ featured: currentFeatured ? null : 'true' })} emoji="⭐">
          Онцлох
        </FilterBtn>
      </FilterSection>

      {/* Product types */}
      {productTypes.length > 0 && (
        <FilterSection label="Төрөл">
          <FilterBtn active={!currentType} onClick={() => push({ type: null, types: null })}>
            Бүгд
          </FilterBtn>
          <CollapseList
            items={productTypes}
            renderItem={(t) => (
              <FilterBtn
                key={t.value}
                active={currentType === t.value}
                onClick={() => push({ type: currentType === t.value ? null : t.value, types: null })}
              >
                {t.label}
              </FilterBtn>
            )}
          />
        </FilterSection>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <FilterSection label="Ангилал">
          <FilterBtn active={!currentCategory} onClick={() => push({ category: null })}>
            Бүгд
          </FilterBtn>
          <CollapseList
            items={categories}
            renderItem={(c) => (
              <FilterBtn
                key={c.slug}
                active={currentCategory === c.slug}
                onClick={() => push({ category: currentCategory === c.slug ? null : c.slug })}
                count={c._count?.products}
              >
                {c.name}
              </FilterBtn>
            )}
          />
        </FilterSection>
      )}
    </div>
  );
}

/* Desktop sidebar */
export function ProductsFilterDesktop(props: Props) {
  return <FilterContent {...props} />;
}

/* Mobile sheet trigger */
export function ProductsFilterMobile(props: Props) {
  const [open, setOpen] = useState(false);
  const sp = useSearchParams();

  const currentCategory = sp.get('category') ?? '';
  const currentType = sp.get('type') ?? sp.get('types') ?? '';
  const currentSort = sp.get('sortBy') ?? '';
  const currentOnSale = sp.get('onSale') === 'true';
  const currentFeatured = sp.get('featured') === 'true';
  const activeCount = [currentCategory, currentType, currentSort, currentOnSale, currentFeatured].filter(Boolean).length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Шүүлтүүр
          {activeCount > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4 min-w-4 flex items-center justify-center">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" title="Шүүлтүүр" className="w-72 p-0 overflow-y-auto flex flex-col">
        {/* Sheet header — энд л нэг Шүүлтүүр гарна */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Шүүлтүүр</span>
            {activeCount > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
                {activeCount}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex-1 px-4 pb-6">
          <FilterContent
            {...props}
            onClose={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* Combined export — хуучин нэрийг хадгалахын тулд */
export function ProductsFilter(props: Props) {
  return (
    <>
      <div className="hidden lg:block">
        <ProductsFilterDesktop {...props} />
      </div>
      <div className="lg:hidden">
        <ProductsFilterMobile {...props} />
      </div>
    </>
  );
}
