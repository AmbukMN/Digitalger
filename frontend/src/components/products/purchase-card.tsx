'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Button, Input } from '@digitalger/shared/ui';
import { formatPrice } from '@digitalger/shared';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Gift,
  Loader2,
  ShoppingCart,
  Star,
  Tag,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart';
import { useCouponStore, MAX_COUPONS_PER_PRODUCT } from '@/store/coupon';
import type { AppliedCoupon } from '@/store/coupon';
import { couponsApi, downloadsApi } from '@/lib/api';
import type { ProductDetail, PurchasedProduct } from '@/types/api';
import { DiscountTimer } from './discount-timer';

const EMPTY_COUPONS: AppliedCoupon[] = [];

// ─── Download all helper ──────────────────────────────────────────────────────
async function downloadAll(
  token: string,
  files: { id: string; fileName: string }[],
  onStart: () => void,
  onDone: () => void,
) {
  onStart();
  try {
    for (const file of files) {
      const result = await downloadsApi.signedUrl(token, file.id);
      const a = document.createElement('a');
      a.href = result.url;
      a.download = file.fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (files.length > 1) await new Promise((r) => setTimeout(r, 600));
    }
  } catch {
    toast.error('Татахад алдаа гарлаа');
  } finally {
    onDone();
  }
}

