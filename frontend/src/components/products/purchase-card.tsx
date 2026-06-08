'use client';

import { useEffect, useRef, useState } from 'react';
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
  Flame,
  Gift,
  Loader2,
  ShoppingCart,
  Tag,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCartStore } from '@/store/cart';
import { useCouponStore, MAX_COUPONS_PER_PRODUCT } from '@/store/coupon';
import type { AppliedCoupon } from '@/store/coupon';
import { couponsApi, downloadsApi } from '@/lib/api';
import type { ProductDetail, PurchasedProduct } from '@/types/api';
import { useFileDownload } from '@/hooks/use-file-download';
import { trackAddToCart, trackInitiateCheckout } from '@/lib/analytics';
import { DiscountTimer } from './discount-timer';
import { DownloadAllButton } from './download-all-button';
import { TrustBadges } from './trust-badges';

const EMPTY_COUPONS: AppliedCoupon[] = [];
const FILES_PAGE_SIZE = 10;

// ─── Purchased sidebar card (desktop) ────────────────────────────────────────
function PurchasedCard({
  purchase,
  product,
}: {
  purchase: PurchasedProduct;
  product: ProductDetail;
}) {
  const { download } = useFileDownload();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [visibleFiles, setVisibleFiles] = useState(FILES_PAGE_SIZE);

  const hasBundles = (purchase.product.bundles?.length ?? 0) > 0;

  // sidebar/mobile-д standalone + bundle файлуудыг нэгтгэж харуулна.
  // Bundle доторх файл нь ӨӨР product-ийн файл (cross-product) байж болох тул
  // product.files-аас хайхгүй — backend нэрийн хамт resolve хийсэн bundleFiles-ийг
  // шууд ашиглана (хоосон жагсаалтаас сэргийлнэ).
  const standaloneFiles = purchase.product.files; // backend-с шүүсэн standalone
  const bundleFiles = (purchase.product.bundleFiles ?? []).filter(
    (f) => !standaloneFiles.some((sf) => sf.id === f.id),
  );
  const files = [...standaloneFiles, ...bundleFiles];
  const hasFiles = files.length > 0;
  // "Бүх файлыг татах" товч — ЗӨВХӨН admin бэлэн zip (downloadFileKey) оруулсан үед.
  // Auto-zip болиулсан тул бэлэн zip байхгүй бол товч гарахгүй (зүйл бүрийг
  // жагсаалтаас нэг нэгээр татна).
  const canDownloadAll = !!purchase.product.downloadFileKey;
  const hasLessons = product.course?.lessons && product.course.lessons.length > 0;
  const purchaseDate = new Date(purchase.purchasedAt).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  async function handleDownloadOne(fileId: string, fileName: string) {
    if (downloading === fileId) return;
    setDownloading(fileId);
    try {
      await download(fileId, fileName);
    } finally {
      setDownloading(null);
    }
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
      {canDownloadAll && (
        <div className="space-y-2">
          <DownloadAllButton
            productId={purchase.product.id}
            downloadFileKey={purchase.product.downloadFileKey}
            zipName={`${purchase.product.slug}.zip`}
            variant="default"
            label={hasFiles ? `Бүх файлыг татах (${files.length})` : 'Бүх файлыг татах'}
            className="w-full justify-center font-semibold bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90"
          />
          {hasFiles && (
            <>
              <ul
                className={`space-y-1${
                  visibleFiles >= files.length && files.length > FILES_PAGE_SIZE
                    ? ' files-scroll max-h-72 overflow-y-auto pr-1'
                    : ''
                }`}
              >
                {files.slice(0, visibleFiles).map((file) => (
                  <li key={file.id} className="flex items-center gap-2 rounded-lg bg-muted/30 dark:bg-muted/20 border border-border/50 px-3 py-1.5">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-xs truncate text-foreground">{file.fileName}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs gap-1 shrink-0 text-primary hover:text-primary hover:bg-primary/10 dark:text-secondary dark:hover:text-secondary dark:hover:bg-secondary/10"
                      onClick={() => handleDownloadOne(file.id, file.fileName)}
                      disabled={downloading === file.id}
                    >
                      {downloading === file.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      Татах
                    </Button>
                  </li>
                ))}
              </ul>
              {files.length > visibleFiles && (
                <button
                  type="button"
                  onClick={() => setVisibleFiles(files.length)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  {files.length - visibleFiles} файл нэмж харах
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Link to orders */}
      <div className="flex justify-end">
        <Button asChild variant="outline" className="text-xs h-8 text-primary border-primary/30 hover:bg-transparent hover:text-primary hover:border-primary/60 dark:text-secondary dark:border-secondary/40 dark:hover:bg-transparent dark:hover:text-secondary dark:hover:border-secondary/70" size="sm">
          <Link href="/orders">
            Захиалгыг харах
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ─── ҮНЭГҮЙ бүтээгдэхүүний карт (нэвтрэхгүй, public татах) ───────────────────
// price=0/null бүтээгдэхүүн — хэн ч (нэвтрээгүй ч) шууд татна. Худалдаж авах
// товч/QPay байхгүй, paid шиг шууд татах UI.
function FreeCard({ product }: { product: ProductDetail }) {
  const freeDl = useFileDownload(product.id); // free public горим
  const [downloading, setDownloading] = useState<string | null>(null);
  const [visibleFiles, setVisibleFiles] = useState(FILES_PAGE_SIZE);

  const files = product.files ?? [];
  const hasFiles = files.length > 0;
  const hasBundles = (product.bundles?.length ?? 0) > 0;
  const hasZip = !!product.downloadFileKey;
  // "Бүх файлыг татах" — ЗӨВХӨН admin бэлэн zip (auto-zip болиулсан)
  const canDownloadAll = hasZip;
  const hasLessons = product.course?.lessons && product.course.lessons.length > 0;

  async function handleDownloadOne(fileId: string, fileName: string) {
    if (downloading === fileId) return;
    setDownloading(fileId);
    try {
      await freeDl.download(fileId, fileName);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="sticky top-24 rounded-2xl border border-green-200 dark:border-green-800 bg-card shadow-sm p-6 space-y-5">
      {/* Үнэгүй header */}
      <div className="flex items-center gap-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
        <Gift className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-lg font-black text-green-700 dark:text-green-400">Үнэгүй</p>
          <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">Бүртгэлгүйгээр шууд татаж авна</p>
        </div>
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

      {/* Download */}
      {canDownloadAll ? (
        <div className="space-y-2">
          <DownloadAllButton
            productId={product.id}
            downloadFileKey={product.downloadFileKey}
            zipName={`${product.slug}.zip`}
            variant="default"
            free
            label={hasFiles ? `Бүх файлыг татах (${files.length})` : 'Бүх файлыг татах'}
            className="w-full justify-center font-semibold bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90"
          />
          {hasFiles && (
            <>
              <ul
                className={`space-y-1${
                  visibleFiles >= files.length && files.length > FILES_PAGE_SIZE
                    ? ' files-scroll max-h-72 overflow-y-auto pr-1'
                    : ''
                }`}
              >
                {files.slice(0, visibleFiles).map((file) => (
                  <li key={file.id} className="flex items-center gap-2 rounded-lg bg-muted/30 dark:bg-muted/20 border border-border/50 px-3 py-1.5">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-xs truncate text-foreground">{file.fileName}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs gap-1 shrink-0 text-primary hover:text-primary hover:bg-primary/10 dark:text-secondary dark:hover:text-secondary dark:hover:bg-secondary/10"
                      onClick={() => handleDownloadOne(file.id, file.fileName)}
                      disabled={downloading === file.id}
                    >
                      {downloading === file.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      Татах
                    </Button>
                  </li>
                ))}
              </ul>
              {files.length > visibleFiles && (
                <button
                  type="button"
                  onClick={() => setVisibleFiles(files.length)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  {files.length - visibleFiles} файл нэмж харах
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">Татах файл байхгүй байна</p>
      )}
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
    <div className="mt-1 rounded-xl border border-amber-200/70 dark:border-primary/20 bg-amber-50/80 dark:bg-primary/[0.07] p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">Купон хэрэглэх</span>
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
  const [btnShake, setBtnShake] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setBtnShake(true);
      setTimeout(() => setBtnShake(false), 600);
    }, 4000);
    return () => clearInterval(id);
  }, []);
  const addCoupon = useCouponStore((s) => s.add);
  const removeCoupon = useCouponStore((s) => s.remove);

  const { data: library = [], isLoading: libraryLoading } = useQuery({
    queryKey: ['downloads', 'history'],
    queryFn: () => downloadsApi.history(session!.accessToken!),
    enabled: !!session?.accessToken,
    staleTime: 60_000,
  });

  // Хугацаа дууссан (isExpired) худалдан авалтыг "эзэмшээгүй" гэж үзнэ —
  // ингэснээр expired бол энгийн "худалдаж авах" статус автомат харагдана (#6).
  const purchase =
    library.find((item) => item.product.id === product.id && item.isExpired !== true) ?? null;
  const sessionLoading = status === 'loading' || (!!session && libraryLoading);

  const basePrice = Number(product.price);
  // Үнэгүй: үнэ 0/null/хоосон. Нэвтрэхгүй хэн ч шууд татна.
  const isFree = product.price == null || basePrice === 0 || Number.isNaN(basePrice);
  // Видео хичээлтэй эсэх — "Татах"→"Үзэх", trust badge "Шууд үзэх"
  const isVideoCourse = (product.course?.lessons?.length ?? 0) > 0
    || (product.course?.modules?.some((m) => m.lessons.length > 0) ?? false);
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
    trackAddToCart(product.id, product.slug, finalPrice);
    trackInitiateCheckout(finalPrice, 1);
    router.push('/checkout');
  };

  // Үнэгүй бол — нэвтрэх/худалдаж авах шаардлагагүй, шууд татах карт.
  // (Эзэмшсэн бол ердийнхөөрөө PurchasedCard — давхар татахгүй.)
  if (isFree && !purchase) {
    return <FreeCard product={product} />;
  }

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
    <div className="sticky top-24 rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.06] to-card shadow-md ring-1 ring-primary/10 p-6 space-y-5">
      {/* Price — foreground (white/dark), CTA-д л алт өнгө үлдэнэ. Баруун 0 (right-aligned). */}
      <div>
        <div className="flex items-baseline justify-end gap-3 flex-wrap">
          <p className="text-3xl font-black tabular-nums tracking-tight text-foreground">
            {formatPrice(finalPrice)}
          </p>
          {comparePrice && comparePrice > finalPrice && (
            <>
              <p className="text-base tabular-nums text-muted-foreground line-through">
                {formatPrice(comparePrice)}
              </p>
              <span className="rounded-md bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">
                -{Math.round((1 - finalPrice / comparePrice) * 100)}%
              </span>
            </>
          )}
          {totalDiscount > 0 && (
            <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              -{formatPrice(totalDiscount)} хэмнэлт
            </span>
          )}
        </div>
        {/* ⭐ үнэлгээ / 🔥 татсан тоо нь MAIN хэсэгт (гарчгийн доор) байгаа тул
            right sidebar-аас давхардуулахгүй — энд харуулахгүй (SS2 засвар). */}
      </div>

      {/* Urgency: discountEndsAt бодит хугацаа байвал countdown timer.
          Байхгүй бол зөвхөн хямдралтай үед "Хязгаарлагдмал хямдрал" badge
          (хуурамч timer гаргахгүй). */}
      {product.discountEndsAt ? (
        <DiscountTimer
          endsAt={product.discountEndsAt}
          discountLabel={
            product.compareAtPrice && Number(product.compareAtPrice) > basePrice
              ? `-${Math.round((1 - basePrice / Number(product.compareAtPrice)) * 100)}%`
              : undefined
          }
        />
      ) : (
        comparePrice && comparePrice > finalPrice && (
          <div className="flex items-center gap-2 rounded-lg bg-secondary/90 px-3 py-2">
            <Flame className="h-4 w-4 shrink-0 text-secondary-foreground" />
            <span className="text-xs font-bold text-secondary-foreground">Хязгаарлагдмал хямдрал</span>
            <span className="ml-auto rounded-full bg-secondary-foreground/15 px-2 py-0.5 text-xs font-bold text-secondary-foreground">
              -{Math.round((1 - finalPrice / comparePrice) * 100)}%
            </span>
          </div>
        )
      )}

      {/* CTA — gold primary button, price-аас тодорхой ялгарна */}
      <Button className={`w-full font-bold text-base h-12 transition-transform ${btnShake ? 'cart-shake' : ''}`} size="lg" onClick={handleBuy}>
        <ShoppingCart className="mr-2 h-5 w-5" />
        <span className="sm:hidden">Худалдаж авах</span>
        <span className="hidden sm:inline">Шууд худалдаж авах</span>
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
      </div>

      {/* Trust badges — итгэлийн тэмдгүүд (eco/teal зөөлөн background).
          "Хандалт"/"Татах" хүснэгт мөрийг ЭНД нэгтгэв — давхардалгүй (SS2 засвар):
          хандалт (Насан туршийн/N сар) + "Шууд татах/үзэх" badge энд динамикаар гарна. */}
      <div className="rounded-xl border border-teal-500/20 bg-teal-500/6 dark:bg-teal-400/6 p-3">
        <TrustBadges
          isVideoCourse={isVideoCourse}
          accessType={product.accessType}
          accessDays={product.accessDays}
        />
      </div>

      {/* Coupon section — visually distinct from sidebar bg */}
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
  // Үнэгүй бол public (нэвтрэхгүй) горимоор татна; эс бол ердийн (эзэмшсэн) горим.
  const isFreeProduct = product.price == null || Number(product.price) === 0 || Number.isNaN(Number(product.price));
  const { download } = useFileDownload(isFreeProduct ? product.id : undefined);
  const addToCart = useCartStore((s) => s.add);
  const coupons = useCouponStore((s) => s.coupons[product.id] ?? EMPTY_COUPONS);
  const addCoupon = useCouponStore((s) => s.add);
  const removeCoupon = useCouponStore((s) => s.remove);
  const [couponOpen, setCouponOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [mobileVisibleFiles, setMobileVisibleFiles] = useState(FILES_PAGE_SIZE);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [btnShake, setBtnShake] = useState(false);
  const couponRef = useRef<HTMLDivElement>(null);
  const filesBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setBtnShake(true);
      setTimeout(() => setBtnShake(false), 600);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!couponOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (couponRef.current && !couponRef.current.contains(e.target as Node)) {
        setCouponOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [couponOpen]);

  useEffect(() => {
    if (!filesOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (filesBarRef.current && !filesBarRef.current.contains(e.target as Node)) {
        setFilesOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [filesOpen]);

  const { data: library = [], isLoading: libraryLoading } = useQuery({
    queryKey: ['downloads', 'history'],
    queryFn: () => downloadsApi.history(session!.accessToken!),
    enabled: !!session?.accessToken,
    staleTime: 60_000,
  });

  // Expired бол "эзэмшээгүй" гэж үзнэ — энгийн худалдаж авах bar харагдана (#6).
  const purchase =
    library.find((item) => item.product.id === product.id && item.isExpired !== true) ?? null;
  const sessionLoading = status === 'loading' || (!!session && libraryLoading);

  const basePrice = Number(product.price);
  const isFree = product.price == null || basePrice === 0 || Number.isNaN(basePrice);
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
    trackAddToCart(product.id, product.slug, finalPrice);
    trackInitiateCheckout(finalPrice, 1);
    router.push('/checkout');
  };

  async function handleDownloadOne(fileId: string, fileName: string) {
    if (downloading === fileId) return;
    setDownloading(fileId);
    try {
      await download(fileId, fileName);
    } finally {
      setDownloading(null);
    }
  }

  if (sessionLoading) return null;

  // ── Үнэгүй state (нэвтрэхгүй шууд татах) ──────────────────────────────────
  if (isFree && !purchase) {
    const freeFiles = product.files ?? [];
    const freeHasFiles = freeFiles.length > 0;
    const freeHasBundles = (product.bundles?.length ?? 0) > 0;
    const freeHasZip = !!product.downloadFileKey;
    const freeCanDownload = freeHasFiles || freeHasBundles || freeHasZip;

    return (
      <div
        ref={filesBarRef}
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-green-200 dark:border-green-800 backdrop-blur-md md:hidden bg-[oklch(0.97_0.025_150)] dark:bg-[oklch(0.26_0.06_160)] shadow-[0_-4px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Файлууд (expandable) */}
        {filesOpen && freeHasFiles && (
          <div className="border-b border-border/40 px-4 py-3 bg-muted/30 dark:bg-muted/10">
            <div
              className={`space-y-1${
                mobileVisibleFiles >= freeFiles.length && freeFiles.length > FILES_PAGE_SIZE
                  ? ' files-scroll max-h-64 overflow-y-auto pr-1'
                  : ''
              }`}
            >
              {freeFiles.slice(0, mobileVisibleFiles).map((file) => (
                <div key={file.id} className="flex items-center gap-2 rounded-lg bg-card dark:bg-card border border-border/50 px-3 py-1.5">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-xs truncate text-foreground">{file.fileName}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs gap-1 shrink-0 text-primary hover:text-primary hover:bg-primary/10 dark:text-secondary dark:hover:text-secondary dark:hover:bg-secondary/10"
                    onClick={() => handleDownloadOne(file.id, file.fileName)}
                    disabled={downloading === file.id}
                  >
                    {downloading === file.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    Татах
                  </Button>
                </div>
              ))}
            </div>
            {freeFiles.length > mobileVisibleFiles && (
              <button
                type="button"
                onClick={() => setMobileVisibleFiles(freeFiles.length)}
                className="w-full flex items-center justify-center gap-1.5 pt-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                {freeFiles.length - mobileVisibleFiles} файл нэмж харах
              </button>
            )}
          </div>
        )}

        <div className="px-4 py-3">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Gift className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-green-700 dark:text-green-400 leading-tight">Үнэгүй</p>
                {freeHasFiles && (
                  <button
                    type="button"
                    onClick={() => setFilesOpen((p) => !p)}
                    className="flex items-center gap-1 text-xs text-primary dark:text-secondary hover:underline mt-0.5"
                  >
                    <Download className="h-3 w-3" />
                    {freeFiles.length} файл татах
                    <ChevronDown className={`h-3 w-3 transition-transform ${filesOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            </div>
            {freeCanDownload && (
              <DownloadAllButton
                productId={product.id}
                downloadFileKey={product.downloadFileKey}
                zipName={`${product.slug}.zip`}
                variant="default"
                free
                label="Бүх файлыг татах"
                className="shrink-0 text-xs bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Purchased state ──────────────────────────────────────────────────────
  if (purchase) {
    // Bundle доторх (cross-product) файлыг backend-ийн resolve хийсэн bundleFiles-ээс авна
    const standaloneM = purchase.product.files;
    const bundleFilesM = (purchase.product.bundleFiles ?? []).filter(
      (f) => !standaloneM.some((sf) => sf.id === f.id),
    );
    const files = [...standaloneM, ...bundleFilesM];
    const hasFiles = files.length > 0;
    // "Бүх файлыг татах" — ЗӨВХӨН admin бэлэн zip (auto-zip болиулсан)
    const canDownloadAll = !!purchase.product.downloadFileKey;
    const hasLessons = product.course?.lessons && product.course.lessons.length > 0;

    return (
      <div
        ref={filesBarRef}
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-green-200 dark:border-green-800 backdrop-blur-md md:hidden bg-[oklch(0.97_0.025_150)] dark:bg-[oklch(0.26_0.06_160)] shadow-[0_-4px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Individual files (expandable) */}
        {filesOpen && hasFiles && (
          <div className="border-b border-border/40 px-4 py-3 bg-muted/30 dark:bg-muted/10">
            <div
              className={`space-y-1${
                mobileVisibleFiles >= files.length && files.length > FILES_PAGE_SIZE
                  ? ' files-scroll max-h-64 overflow-y-auto pr-1'
                  : ''
              }`}
            >
              {files.slice(0, mobileVisibleFiles).map((file) => (
                <div key={file.id} className="flex items-center gap-2 rounded-lg bg-card dark:bg-card border border-border/50 px-3 py-1.5">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-xs truncate text-foreground">{file.fileName}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs gap-1 shrink-0 text-primary hover:text-primary hover:bg-primary/10 dark:text-secondary dark:hover:text-secondary dark:hover:bg-secondary/10"
                    onClick={() => handleDownloadOne(file.id, file.fileName)}
                    disabled={downloading === file.id}
                  >
                    {downloading === file.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    Татах
                  </Button>
                </div>
              ))}
            </div>
            {files.length > mobileVisibleFiles && (
              <button
                type="button"
                onClick={() => setMobileVisibleFiles(files.length)}
                className="w-full flex items-center justify-center gap-1.5 pt-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                {files.length - mobileVisibleFiles} файл нэмж харах
              </button>
            )}
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
                    className="flex items-center gap-1 text-xs text-primary dark:text-secondary hover:underline mt-0.5"
                  >
                    <Download className="h-3 w-3" />
                    {files.length} файл татах боломжтой
                    <ChevronDown className={`h-3 w-3 transition-transform ${filesOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            </div>

            {canDownloadAll ? (
              <DownloadAllButton
                productId={purchase.product.id}
                downloadFileKey={purchase.product.downloadFileKey}
                zipName={`${purchase.product.slug}.zip`}
                variant="default"
                label="Бүх файлыг татах"
                className="shrink-0 text-xs bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90"
              />
            ) : (
              <Button asChild variant="outline" size="sm" className="shrink-0 text-xs h-8 text-muted-foreground hover:text-foreground">
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
    <div
      className="fixed bottom-0 left-0 right-0 z-30 backdrop-blur-md md:hidden bg-[oklch(0.965_0.01_264)] dark:bg-[oklch(0.26_0.09_262)] shadow-[0_-4px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)]"
      style={{ borderTop: '2px solid oklch(0.847 0.178 85.87)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {product.discountEndsAt && (
        <div className="border-b border-border/40 px-4 py-2">
          <DiscountTimer
            endsAt={product.discountEndsAt}
            compact
            hideDay
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
        <div ref={couponRef} className="border-b border-amber-200/70 dark:border-primary/20 px-4 py-3 bg-amber-50/80 dark:bg-primary/[0.08] space-y-2 w-full overflow-hidden animate-coupon-slide-up">
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
              <p className="text-xl font-black tabular-nums tracking-tight text-primary">{formatPrice(finalPrice)}</p>
              {totalDiscount > 0 && (
                <p className="text-sm tabular-nums text-muted-foreground line-through">{formatPrice(basePrice)}</p>
              )}
              {totalDiscount === 0 && product.compareAtPrice && Number(product.compareAtPrice) > basePrice && (
                <p className="text-sm tabular-nums text-muted-foreground line-through">{formatPrice(Number(product.compareAtPrice))}</p>
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
          <Button
            className={`font-bold px-4 shrink-0 text-sm transition-transform ${btnShake ? 'cart-shake' : ''}`}
            style={{ background: 'oklch(0.847 0.178 85.87)', color: 'oklch(0.1 0.04 264)' }}
            size="lg"
            onClick={handleBuy}
          >
            <ShoppingCart className="mr-1.5 h-4 w-4" />
            <span className="sm:hidden">Худалдаж авах</span>
            <span className="hidden sm:inline">Шууд худалдаж авах</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
