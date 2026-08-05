'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, Crown, Loader2, Sparkles, Tag, Wallet } from 'lucide-react';
import { formatPrice, cn } from '@besttv/shared';
import { ErrorState } from '@besttv/shared/ui';
import { usePlans, useValidateCoupon } from '@/lib/queries';
import { useAuth } from '@/lib/auth-store';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { QPayCheckout, type QPayInvoice } from '@/components/payment/qpay-checkout';
import {
  consumeAuthIntent,
  consumePostPurchaseReturn,
  loginUrlWithIntent,
} from '@/lib/auth-intent';

type PayMethod = 'wallet' | 'qpay';

export default function PricingPage() {
  const { data: plans, isLoading, isError, refetch } = usePlans();
  const { user, refreshMe } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const [payment, setPayment] = useState<QPayInvoice | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountType: 'PERCENT' | 'FIXED';
    amount: number;
  } | null>(null);
  const validateCoupon = useValidateCoupon();

  /** Хэрэглэгч тухайн багцтай аль хэдийн байгаа эсэх */
  const ownedPlanIds = new Set((user?.subscriptions ?? []).map((s) => s.planId));
  /**
   * Идэвхтэй багц бүрийн дуусах огноо — "Сунгах" товчны тайлбарт.
   * ⚠️ Идэвхтэй багцыг ДАХИН авбал хугацаа нь ДЭЭР НЬ ЗАЛГАГДАНА
   * (backend `grant` нь ижил багцын үлдэгдэл дээр нэмдэг).
   */
  const expiryByPlan = new Map(
    (user?.subscriptions ?? []).map((s) => [s.planId, new Date(s.expiresAt)]),
  );
  /**
   * ⚠️ VIP нь БҮХ контентыг нээдэг тул VIP идэвхтэй үед бусад жанрын багц
   * илүүдэл болно — картад "VIP-д багтсан" гэж тэмдэглэж, авах товчийг
   * идэвхгүй болгоно. (VIP дуусмагц дахин авах боломжтой.)
   */
  const hasVip = (user?.subscriptions ?? []).some((s) => s.isVip);

  const priceAfterCoupon = (price: number) => {
    if (!appliedCoupon) return price;
    const discount =
      appliedCoupon.discountType === 'PERCENT'
        ? Math.round((price * appliedCoupon.amount) / 100)
        : Math.min(appliedCoupon.amount, price);
    return Math.max(0, price - discount);
  };

  const applyCoupon = async () => {
    if (!couponInput.trim() || !plans?.length) return;
    const maxPrice = Math.max(...plans.map((p) => p.price));
    try {
      const res = await validateCoupon.mutateAsync({ code: couponInput, price: maxPrice });
      setAppliedCoupon({
        code: couponInput.toUpperCase().trim(),
        discountType: res.discountType,
        amount: res.amount,
      });
      toast.success('Купон амжилттай хэрэглэгдлээ');
    } catch (e) {
      setAppliedCoupon(null);
      toast.error(e instanceof Error ? e.message : 'Хүчингүй купон код');
    }
  };

  /**
   * ⚠️ Нэвтэрсний дараа "юу хийж байсныг" үргэлжлүүлнэ.
   *
   * Жишээ: зочин байхдаа "QPay-ээр шууд төлөх" дарж → нэвтрэх хуудас → амжилттай
   * нэвтрэх → энэ хуудас руу буцаж ирээд QPay модал АВТОМАТ нээгдэнэ.
   * Эс бөгөөс хэрэглэгч дахин эхнээс нь хайж дарах шаардлагатай болно.
   */
  const intentRan = useRef(false);
  useEffect(() => {
    if (!user || intentRan.current || !plans?.length) return;
    const intent = consumeAuthIntent();
    if (!intent || intent.type !== 'buy-plan') return;
    const plan = plans.find((p) => p.id === intent.planId);
    if (!plan) return;

    intentRan.current = true;
    if (intent.couponCode && !appliedCoupon) {
      setCouponInput(intent.couponCode);
    }
    // Хэрэглэгчид юу болж байгааг мэдэгдэнэ
    toast.info(`${plan.name} — үргэлжлүүлж байна…`);
    if (intent.method === 'qpay') void buyWithQpay(plan.id);
    else void buyWithWallet(plan.id, priceAfterCoupon(plan.price));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, plans]);

  const refreshAll = async () => {
    await Promise.all([
      refreshMe(),
      qc.invalidateQueries({ queryKey: ['wallet'] }),
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] }),
      qc.invalidateQueries({ queryKey: ['my-payments'] }),
    ]);
  };

  /** Хэтэвчээр төлөх — QPay дамжихгүй, шууд */
  const buyWithWallet = async (planId: string, finalPrice: number) => {
    // ⚠️ Нэвтрээгүй бол ЮУ хийх гэж байсныг хадгална — нэвтэрсний дараа
    // энэ хуудсанд буцаж ирээд АВТОМАТ үргэлжилнэ
    if (!user) {
      return router.push(
        loginUrlWithIntent({
          type: 'buy-plan',
          planId,
          method: 'wallet',
          couponCode: appliedCoupon?.code,
        }),
      );
    }
    if (user.walletBalance < finalPrice) {
      /**
       * ⚠️ ХЭТЭВЧ ТАБ руу шууд (?tab=wallet). Өмнө нь `/profile` руу
       * явуулдаг тул Профайл табан дээр буугаад хэрэглэгч хаанаас
       * цэнэглэхээ олдоггүй байв. Дутуу дүнг ч хэлнэ.
       */
      const short = finalPrice - user.walletBalance;
      toast.error(
        `Үлдэгдэл ${formatPrice(short)} дутуу байна — цэнэглэх хуудас руу шилжүүлж байна`,
      );
      router.push('/profile?tab=wallet');
      return;
    }
    setLoadingPlan(planId);
    try {
      await api('/payments/wallet/purchase', {
        method: 'POST',
        body: JSON.stringify({ planId, couponCode: appliedCoupon?.code }),
      });
      await refreshAll();

      /**
       * ⚠️ Хэрэглэгч КИНО үзэх гэж багц авсан бол ТЭР КИНО руугаа буцна.
       * Өмнө нь зүгээр toast гарч, хэрэглэгч /pricing дээр үлдэж, өөрөө
       * буцаж хайх шаардлагатай байв.
       */
      const back = consumePostPurchaseReturn();
      if (back) {
        toast.success('Эрх нээгдлээ 🎉 — үргэлжлүүлж байна');
        router.push(back);
      } else {
        toast.success('Эрх амжилттай нээгдлээ 🎉');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setLoadingPlan(null);
    }
  };

  /** QPay-ээр шууд төлөх */
  const buyWithQpay = async (planId: string) => {
    if (!user) {
      return router.push(
        loginUrlWithIntent({
          type: 'buy-plan',
          planId,
          method: 'qpay',
          couponCode: appliedCoupon?.code,
        }),
      );
    }
    setLoadingPlan(planId);
    try {
      const res = await api<QPayInvoice & { devMode?: boolean }>('/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({ planId, couponCode: appliedCoupon?.code }),
      });
      if (res.devMode) {
        toast.success('Эрх нээгдлээ (dev mode)');
        await refreshAll();
        router.push('/');
        return;
      }
      // ⚠️ urls/qrText ЗААВАЛ дамжина — мобайл дээр банкны апп-ын deeplink
      // үүсгэхэд хэрэгтэй (QR ганцаараа утсан дээр ашиггүй)
      setPayment({
        paymentId: res.paymentId,
        qrImage: res.qrImage,
        qrText: res.qrText,
        urls: res.urls,
        amount: res.amount,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа, дахин оролдоно уу');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 pb-24 pt-28 md:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-premium/12 px-3 py-1 text-xs font-bold text-premium">
          <Sparkles size={12} /> BESTTV БАГЦУУД
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
          Хүссэн багцаа сонго
        </h1>
        <p className="mt-3 text-white/55 md:text-lg">
          Багц бүр өөрийн ангиллын контентыг нээнэ. VIP бол бүгдийг нэг дор.
        </p>
      </div>

      {/* Хэтэвчийн үлдэгдэл */}
      {user && (
        <div className="mx-auto mt-8 flex max-w-md items-center justify-between rounded-xl border border-white/10 bg-white/4 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-white/60">
            <Wallet size={16} className="text-primary" /> Хэтэвч:{' '}
            <strong className="text-white">{formatPrice(user.walletBalance)}</strong>
          </span>
          <button
            onClick={() => router.push('/profile')}
            className="rounded-lg bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/14"
          >
            Цэнэглэх
          </button>
        </div>
      )}

      {/* Купон */}
      <div className="mx-auto mt-4 flex max-w-md items-center gap-2">
        <div className="relative flex-1">
          <Tag size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
          <input
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            placeholder="Купон код байвал энд оруулна уу"
            aria-label="Купон код"
            disabled={!!appliedCoupon}
            className="w-full rounded-lg border border-white/12 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-primary disabled:opacity-60"
          />
        </div>
        {appliedCoupon ? (
          <button
            onClick={() => { setAppliedCoupon(null); setCouponInput(''); }}
            className="shrink-0 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/16"
          >
            Цуцлах
          </button>
        ) : (
          <button
            onClick={applyCoupon}
            disabled={validateCoupon.isPending || !couponInput.trim()}
            className="shrink-0 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/16 disabled:opacity-50"
          >
            {validateCoupon.isPending ? <Loader2 size={15} className="animate-spin" /> : 'Хэрэглэх'}
          </button>
        )}
      </div>

      {/* ⚠️ Алдааг ЗААВАЛ харуулна — өмнө нь хоосон хуудас гарч,
          хэрэглэгч төлбөр хийх гэж ирээд юу ч харахгүй байсан */}
      {isError && (
        <div className="mx-auto mt-10 max-w-md">
          <ErrorState
            title="Багц ачаалж чадсангүй"
            message="Сүлжээний алдаа гарлаа. Дахин оролдоно уу."
            onRetry={() => refetch()}
          />
        </div>
      )}

      {/* ⚠️ Мобайл дээр ч 2 БАГАНА — доош сунаж уншигдахгүй болохоос сэргийлнэ */}
      <div className="mx-auto mt-8 grid max-w-6xl grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-80 rounded-2xl" />
          ))}

        {plans?.map((plan, i) => {
          const finalPrice = priceAfterCoupon(plan.price);
          const owned = ownedPlanIds.has(plan.id);
          // VIP идэвхтэй үед энгийн багц илүүдэл (VIP өөрөө биш)
          const supersededByVip = hasVip && !plan.isVip;
          // ⚠️ Мобайлд сондгой тоотой бол СҮҮЛИЙН карт 2 баганыг эзэлнэ —
          // хажуудаа хоосон нүх үлдээхгүй
          const lastOdd = plans.length % 2 === 1 && i === plans.length - 1;
          const canPayWithWallet = !!user && user.walletBalance >= finalPrice;

          return (
            <div
              key={plan.id}
              className={cn(
                // ⚠️ `h-full` — доторх `mt-auto` (товчны блок) ажиллахад ЗААВАЛ
                'relative flex h-full flex-col rounded-2xl border p-4 transition-transform sm:p-6',
                lastOdd && 'col-span-2 lg:col-span-1',
                !supersededByVip && 'hover:-translate-y-1',
                supersededByVip && 'opacity-55',
                plan.isVip
                  ? 'border-premium/60 bg-linear-to-b from-premium/10 to-transparent shadow-xl shadow-premium/10'
                  : 'border-white/10 bg-white/3 hover:border-white/20',
              )}
            >
              {plan.isVip && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-premium px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-premium-foreground shadow-lg">
                  Хамгийн ашигтай
                </span>
              )}
              {owned ? (
                <span
                  title={
                    expiryByPlan.get(plan.id)
                      ? `${expiryByPlan.get(plan.id)!.toLocaleDateString('mn-MN')} хүртэл`
                      : undefined
                  }
                  className="absolute right-3 top-3 rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold text-success sm:right-4 sm:top-4 sm:text-[11px]"
                >
                  Идэвхтэй
                </span>
              ) : supersededByVip ? (
                <span className="absolute right-3 top-3 rounded-full bg-premium/20 px-2 py-0.5 text-[10px] font-bold text-premium sm:right-4 sm:top-4 sm:text-[11px]">
                  VIP-д багтсан
                </span>
              ) : null}

              <h3 className="flex items-center gap-1.5 text-base font-bold text-white sm:text-lg">
                {plan.isVip && <Crown size={16} className="text-premium" />}
                {plan.name}
              </h3>

              <div className="mt-3 flex items-baseline gap-2">
                {appliedCoupon ? (
                  <>
                    <p className="text-2xl font-black text-white sm:text-3xl">{formatPrice(finalPrice)}</p>
                    <p className="text-sm text-white/35 line-through">{formatPrice(plan.price)}</p>
                  </>
                ) : (
                  <p className="text-2xl font-black text-white sm:text-3xl">{formatPrice(plan.price)}</p>
                )}
              </div>
              <p className="mt-1 text-xs text-white/40">
                {plan.durationDays} хоног
                {plan.durationDays >= 30 && ` · ≈ ${formatPrice(Math.round(finalPrice / plan.durationDays))} / өдөр`}
              </p>

              {/* Нээгдэх контент */}
              <div className="mt-4 rounded-lg bg-black/20 p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                  Нээгдэх контент
                </p>
                {plan.isVip ? (
                  <p className="mt-1 text-sm font-medium text-premium">Бүх ангилал (18+ хамт)</p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {plan.genres.map((g) => (
                      <span
                        key={g.id}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[11px]',
                          g.isAdult ? 'bg-destructive/20 text-destructive' : 'bg-white/8 text-white/65',
                        )}
                      >
                        {g.isAdult && '🔞 '}
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                    <Check size={15} className="mt-0.5 shrink-0 text-success" /> {f}
                  </li>
                ))}
              </ul>

              {/*
                ⚠️ `mt-auto` — товчны блокыг картын ЁРООЛД бэхлэнэ.
                Багцуудын гарчиг/боломжийн жагсаалт өөр өөр урттай тул
                mobile-д (grid-cols-2) товчнууд ӨӨР ӨНДӨРТ таарч,
                зэрэгцээ нь замбараагүй харагддаг байв.
              */}
              <div className="mt-auto space-y-2 pt-5">
                {supersededByVip && (
                  <p className="rounded-lg bg-premium/10 px-3 py-2 text-center text-[11px] leading-relaxed text-premium">
                    VIP багц энэ бүх контентыг аль хэдийн нээсэн байна
                  </p>
                )}
                <button
                  onClick={() => buyWithWallet(plan.id, finalPrice)}
                  // ⚠️ !!loadingPlan — өөр багц ачаалж байхад ч дарж болохгүй
                  // (хоёр гүйлгээ зэрэг эхлэхээс сэргийлнэ)
                  disabled={!!loadingPlan}
                  className={cn(
                    // ⚠️ `whitespace-nowrap` — mobile-д текст мөр таслахгүй
                    'flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg py-2.5 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50',
                    canPayWithWallet
                      ? plan.isVip
                        ? 'bg-premium text-premium-foreground hover:brightness-105'
                        : 'bg-primary text-white hover:brightness-110'
                      : 'bg-white/8 text-white/50',
                  )}
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Wallet size={15} />
                  )}
                  {owned ? 'Хэтэвчээр сунгах' : 'Хэтэвчээр авах'}
                </button>

                <button
                  onClick={() => buyWithQpay(plan.id)}
                  disabled={!!loadingPlan}
                  /* ⚠️ `whitespace-nowrap` — mobile-д текст 2 мөр болж
                     товчны өндөр зөрөхөөс сэргийлнэ (зэрэгцээ жигд) */
                  className="flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-white/8 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/14 hover:text-white disabled:opacity-50"
                >
                  {loadingPlan === plan.id && <Loader2 size={12} className="animate-spin" />}
                  {/*
                    ⚠️ Текстийг БОГИНО, ЖИГД байлгана. Өмнө нь "QPay-ээр
                    шууд төлөх" гэсэн урт бичиг байсан тул mobile-д мөр
                    таарахгүй, багц бүрийн товч өөр өндөртэй болж
                    зэрэгцээ нь замбараагүй харагддаг байв.
                  */}
                  {owned ? 'QPay-ээр сунгах' : 'QPay-ээр төлөх'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mx-auto mt-10 max-w-md text-center text-xs text-white/35">
        Олон багц зэрэг авч болно. Идэвхтэй багцаа дахин авбал хугацаа нь ДЭЭР НЬ нэмэгдэнэ. Автомат сунгалт байхгүй.
      </p>

      {/* QPay төлбөр — QR + мобайл дээр банкны аппын deeplink товчнууд */}
      {payment && (
        <QPayCheckout
          invoice={payment}
          subtitle="Багц худалдан авалт"
          successText="Эрх идэвхжиж байна…"
          onPaid={async () => {
            await refreshAll();
            // ⚠️ Кино үзэх гэж багц авсан бол ТЭР КИНО руугаа буцна
            // (өмнө нь болзолгүй нүүр хуудас руу шиддэг байсан)
            const back = consumePostPurchaseReturn();
            setTimeout(() => {
              setPayment(null);
              router.push(back ?? '/');
            }, 1600);
          }}
          onClose={() => setPayment(null)}
        />
      )}

    </main>
  );
}