// ─── Purchased sidebar card (desktop) ────────────────────────────────────────
function PurchasedCard({
  purchase,
  product,
}: {
  purchase: PurchasedProduct;
  product: ProductDetail;
}) {
  const { data: session } = useSession();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const files = purchase.product.files;
  const hasFiles = files.length > 0;
  const hasLessons = product.course?.lessons && product.course.lessons.length > 0;
  const purchaseDate = new Date(purchase.purchasedAt).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  async function handleDownloadOne(fileId: string, fileName: string) {
    if (!session?.accessToken) return;
    setDownloading(fileId);
    try {
      const result = await downloadsApi.signedUrl(session.accessToken, fileId);
      const a = document.createElement('a');
      a.href = result.url;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast.error('Татахад алдаа гарлаа');
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadAll() {
    if (!session?.accessToken) return;
    await downloadAll(session.accessToken, files, () => setDownloadingAll(true), () => setDownloadingAll(false));
  }

  return (
    <div className="sticky top-24 rounded-2xl border border-green-200 dark:border-green-800 bg-card shadow-sm p-6 space-y-5">
      {/* Purchased header */}
      <div className="flex items-center gap-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-green-700 dark:text-green-400">Худалдаж авсан</p>
          <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">{purchaseDate}</p>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
          #{purchase.orderId.slice(-8).toUpperCase()}
        </span>
      </div>

      {/* Course info */}
      {hasLessons && (
        <div className="flex items-center gap-2 text-sm rounded-lg bg-muted/30 px-3 py-2.5">
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{product.course!.lessons.length}</span> хичээл нээлттэй
          </span>
        </div>
      )}

      {/* Download files */}
      {hasFiles && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              Татах файлууд ({files.length})
            </p>
            {files.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1"
                onClick={handleDownloadAll}
                disabled={downloadingAll}
              >
                {downloadingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                Бүгдийг татах
              </Button>
            )}
          </div>
          <ul className="space-y-1.5">
            {files.map((file) => (
              <li key={file.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 text-sm truncate font-medium">{file.fileName}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs gap-1 shrink-0"
                  onClick={() => handleDownloadOne(file.id, file.fileName)}
                  disabled={downloading === file.id || downloadingAll}
                >
                  {downloading === file.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  Татах
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Link to orders */}
      <Button asChild className="w-full" size="sm" variant="outline">
        <Link href="/orders">
          Захиалгыг харах
          <ChevronRight className="ml-1.5 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

// ─── Multi-coupon section ─────────────────────────────────────────────────────
function MultiCouponSection({
  basePrice,
  productId,
  coupons,
  onAdd,
  onRemove,
}: {
  basePrice: number;
  productId: string;
  coupons: AppliedCoupon[];
  onAdd: (coupon: AppliedCoupon) => void;
  onRemove: (code: string) => void;
}) {
  const { data: session } = useSession();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalDiscount = coupons.reduce((sum, c) => sum + c.discount, 0);
  const remainingPrice = Math.max(0, basePrice - totalDiscount);
  const canAddMore = coupons.length < MAX_COUPONS_PER_PRODUCT;

  async function handleApply() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    if (coupons.some((c) => c.code === trimmed)) {
      setError('Энэ купоныг аль хэдийн хэрэглэсэн байна');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await couponsApi.validate(trimmed, remainingPrice, {
        token: session?.accessToken,
        productIds: [productId],
      });
      if (res.valid) {
        onAdd(res);
        setCode('');
      } else {
        setError(res.message || 'Купон буруу байна');
      }
    } catch {
      setError('Алдаа гарлаа. Дахин оролдоно уу');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-border pt-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Купон хэрэглэх</span>
        {coupons.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {coupons.length}/{MAX_COUPONS_PER_PRODUCT}
          </span>
        )}
      </div>

      {/* Applied coupon list */}
      {coupons.length > 0 && (
        <div className="space-y-1.5">
          {coupons.map((c) => (
            <div
              key={c.code}
              className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2"
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
              <span className="text-xs font-bold font-mono text-green-700 dark:text-green-400 tracking-wider flex-1">
                {c.code}
              </span>
              <span className="text-xs text-green-600 dark:text-green-500 shrink-0">
                {c.type === 'PERCENT'
                  ? `-${c.value}% (${formatPrice(c.discount)})`
                  : `-${formatPrice(c.discount)}`}
              </span>
              <button
                type="button"
                onClick={() => onRemove(c.code)}
                className="shrink-0 text-green-600 dark:text-green-400 hover:text-destructive ml-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input field */}
      {canAddMore ? (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
              placeholder={coupons.length === 0 ? 'Купон кодоо оруулна уу' : 'Дараагийн купон...'}
              className="h-9 text-sm font-mono uppercase tracking-wider flex-1"
              onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
              disabled={loading}
            />
            <Button
              size="sm"
              className="h-9 px-4 shrink-0"
              onClick={handleApply}
              disabled={loading || !code.trim()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Хэрэглэх'}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Хамгийн ихдээ {MAX_COUPONS_PER_PRODUCT} купон хэрэглэх боломжтой.
        </p>
      )}
    </div>
  );
}

// ─── Main purchase card (desktop) ────────────────────────────────────────────
export function PurchaseCard({ product }: { product: ProductDetail }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const addToCart = useCartStore((s) => s.add);
  const coupons = useCouponStore((s) => s.coupons[product.id] ?? EMPTY_COUPONS);
  const addCoupon = useCouponStore((s) => s.add);
  const removeCoupon = useCouponStore((s) => s.remove);

  const { data: library = [], isLoading: libraryLoading } = useQuery({
    queryKey: ['downloads', 'history'],
    queryFn: () => downloadsApi.history(session!.accessToken!),
    enabled: !!session?.accessToken,
    staleTime: 60_000,
  });

  const purchase = library.find((item) => item.product.id === product.id) ?? null;
  const sessionLoading = status === 'loading' || (!!session && libraryLoading);

  const basePrice = Number(product.price);
  const totalDiscount = coupons.reduce((sum, c) => sum + c.discount, 0);
  const finalPrice = Math.max(0, basePrice - totalDiscount);
  const comparePrice =
    coupons.length > 0
      ? basePrice
      : product.compareAtPrice && Number(product.compareAtPrice) > basePrice
      ? Number(product.compareAtPrice)
      : null;

  const handleBuy = () => {
    addToCart(
      product,
      coupons.length > 0
        ? { couponCodes: coupons.map((c) => c.code), couponDiscount: totalDiscount }
        : undefined,
    );
    router.push('/checkout');
  };

  if (sessionLoading) {
    return (
      <div className="sticky top-24 rounded-2xl border border-border bg-card shadow-sm p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-2/3" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-11 bg-muted rounded" />
      </div>
    );
  }

  if (purchase) {
    return <PurchasedCard purchase={purchase} product={product} />;
  }

  return (
    <div className="sticky top-24 rounded-2xl border border-border bg-card shadow-sm p-6 space-y-5">
      {/* Price */}
      <div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className="text-3xl font-extrabold text-primary">
            {formatPrice(finalPrice)}
          </p>
          {comparePrice && comparePrice > finalPrice && (
            <p className="text-lg text-muted-foreground line-through">
              {formatPrice(comparePrice)}
            </p>
          )}
          {totalDiscount > 0 && (
            <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-bold text-green-700 dark:text-green-400">
              -{formatPrice(totalDiscount)}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="font-medium text-foreground">{product.rating.toFixed(1)}</span>
          <span>({product.ratingCount} үнэлгээ)</span>
        </div>
      </div>

      {/* Discount timer */}
      {product.discountEndsAt && (
        <DiscountTimer
          endsAt={product.discountEndsAt}
          discountLabel={
            product.compareAtPrice && Number(product.compareAtPrice) > basePrice
              ? `-${Math.round((1 - basePrice / Number(product.compareAtPrice)) * 100)}%`
              : undefined
          }
        />
      )}

      {/* CTA button */}
      <Button className="w-full font-bold" size="lg" onClick={handleBuy}>
        <ShoppingCart className="mr-2 h-4 w-4" />
        Шууд худалдаж авах
      </Button>

      {/* Quick details */}
      <div className="space-y-2 text-sm">
        {product.files && product.files.length > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Файл</span>
            <span className="font-medium">{product.files.length} файл</span>
          </div>
        )}
        {product.course?.lessons && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Хичээл</span>
            <span className="font-medium">{product.course.lessons.length} хичээл</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Хандалт</span>
          <span className="font-medium">Насан туршийн</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Татах</span>
          <span className="font-medium">Нэн даруй</span>
        </div>
      </div>

      {/* Multi-coupon section */}
      <MultiCouponSection
        basePrice={basePrice}
        productId={product.id}
        coupons={coupons}
        onAdd={(coupon) => addCoupon(product.id, coupon)}
        onRemove={(code) => removeCoupon(product.id, code)}
      />
    </div>
  );
}

// ─── Mobile sticky bottom bar ─────────────────────────────────────────────────
export function MobileBuyBar({ product }: { product: ProductDetail }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const addToCart = useCartStore((s) => s.add);
  const coupons = useCouponStore((s) => s.coupons[product.id] ?? EMPTY_COUPONS);
  const addCoupon = useCouponStore((s) => s.add);
  const removeCoupon = useCouponStore((s) => s.remove);
  const [couponOpen, setCouponOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: library = [], isLoading: libraryLoading } = useQuery({
    queryKey: ['downloads', 'history'],
    queryFn: () => downloadsApi.history(session!.accessToken!),
    enabled: !!session?.accessToken,
    staleTime: 60_000,
  });

  const purchase = library.find((item) => item.product.id === product.id) ?? null;
  const sessionLoading = status === 'loading' || (!!session && libraryLoading);

  const basePrice = Number(product.price);
  const totalDiscount = coupons.reduce((sum, c) => sum + c.discount, 0);
  const finalPrice = Math.max(0, basePrice - totalDiscount);

  async function handleApply() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    if (coupons.some((c) => c.code === trimmed)) {
      setError('Энэ купоныг аль хэдийн хэрэглэсэн байна');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const remainingPrice = Math.max(0, basePrice - totalDiscount);
      const res = await couponsApi.validate(trimmed, remainingPrice, {
        token: session?.accessToken,
        productIds: [product.id],
      });
      if (res.valid) {
        addCoupon(product.id, res);
        setCode('');
        if (coupons.length + 1 >= MAX_COUPONS_PER_PRODUCT) setCouponOpen(false);
      } else {
        setError(res.message || 'Купон буруу байна');
      }
    } catch {
      setError('Алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  }

  const handleBuy = () => {
    addToCart(
      product,
      coupons.length > 0
        ? { couponCodes: coupons.map((c) => c.code), couponDiscount: totalDiscount }
        : undefined,
    );
    router.push('/checkout');
  };

  async function handleDownloadOne(fileId: string, fileName: string) {
    if (!session?.accessToken) return;
    setDownloading(fileId);
    try {
      const result = await downloadsApi.signedUrl(session.accessToken, fileId);
      const a = document.createElement('a');
      a.href = result.url;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast.error('Татахад алдаа гарлаа');
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadAll() {
    if (!session?.accessToken || !purchase) return;
    await downloadAll(
      session.accessToken,
      purchase.product.files,
      () => setDownloadingAll(true),
      () => setDownloadingAll(false),
    );
  }

  if (sessionLoading) return null;

  // ── Purchased state ──────────────────────────────────────────────────────
  if (purchase) {
    const files = purchase.product.files;
    const hasFiles = files.length > 0;
    const hasLessons = product.course?.lessons && product.course.lessons.length > 0;

    return (
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-green-200 dark:border-green-800 bg-background/95 backdrop-blur-sm md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* Individual files (expandable) */}
        {filesOpen && hasFiles && (
          <div className="border-b border-border/40 px-4 py-3 bg-muted/20 space-y-2">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 text-sm truncate">{file.fileName}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs gap-1 shrink-0"
                  onClick={() => handleDownloadOne(file.id, file.fileName)}
                  disabled={downloading === file.id || downloadingAll}
                >
                  {downloading === file.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  Татах
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="px-4 py-3">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-green-700 dark:text-green-400 leading-tight">
                    Худалдаж авсан
                  </p>
                  {hasLessons && (
                    <span className="text-xs text-muted-foreground">
                      · {product.course!.lessons.length} хичээл нээлттэй
                    </span>
                  )}
                </div>
                {hasFiles && (
                  <button
                    type="button"
                    onClick={() => setFilesOpen((p) => !p)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                  >
                    <Download className="h-3 w-3" />
                    {files.length} файл татах боломжтой
                    <ChevronDown className={`h-3 w-3 transition-transform ${filesOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            </div>

            {hasFiles ? (
              <Button
                className="font-bold px-4 shrink-0"
                size="sm"
                onClick={handleDownloadAll}
                disabled={downloadingAll}
              >
                {downloadingAll ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-4 w-4" />
                )}
                Татах
              </Button>
            ) : (
              <Button asChild variant="outline" className="shrink-0" size="sm">
                <Link href="/orders">Захиалга</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Normal buy state ─────────────────────────────────────────────────────
  const canAddMore = coupons.length < MAX_COUPONS_PER_PRODUCT;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {product.discountEndsAt && (
        <div className="border-b border-border/40 px-4 py-2">
          <DiscountTimer
            endsAt={product.discountEndsAt}
            compact
            discountLabel={
              product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price)
                ? `-${Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)}%`
                : undefined
            }
          />
        </div>
      )}

      {/* Mobile coupon section (expandable) */}
      {couponOpen && (
        <div className="border-b border-border/40 px-4 py-3 bg-muted/20 space-y-2 w-full overflow-hidden">
          {/* Applied coupons */}
          {coupons.length > 0 && (
            <div className="space-y-1.5">
              {coupons.map((c) => (
                <div
                  key={c.code}
                  className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
                  <span className="flex-1 text-xs font-bold font-mono text-green-700 dark:text-green-400 tracking-wider">
                    {c.code}
                  </span>
                  <span className="text-xs text-green-600 dark:text-green-500 shrink-0">
                    {c.type === 'PERCENT' ? `-${c.value}% (${formatPrice(c.discount)})` : `-${formatPrice(c.discount)}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCoupon(product.id, c.code)}
                    className="text-green-600 dark:text-green-400 hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          {canAddMore ? (
            <div className="space-y-1.5">
              <div className="flex gap-2 w-full min-w-0">
                <Input
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
                  placeholder="Купон код"
                  className="h-9 text-sm font-mono uppercase tracking-wider min-w-0 flex-1"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
                  disabled={loading}
                  autoFocus
                />
                <Button size="sm" className="h-9 px-3 shrink-0 whitespace-nowrap" onClick={handleApply} disabled={loading || !code.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Хэрэглэх'}
                </Button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-1">
              Хамгийн ихдээ {MAX_COUPONS_PER_PRODUCT} купон хэрэглэх боломжтой.
            </p>
          )}
        </div>
      )}

      <div className="px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-extrabold text-primary">{formatPrice(finalPrice)}</p>
              {totalDiscount > 0 && (
                <p className="text-sm text-muted-foreground line-through">{formatPrice(basePrice)}</p>
              )}
              {totalDiscount === 0 && product.compareAtPrice && Number(product.compareAtPrice) > basePrice && (
                <p className="text-sm text-muted-foreground line-through">{formatPrice(Number(product.compareAtPrice))}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCouponOpen((p) => !p)}
              className="flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
            >
              <Tag className="h-3 w-3" />
              {coupons.length > 0 ? (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {coupons.length} купон хэрэглэгдсэн
                </span>
              ) : (
                <span>Купон байна уу?</span>
              )}
              <ChevronDown className={`h-3 w-3 transition-transform ${couponOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <Button className="font-bold px-4 shrink-0 text-sm" size="lg" onClick={handleBuy}>
            <ShoppingCart className="mr-1.5 h-4 w-4" />
            Шууд худалдаж авах
          </Button>
        </div>
      </div>
    </div>
  );
}
