'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, EmptyState, Input, Separator } from '@digitalger/shared/ui';
import { formatPrice } from '@digitalger/shared';
import { Building2, CheckCircle2, Gift, Loader2, ShoppingCart, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { couponsApi, downloadsApi, ordersApi, paymentsApi, productsApi, siteSettingsApi } from '@/lib/api';
import { trackPurchase } from '@/lib/analytics';
import { useCartStore } from '@/store/cart';
import { MAX_COUPONS_PER_PRODUCT } from '@/store/coupon';
import { SiteNavbar } from '@/components/layout/site-navbar';
import { AuthModal } from '@/components/auth/auth-modal';
import { QPayCheckout } from '@/components/payment/qpay-checkout';
import { BankTransferModal } from '@/components/payment/bank-transfer-modal';
import {
  PaymentMethodSheet,
  useCardPaymentEnabled,
  type PayMethod,
} from '@/components/payment/payment-method-sheet';
import { ProductRowItem } from '@/components/ui/product-row-item';
import { TrustBadges } from '@/components/products/trust-badges';
import type { PaymentInitiateResult } from '@/types/api';

interface AppliedCoupon {
  code: string;
  type: string;
  value: number;
  discount: number;
}

function CheckoutContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const items = useCartStore((s) => s.items ?? []);
  const remove = useCartStore((s) => s.remove);
  const clear = useCartStore((s) => s.clear);
  const updateThumbnail = useCartStore((s) => s.updateThumbnail);

  const [paying, setPaying] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [qpayResult, setQpayResult] = useState<PaymentInitiateResult | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Bonum-аас буцаж ирэхэд төлбөр шалгах хөнгөн баннер (гол товч гацаадаггүй)
  const [bonumChecking, setBonumChecking] = useState(false);
  const autoPayTriggered = useRef(false);

  // Карт/WeChat/Apple/Google (Bonum) боломжтой эсэх — checkout sheet-д мөр харуулна
  const cardEnabled = useCardPaymentEnabled();

  // Дансаар шилжүүлэх тохиргоо (public settings) — checkout-д "Дансаар төлөх"
  // товч харуулах эсэх + popup-д харагдах данс мэдээллийг динамикаар татна.
  const { data: siteSettings } = useQuery({
    queryKey: ['site-settings', 'public'],
    queryFn: () => siteSettingsApi.getPublic(),
    staleTime: 5 * 60_000,
  });
  const bankEnabled = !!siteSettings?.bankTransferEnabled;

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

  // ── Хэрэглэгчийн ЭЗЭМШСЭН (идэвхтэй) бүтээгдэхүүн — нэвтэрсэн үед ──
  // Сагсанд өмнө худалдаж авсан бүтээгдэхүүн байвал: total-аас хасна (зөвхөн
  // ШИНЭ бүтээгдэхүүнээр QPay үүснэ), UI-д "Аль хэдийн авсан" гэж тэмдэглэнэ.
  // Backend createPending мөн ижил логиктой (давхар хамгаалалт).
  const { data: ownedLibrary = [] } = useQuery({
    queryKey: ['downloads', 'history'],
    queryFn: () => downloadsApi.history(session!.accessToken!),
    enabled: !!session?.accessToken,
    staleTime: 30_000,
  });
  const ownedIds = useMemo(
    () => new Set(ownedLibrary.filter((p) => p.isExpired !== true).map((p) => p.product.id)),
    [ownedLibrary],
  );
  // Сагсыг 2 хуваана: payable (шинэ, төлөх) + alreadyOwned (өмнө авсан, хасагдана)
  const payableItems = items.filter((i) => !ownedIds.has(i.productId));
  const ownedItems = items.filter((i) => ownedIds.has(i.productId));

  // All unique coupon codes (from cart items + checkout-level)
  const cartCouponCodes = [...new Set(items.flatMap((i) => i.couponCodes ?? []))];
  const checkoutCouponCodes = checkoutCoupons.map((c) => c.code);
  const allCouponCodes = [...new Set([...cartCouponCodes, ...checkoutCouponCodes])];
  const totalCouponCount = allCouponCodes.length;
  const canAddMoreCoupons = totalCouponCount < MAX_COUPONS_PER_PRODUCT;

  // Base subtotal — ЗӨВХӨН payable (өмнө авсныг хасна, QPay-тэй ижил total)
  const cartSubtotal = payableItems.reduce((sum, i) => sum + i.price, 0);

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

  // thumbnailUrl null байгаа cart item-г API-аас шинэчлэх
  useEffect(() => {
    const missingThumbs = items.filter((i) => !i.thumbnailUrl);
    if (!missingThumbs.length) return;
    missingThumbs.forEach(async (item) => {
      try {
        const product = await productsApi.bySlug(item.slug);
        if (product.thumbnailUrl) updateThumbnail(item.productId, product.thumbnailUrl);
      } catch {
        // ignore
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FB/IG-аас шилжиж ирсэн intent: ?showAuth=1 байвал нэвтрээгүй үед login modal-ийг
  // АВТОМАТ нээнэ (checkout-ийн өөрийн AuthModal — callbackUrl="/checkout?autopay=1"
  // тул нэвтэрсний дараа autopay үргэлжилнэ). navbar showAuth-г checkout дээр
  // алгасдаг тул энд checkout өөрөө зохицуулна.
  const showAuthHandled = useRef(false);
  useEffect(() => {
    if (showAuthHandled.current) return;
    if (searchParams.get('showAuth') === '1') {
      showAuthHandled.current = true;
      if (!session?.accessToken) setAuthOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, session?.accessToken]);

  // ?bonum=return — Bonum hosted checkout-аас буцаж ирлээ. Эрх нь webhook-оор
  // нээгддэг тул төлбөр баталгаажсан эсэхийг ХӨНГӨН шалгана.
  // ⚠️ setPaying(true) ХИЙХГҮЙ — тусдаа bonumChecking баннер (гол товч гацахгүй).
  // Хэрэглэгч ТӨЛӨЛГҮЙ буцсан бол эхний шалгалт paid=false → шууд зогсоно.
  const bonumReturnHandled = useRef(false);
  useEffect(() => {
    if (bonumReturnHandled.current) return;
    if (searchParams.get('bonum') !== 'return') return;
    if (!session?.accessToken) return;
    // Redirect-ийн дараа pendingOrderId алдагдсан тул sessionStorage-аас сэргээнэ.
    let orderId = pendingOrderId;
    if (!orderId) {
      try {
        orderId = sessionStorage.getItem('dg_bonum_order');
      } catch {
        orderId = null;
      }
    }
    bonumReturnHandled.current = true;
    // ⚠️ URL-аас ?bonum=return-ыг ШУУД арилгана — refresh/back хийхэд дахин
    // polling эхлэхгүй (spinner-д гацахгүй).
    router.replace('/checkout');

    if (!orderId) return;
    try {
      sessionStorage.removeItem('dg_bonum_order');
    } catch {
      /* үл хэрэгс */
    }

    const token = session.accessToken;
    let tries = 0;
    let cancelled = false;
    setBonumChecking(true);
    const poll = async () => {
      if (cancelled) return;
      tries++;
      try {
        const res = await paymentsApi.checkBonum(token, orderId);
        if (res.paid) {
          items.forEach((i) => trackPurchase(i.productId, i.slug, i.price));
          clear();
          setPendingOrderId(null);
          setBonumChecking(false);
          queryClient.invalidateQueries({ queryKey: ['library'] });
          toast.success('Төлбөр амжилттай!');
          router.push('/library');
          return;
        }
      } catch {
        // үргэлжлүүлэн оролдоно
      }
      // ⚠️ Хэрэглэгч ТӨЛӨЛГҮЙ буцсан бол эрт зогсоно (5 удаа ≈ 12с).
      // Webhook саатсан бодит төлбөрийг reconcile cron (5 мин) барина.
      if (tries >= 5) {
        setBonumChecking(false);
        return;
      }
      setTimeout(poll, 2500);
    };
    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, session?.accessToken, pendingOrderId]);

  // ?autopay=1 param байвал нэвтэрсний дараа шууд QPay эхлүүлнэ
  useEffect(() => {
    if (
      searchParams.get('autopay') === '1' &&
      session?.accessToken &&
      !autoPayTriggered.current &&
      !paying &&
      !qpayResult &&
      items.length > 0
    ) {
      autoPayTriggered.current = true;
      router.replace('/checkout');
      handlePay();
    }
    // items.length dep-д ОРСОН — browser-switch restore нь cart-ийг async
    // сэргээдэг тул эхэнд items хоосон байж болзошгүй. items дүүрэхэд autopay
    // ажиллахын тулд dep-д заавал байх ёстой (эс бол intent тасарна).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, searchParams, items.length]);

  const handlePay = async (method: PayMethod = 'qpay') => {
    // FB/IG доторх браузарт ч QPay ШУУД эхэлнэ — QR (base64 зураг) харагдана,
    // банкны deeplink (khanbank:// г.м.) банкны апп руу үсэрнэ. Тиймээс системийн
    // браузар руу шилжүүлэх шаардлагагүй (conversion алдахгүй).
    if (!session?.accessToken) {
      setAuthOpen(true);
      return;
    }
    if (!items.length) return;
    // ⚠️ Сагсны БҮХ бүтээгдэхүүн аль хэдийн эзэмшсэн бол QPay үүсгэхгүй — шууд
    // Миний сан руу (өмнө авсан нь тэнд бий). Холимог бол ШИНЭ-ээр л үргэлжилнэ.
    if (payableItems.length === 0) {
      toast.success('Та эдгээр бүтээгдэхүүнийг аль хэдийн авсан байна. Миний сан руу шилжиж байна...');
      clear();
      setPendingOrderId(null);
      router.push('/library');
      return;
    }
    setPaying(true);
    try {
      let orderId = pendingOrderId;

      if (!orderId) {
        // ⚠️ Зөвхөн payable (өмнө аваагүй) productId-г backend-д явуулна.
        const order = await ordersApi.create(
          session.accessToken,
          payableItems.map((i) => i.productId),
          allCouponCodes,
        );

        // ⚠️ Бүх бүтээгдэхүүн аль хэдийн эзэмшсэн (алдаа БИШ) → "Миний сан" руу.
        if ((order as { alreadyOwned?: boolean }).alreadyOwned) {
          toast.success('Та эдгээр бүтээгдэхүүнийг аль хэдийн авсан байна. Миний сан руу шилжиж байна...');
          clear();
          setPendingOrderId(null);
          router.push('/library');
          return;
        }

        // Free order or already PAID (backend auto-marks if total=0)
        if (isFree || order.status === 'PAID') {
          items.forEach((i) => trackPurchase(i.productId, i.slug, i.price));
          toast.success('Амжилттай худалдан авлаа!');
          clear();
          router.push('/library');
          return;
        }

        if (order.devMode) {
          items.forEach((i) => trackPurchase(i.productId, i.slug, i.price));
          toast.success('Төлбөр амжилттай (dev)');
          clear();
          router.push('/library');
          return;
        }

        orderId = order.id;
        setPendingOrderId(order.id);
      }

      // ── Дансаар шилжүүлэх — data modal (order PENDING үлдэнэ, админ гараар нээнэ) ──
      if (method === 'bank') {
        setSheetOpen(false);
        setBankModalOpen(true);
        return;
      }

      // ── Карт/Apple/Google/WeChat (Bonum) — hosted checkout руу redirect ──
      if (method === 'card' || method === 'applepay' || method === 'googlepay' || method === 'wechat') {
        const res = await paymentsApi.initiateBonum(session.accessToken, orderId, method);
        if (res.devMode) {
          items.forEach((i) => trackPurchase(i.productId, i.slug, i.price));
          toast.success('Төлбөр амжилттай (dev)');
          clear();
          router.push('/library');
          return;
        }
        // ⚠️ Bonum hosted checkout — эмбед боломжгүй тул тухайн хуудас руу шилжинэ.
        // Эрх нь webhook-оор нээгдэнэ; буцаж ирэхэд ?bonum=return-оор polling.
        // ⚠️ Redirect-ийн дараа React state цэвэрлэгдэнэ тул orderId-ыг хадгална
        // (буцаж ирэхэд сэргээж polling хийнэ).
        try {
          sessionStorage.setItem('dg_bonum_order', orderId);
        } catch {
          /* sessionStorage боломжгүй — reconcile cron баталгаа болно */
        }
        window.location.href = res.redirectUrl;
        return;
      }

      // ── QPay (default) — одоогийн QR modal урсгал (хэвээр) ──
      const payment = await paymentsApi.initiateQPay(session.accessToken, orderId);

      if (payment.devMode) {
        toast.success('Төлбөр амжилттай (dev)');
        clear();
        router.push('/library');
        return;
      }

      setSheetOpen(false);
      setQpayResult(payment);
    } catch (err: any) {
      const msg = err?.message || '';
      // ⚠️ Бүх бүтээгдэхүүн аль хэдийн эзэмшсэн — АЛДАА БИШ. Сагсыг цэвэрлэж
      // "Миний сан" руу эелдэг шилжүүлнэ (улаан алдаа гаргахгүй).
      if (msg.includes('ALREADY_OWNED')) {
        toast.success('Та эдгээр бүтээгдэхүүнийг аль хэдийн авсан байна. Миний сан руу шилжиж байна...');
        clear();
        setPendingOrderId(null);
        router.push('/library');
        return;
      }
      if (msg.includes('unavailable')) {
        toast.error('Нэг буюу хэд хэдэн бүтээгдэхүүн боломжгүй байна');
      } else if (msg.includes('QPay') || msg.includes('invoice')) {
        toast.error('QPay холболтод алдаа гарлаа. Дахин оролдоно уу');
      } else {
        toast.error('Төлбөр эхлүүлж чадсангүй. Дахин оролдоно уу');
      }
    } finally {
      setPaying(false);
    }
  };

  const handlePaymentSuccess = () => {
    items.forEach((i) => trackPurchase(i.productId, i.slug, i.price));
    clear();
    setQpayResult(null);
    setPendingOrderId(null);
    // "Миний сан"-ийг cache-аас цэвэрлэнэ — ингэснээр /library руу шилжихэд
    // шинээр төлсөн бүтээгдэхүүн REALTIME-аар шууд харагдана (хуучин cache
    // ашиглаж "бүтээгдэхүүн алга" гэж хэрэглэгчийг тэрүүлэхгүй).
    queryClient.invalidateQueries({ queryKey: ['library'] });
    router.push('/library');
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
                <Link href="/products">Бүтээгдэхүүн</Link>
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
                {items.map((item) => {
                  const owned = ownedIds.has(item.productId);
                  return (
                  <li key={item.productId} className={`px-4 py-3 ${owned ? 'opacity-60' : ''}`}>
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
                          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-red-50 dark:bg-red-950/40 hover:text-destructive transition-colors"
                          aria-label="Хасах"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      }
                    />
                    {/* Өмнө худалдаж авсан → "Аль хэдийн авсан" (төлбөрт орохгүй) */}
                    {owned && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Аль хэдийн авсан
                        </span>
                        <span className="text-[10px] text-muted-foreground">төлбөрт орохгүй · Миний санд байгаа</span>
                      </div>
                    )}
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
                  );
                })}
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
              <div
                className="rounded-xl border border-primary/20 p-3 space-y-2.5 bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary/70 shrink-0" />
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
                      className="h-9 text-sm font-mono uppercase tracking-wider flex-1 bg-background/80"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCoupon(); }}
                      disabled={couponLoading}
                      aria-label="Купон код"
                      aria-describedby={couponError ? 'coupon-error' : undefined}
                      aria-invalid={!!couponError}
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
                {couponError && (
                  <p id="coupon-error" role="alert" className="text-xs text-destructive">
                    {couponError}
                  </p>
                )}
              </div>

              {!session && (
                <p className="text-xs text-muted-foreground text-center">
                  Захиалга баталгаажуулахын тулд нэвтрэх шаардлагатай
                </p>
              )}

              {/* Bonum-аас буцаж ирэхэд төлбөр шалгах хөнгөн баннер (товч гацаадаггүй) */}
              {bonumChecking && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  <span className="text-muted-foreground">
                    Төлбөрийг шалгаж байна... Төлсөн бол автоматаар "Миний сан" руу шилжинэ.
                  </span>
                </div>
              )}

              {/* НЭГ «Худалдан авах» товч → төлбөрийн аргын цонх (QPay/Карт/
                  Apple/Google/WeChat/Данс). Нэвтрээгүй эсвэл үнэгүй бол шууд
                  үргэлжилнэ (цонх хэрэггүй). */}
              <Button
                className="w-full font-bold"
                size="lg"
                disabled={paying}
                onClick={() => {
                  if (!session) {
                    handlePay();
                    return;
                  }
                  if (isFree) {
                    handlePay();
                    return;
                  }
                  setSheetOpen(true);
                }}
              >
                {paying ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Боловсруулж байна...</>
                ) : !session ? (
                  'Нэвтэрч, Захиалгаа баталгаажуулах'
                ) : isFree ? (
                  <><CheckCircle2 className="mr-2 h-4 w-4" />Үнэгүй авах</>
                ) : (
                  'Худалдан авах'
                )}
              </Button>

              {/* Trust badges — итгэлийн тэмдгүүд (eco/teal зөөлөн background). */}
              <div className="mt-1 rounded-xl border border-teal-500/20 bg-teal-500/6 dark:bg-teal-400/6 p-3">
                <TrustBadges />
              </div>
            </div>
          </div>
        )}
      </div>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultTab="login"
        callbackUrl="/checkout?autopay=1"
      />

      {qpayResult && session?.accessToken && (
        <QPayCheckout
          payment={qpayResult}
          token={session.accessToken}
          onSuccess={handlePaymentSuccess}
          onClose={() => { setQpayResult(null); setPendingOrderId(null); }}
        />
      )}

      {bankModalOpen && siteSettings && (
        <BankTransferModal
          settings={siteSettings}
          total={total}
          onClose={() => setBankModalOpen(false)}
        />
      )}

      {/* Төлбөрийн аргын цонх — QPay/Карт/Apple/Google/WeChat/Данс */}
      <PaymentMethodSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        amount={total}
        subtitle={`${payableItems.length} бүтээгдэхүүн`}
        bankEnabled={bankEnabled}
        cardEnabled={cardEnabled}
        busy={paying}
        onSelect={(method) => handlePay(method)}
      />
    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutContent />
    </Suspense>
  );
}
