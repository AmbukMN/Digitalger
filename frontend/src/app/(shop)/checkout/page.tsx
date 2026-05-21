'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, Input, Separator } from '@digitalger/shared/ui';
import { formatPrice } from '@digitalger/shared';
import { CheckCircle2, Gift, Loader2, ShoppingCart, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { couponsApi, ordersApi, paymentsApi } from '@/lib/api';
import { useCartStore } from '@/store/cart';
import { MAX_COUPONS_PER_PRODUCT } from '@/store/coupon';
import { SiteNavbar } from '@/components/layout/site-navbar';
import { AuthModal } from '@/components/auth/auth-modal';
import { QPayCheckout } from '@/components/payment/qpay-checkout';
import { ProductRowItem } from '@/components/ui/product-row-item';
import type { PaymentInitiateResult } from '@/types/api';

interface AppliedCoupon {
  code: string;
  type: string;
  value: number;
  discount: number;
}

export default function CheckoutPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const remove = useCartStore((s) => s.remove);
  const clear = useCartStore((s) => s.clear);

  const [paying, setPaying] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [qpayResult, setQpayResult] = useState<PaymentInitiateResult | null>(null);

  // Checkout-level coupons (addable on this page)
  const [checkoutCoupons, setCheckoutCoupons] = useState<AppliedCoupon[]>(() => {
    // Pre-fill from cart items' couponCodes
    const seen = new Set<string>();
    const initial: AppliedCoupon[] = [];
    // (cart coupons are shown via items, not duplicated here)
    return initial;
  });
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  // All unique coupon codes (from cart items + checkout-level)
  const cartCouponCodes = [...new Set(items.flatMap((i) => i.couponCodes ?? []))];
  const checkoutCouponCodes = checkoutCoupons.map((c) => c.code);
  const allCouponCodes = [...new Set([...cartCouponCodes, ...checkoutCouponCodes])];
  const totalCouponCount = allCouponCodes.length;
  const canAddMoreCoupons = totalCouponCount < MAX_COUPONS_PER_PRODUCT;

  // Base subtotal from item prices (already includes per-product discounts from cart)
  const cartSubtotal = items.reduce((sum, i) => sum + i.price, 0);

  // Additional discount from checkout-level coupons
  const checkoutDiscount = checkoutCoupons.reduce((sum, c) => sum + c.discount, 0);

  // Final total (min 0)
  const total = Math.max(0, cartSubtotal - checkoutDiscount);
  const isFree = total === 0;

  // Cart-level savings (compare vs original compareAtPrice)
  const originalSubtotal = items.reduce((sum, i) => {
    const cp = i.compareAtPrice;
    return sum + (cp && cp > i.price ? cp : i.price);
  }, 0);
  const cartSavings = originalSubtotal - cartSubtotal;

  async function handleAddCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (allCouponCodes.includes(code)) {
      setCouponError('Энэ купон аль хэдийн хэрэглэгдсэн байна');
      return;
    }
    if (!canAddMoreCoupons) {
      setCouponError(`Нэг бүтээгдэхүүнд хамгийн ихдээ ${MAX_COUPONS_PER_PRODUCT} купон хэрэглэж болно`);
      return;
    }
    setCouponLoading(true);
    setCouponError('');
    try {
      // Validate against the CURRENT total
      const res = await couponsApi.validate(code, cartSubtotal - checkoutDiscount);
      if (res.valid) {
        setCheckoutCoupons((prev) => [...prev, { code: res.code, type: res.type, value: res.value, discount: res.discount }]);
        setCouponInput('');
      } else {
        setCouponError(res.message || 'Купон буруу байна');
      }
    } catch {
      setCouponError('Алдаа гарлаа. Дахин оролдоно уу');
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon(code: string) {
    setCheckoutCoupons((prev) => prev.filter((c) => c.code !== code));
  }

  const handlePay = async () => {
    if (!session?.accessToken) {
      setAuthOpen(true);
      return;
    }
    if (!items.length) return;
    setPaying(true);
    try {
      const order = await ordersApi.create(
        session.accessToken,
        items.map((i) => i.productId),
        allCouponCodes,
      );

      // Free order or already PAID (backend auto-marks if total=0)
      if (isFree || order.status === 'PAID') {
        toast.success('Амжилттай худалдан авлаа!');
        clear();
        router.push('/orders');
        return;
      }

      if (order.devMode) {
        toast.success('Төлбөр амжилттай (dev)');
        clear();
        router.push('/orders');
        return;
      }

      const payment = await paymentsApi.initiateQPay(session.accessToken, order.id);

      if (payment.devMode) {
        toast.success('Төлбөр амжилттай (dev)');
        clear();
        router.push('/orders');
        return;
      }

      setQpayResult(payment);
    } catch {
      toast.error('Төлбөр эхлүүлж чадсангүй');
    } finally {
      setPaying(false);
    }
  };

  const handlePaymentSuccess = () => {
    clear();
    setQpayResult(null);
    router.push('/orders');
  };

  return (
    <>
      <SiteNavbar />
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3 mb-6">
          <ShoppingCart className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Захиалга баталгаажуулах</h1>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="Таны сагс хоосон байна"
            description="Бүтээгдэхүүн сонгоод сагсанд нэмснийхээ дараа энд харагдана"
            className="mt-8"
            action={
              <Button asChild>
                <Link href="/products">Бүтээгдэхүүн үзэх</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {/* Product list */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <p className="text-sm font-semibold">{items.length} бүтээгдэхүүн</p>
              </div>
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.productId} className="px-4 py-3">
                    <ProductRowItem
                      thumbnail={item.thumbnailUrl}
                      title={item.title}
                      titleHref={`/products/${item.slug}`}
                      price={item.price}
                      compareAtPrice={item.compareAtPrice}
                      actions={
                        <button
                          type="button"
                          onClick={() => remove(item.productId)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          aria-label="Хасах"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      }
                    />
                    {(item.couponCodes?.length ?? 0) > 0 && (
                      <div className="mt-1.5 ml-0 flex flex-wrap items-center gap-1.5">
                        {item.couponCodes!.map((code) => (
                          <span key={code} className="flex items-center gap-1 text-[10px] font-mono font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {code}
                          </span>
                        ))}
                        <span className="text-[10px] text-green-600 dark:text-green-500">купон хэрэглэгдсэн</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Summary + Coupon */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              {/* Savings row */}
              {cartSavings > 0 && (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Нийт жагсаалтын үнэ ({items.length} бүтээгдэхүүн)</span>
                    <span className="line-through">{formatPrice(originalSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 dark:text-green-400">Таны хэмнэлт</span>
                    <span className="font-medium text-green-600 dark:text-green-400">-{formatPrice(cartSavings)}</span>
                  </div>
                </>
              )}

              {/* Subtotal (after per-product discounts) */}
              {cartSavings === 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Нийт ({items.length} бүтээгдэхүүн)</span>
                  <span>{formatPrice(cartSubtotal)}</span>
                </div>
              )}

              {/* Checkout-level coupon discounts */}
              {checkoutCoupons.map((c) => (
                <div key={c.code} className="flex justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                    <span className="font-mono font-bold">{c.code}</span>
                    <span className="text-[10px]">
                      {c.type === 'PERCENT' ? `(${c.value}%)` : ''}
                    </span>
                  </span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    -{formatPrice(c.discount)}
                  </span>
                </div>
              ))}

              <Separator />

              {/* Total */}
              <div className="flex justify-between text-lg font-bold">
                <span>Нийт төлөх дүн</span>
                <span className={isFree ? 'text-green-600 dark:text-green-400' : 'text-foreground'}>
                  {isFree ? 'Үнэгүй' : formatPrice(total)}
                </span>
              </div>

              {/* Coupon input section */}
              <div className="pt-1 border-t border-border space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-semibold">Купон код байна уу?</span>
                  </div>
                  {totalCouponCount > 0 && (
                    <span className="text-xs text-muted-foreground">{totalCouponCount}/{MAX_COUPONS_PER_PRODUCT}</span>
                  )}
                </div>

                {/* Already applied checkout coupons */}
                {checkoutCoupons.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {checkoutCoupons.map((c) => (
                      <span
                        key={c.code}
                        className="flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-1 text-xs"
                      >
                        <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                        <span className="font-mono font-bold text-green-700 dark:text-green-400 tracking-wider">{c.code}</span>
                        <span className="text-green-600 dark:text-green-500">
                          {c.type === 'PERCENT' ? `(-${c.value}%)` : ''} -{formatPrice(c.discount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCoupon(c.code)}
                          className="text-green-600 dark:text-green-400 hover:text-destructive ml-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Coupon input — hidden when max reached */}
                {canAddMoreCoupons && (
                  <div className="flex gap-2">
                    <Input
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                      placeholder="Купон кодоо оруулна уу"
                      className="h-9 text-sm font-mono uppercase tracking-wider flex-1"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCoupon(); }}
                      disabled={couponLoading}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-4 shrink-0"
                      onClick={handleAddCoupon}
                      disabled={couponLoading || !couponInput.trim()}
                    >
                      {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Хэрэглэх'}
                    </Button>
                  </div>
                )}
                {couponError && <p className="text-xs text-destructive">{couponError}</p>}
              </div>

              {!session && (
                <p className="text-xs text-muted-foreground text-center">
                  Захиалга баталгаажуулахын тулд нэвтрэх шаардлагатай
                </p>
              )}

              <Button
                className="w-full font-bold"
                size="lg"
                disabled={paying}
                onClick={handlePay}
              >
                {paying ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Боловсруулж байна...</>
                ) : !session ? (
                  'Нэвтэрч, Захиалгаа баталгаажуулах'
                ) : isFree ? (
                  <><CheckCircle2 className="mr-2 h-4 w-4" />Үнэгүй авах</>
                ) : (
                  'QPay-ээр төлөх'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultTab="login"
        callbackUrl="/checkout"
      />

      {qpayResult && session?.accessToken && (
        <QPayCheckout
          payment={qpayResult}
          token={session.accessToken}
          onSuccess={handlePaymentSuccess}
          onClose={() => setQpayResult(null)}
        />
      )}
    </>
  );
}
