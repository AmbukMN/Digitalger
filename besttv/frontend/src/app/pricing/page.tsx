'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Building2,
  Gift, Check, Crown, Loader2, Sparkles, Tag, Wallet } from 'lucide-react';
import { formatPrice, cn } from '@besttv/shared';
import { ErrorState } from '@besttv/shared/ui';
import { usePlans, useValidateCoupon } from '@/lib/queries';
import { usePlanPromotions, useBankAccounts, type AppliedPromotion } from '@/lib/queries';
import { BankTransferModal } from '@/components/payment/bank-transfer-modal';
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
  /* ⚠️ Урамшуулал — planId → тохирсон урамшуулал. Backend нь ХАМГИЙН
     АШИГТАЙГ сонгож өгнө, frontend дахин боддоггүй (зөрөхөөс сэргийлнэ). */
  const { data: promos } = usePlanPromotions();
  const { data: bank } = useBankAccounts();
  /* Дансаар төлөх модал — аль багцад нээснийг санана */
  const [bankPlan, setBankPlan] = useState<{ id: string; name: string } | null>(null);
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
    /** ⚠️ Энэ дүнгээс доош багцад купон ХҮЧИНГҮЙ */
    minPrice: number;
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
        /**
         * ⚠️⚠️ PERCENT-ыг 100-аар ТАСЛАНА — backend-тэй ижил
         * (`coupons.module.ts`: `Math.min(100, ...)`). Хуучин буруу
         * купон (amount=500) DB-д үлдсэн байвал энд сөрөг үнэ гарна.
         */
        ? Math.round((price * Math.min(100, Math.max(0, appliedCoupon.amount))) / 100)
        : Math.min(appliedCoupon.amount, price);

    /**
     * ⚠️⚠️ `minPrice` ШАЛГАНА — купон нь тодорхой дүнгээс дээш
     * захиалгад л хүчинтэй. Өмнө нь энэ шалгалтгүй байсан тул
     * хямд багц дээр хямдарсан үнэ ХАРАГДААД, товч дарахад
     * backend татгалзаж хэрэглэгч эргэлздэг байв.
     */
    if (price < (appliedCoupon.minPrice ?? 0)) return price;
    return Math.max(0, price - discount);
  };

  const applyCoupon = async () => {
    if (!couponInput.trim() || !plans?.length) return;
    /**
     * ⚠️ ХАМГИЙН ҮНЭТЭЙГЭЭР шалгана — купон ЯМАР НЭГ багцад хүчинтэй
     * эсэхийг мэдэхэд хангалттай. Багц бүрийн бодит хүчинтэй эсэхийг
     * `priceAfterCoupon` доторх `minPrice` шалгалт шийднэ.
     */
    const maxPrice = Math.max(...plans.map((p) => p.price));
    try {
      const res = await validateCoupon.mutateAsync({ code: couponInput, price: maxPrice });
      setAppliedCoupon({
        code: couponInput.toUpperCase().trim(),
        discountType: res.discountType,
        amount: res.amount,
        /* ⚠️ Багц бүрд шалгахад хэрэгтэй (хямд багцад хүчингүй байж болно) */
        minPrice: res.minPrice ?? 0,
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
    if (intent.method === 'bank') {
      /* ⚠️ Дансны модал — нэвтэрсний дараа автоматаар нээгдэнэ */
      setBankPlan({ id: plan.id, name: plan.name });
    } else if (intent.method === 'qpay') {
      void buyWithQpay(plan.id);
    } else {
      void buyWithWallet(plan.id, priceAfterCoupon(plan.price));
    }
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-premium-solid/12 px-3 py-1 text-xs font-bold text-premium">
          <Sparkles size={12} /> BESTTV БАГЦУУД
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-5xl">
          Хүссэн багцаа сонго
        </h1>
        <p className="mt-3 text-foreground/55 md:text-lg">
          Багц бүр өөрийн ангиллын контентыг нээнэ. VIP бол бүгдийг нэг дор.
        </p>
      </div>

      {/* Хэтэвчийн үлдэгдэл */}
      {user && (
        <div className="mx-auto mt-8 flex max-w-md items-center justify-between rounded-xl border border-foreground/10 bg-foreground/4 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-foreground/60">
            <Wallet size={16} className="text-primary" /> Хэтэвч:{' '}
            <strong className="text-foreground">{formatPrice(user.walletBalance)}</strong>
          </span>
          <button
            /* ⚠️ `?tab=wallet` ЗААВАЛ — өмнө нь зүгээр `/profile` руу
               явуулдаг байсан тул хэрэглэгч ПРОФАЙЛ таб дээр бууж,
               цэнэглэх хэсгээ өөрөө хайх шаардлагатай болдог байв */
            onClick={() => router.push('/profile?tab=wallet')}
            className="rounded-lg bg-foreground/8 px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-foreground/14"
          >
            Цэнэглэх
          </button>
        </div>
      )}

      {/* Купон */}
      <div className="mx-auto mt-4 flex max-w-md items-center gap-2">
        <div className="relative flex-1">
          <Tag size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/35" />
          <input
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            placeholder="Купон код байвал энд оруулна уу"
            aria-label="Купон код"
            disabled={!!appliedCoupon}
            className="w-full rounded-lg border border-foreground/12 bg-foreground/5 py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground/35 outline-none focus:border-primary disabled:opacity-60"
          />
        </div>
        {appliedCoupon ? (
          <button
            onClick={() => { setAppliedCoupon(null); setCouponInput(''); }}
            className="shrink-0 rounded-lg bg-foreground/10 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/16"
          >
            Цуцлах
          </button>
        ) : (
          <button
            onClick={applyCoupon}
            disabled={validateCoupon.isPending || !couponInput.trim()}
            className="shrink-0 rounded-lg bg-foreground/10 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/16 disabled:opacity-50"
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
      {/*
        ⚠️⚠️ MOBILE-Д НЭГ БАГАНА (өмнө нь `grid-cols-2`).
        Утсан дээр 2 багана нь картыг хэт нарийн болгож: багцын нэр 2-3
        мөр болж, үнэ доошоо түлхэгдэж, картууд өөр өндөртэй болж
        зэрэгцээ нь ЗАМБАРААГҮЙ харагддаг байв (бодит гомдол).
        Нэг багана = бүх текст нэг мөрөнд багтаж, цэвэрхэн харагдана.
      */}
      {/* ⚠️ lg дээр 6 БАГАНА — карт бүр 2 эзэлнэ (доорх `lg:col-span-2`).
          Ингэснээр сүүлийн мөрийг хагас багана шилжүүлж ГОЛЛУУЛЖ болно. */}
      <div className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-4 min-[380px]:grid-cols-2 min-[380px]:gap-3 sm:gap-5 lg:grid-cols-6">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-80 rounded-2xl" />
          ))}

        {plans?.map((plan, i) => {
          /**
           * ⚠️⚠️ УРАМШУУЛАЛ → КУПОН (backend-тэй ЯГ ИЖИЛ дараалал).
           *
           * Backend нь `initiate` дээр ижилхэн бодно. Энд өөр
           * дараалал бичвэл хэрэглэгч харсан үнэ болон бодит төлбөр
           * ЗӨРНӨ — итгэл алдах шууд шалтгаан.
           */
          const promo: AppliedPromotion | undefined = promos?.[plan.id];
          const promoPrice = promo?.finalPrice ?? plan.price;
          /* ⚠️ `blockCoupons` — зарим урамшуулалд купон хориотой */
          const finalPrice = promo?.blockCoupons
            ? promoPrice
            : priceAfterCoupon(promoPrice);
          /* Зураастай харуулах хуучин үнэ — урамшуулал ЭСВЭЛ купон байвал */
          const showStrike = finalPrice < plan.price;
          const owned = ownedPlanIds.has(plan.id);
          // VIP идэвхтэй үед энгийн багц илүүдэл (VIP өөрөө биш)
          const supersededByVip = hasVip && !plan.isVip;
          // ⚠️ 2 багана (min-[380px]) сондгой тоотой бол СҮҮЛИЙН карт 2
          // баганыг эзэлнэ — хажуудаа хоосон нүх үлдээхгүй.
          const lastOdd = plans.length % 2 === 1 && i === plans.length - 1;

          /**
           * ⚠️⚠️ 3 БАГАНА (lg) ҮЕД СҮҮЛИЙН МӨРИЙГ ГОЛЛУУЛНА.
           *
           * 5 багц бол 3 + 2 болж, сүүлийн 2 нь ЗҮҮН талд наалдан
           * баруун талд ХООСОН НҮХ үлддэг байв (screenshot дээр
           * харагдсан). Grid-д "төвлөрүүлэх" шууд арга байхгүй тул
           * эхний картыг ХАГАС багана (`col-start`) руу түлхэнэ.
           *
           * ⚠️ Зөвхөн ҮЛДЭГДЭЛ 2 үед — 1 үлдвэл `lg:col-start-2` нь
           * дунд баганад тавина.
           */
          /**
           * ⚠️⚠️ СҮҮЛИЙН МӨРИЙГ ГОЛЛУУЛНА (lg = 6 багана, карт бүр 2).
           *
           * ЯАГААД 6 БАГАНА: 3 багана дээр 2 картыг ЖИНХЭНЭ голлуулах
           * арга байхгүй — `lg:col-start-2` нь 2-3 багана эзэлж БАРУУН
           * тийш түлхдэг (миний өмнөх буруу оролдлого).
           * 6 багана дээр карт бүр 2 эзэлбэл:
           *   3 карт → 1-2, 3-4, 5-6 (бүтэн мөр)
           *   2 үлдэх → 2-3, 4-5 гэж эхлэвэл ЯГ ДУНД
           *   1 үлдэх → 3-4 гэж эхлэвэл ЯГ ДУНД
           */
          const rem = plans.length % 3;
          const isFirstOfLastRow = rem !== 0 && i === plans.length - rem;
          const lgCenter = isFirstOfLastRow
            ? rem === 2
              ? 'lg:col-start-2' // 2 үлдсэн → 2-3, дараагийнх нь 4-5
              : 'lg:col-start-3' // 1 үлдсэн → 3-4 (яг дунд)
            : '';
          const canPayWithWallet = !!user && user.walletBalance >= finalPrice;

          return (
            <div
              key={plan.id}
              className={cn(
                // ⚠️ `h-full` — доторх `mt-auto` (товчны блок) ажиллахад ЗААВАЛ
                'relative flex h-full flex-col rounded-2xl border p-3 transition-transform sm:p-6',
                /* ⚠️ lg дээр grid нь 6 багана — карт бүр 2 эзэлнэ (=3 багана) */
                'lg:col-span-2',
                lastOdd && 'min-[380px]:col-span-2',
                lgCenter,
                !supersededByVip && 'hover:-translate-y-1',
                supersededByVip && 'opacity-55',
                plan.isVip
                  ? 'border-premium/60 bg-linear-to-b from-premium/10 to-transparent shadow-xl shadow-premium/10'
                  : /* ⚠️ УРАМШУУЛАЛТАЙ багц ЯЛГАРНА — маркетингийн гол
                       зорилго нь анхаарал татах. VIP нь өөрийн загвартай
                       тул дарж бичихгүй (VIP+урамшуулал бол VIP ялгарна). */
                    promo
                    ? 'border-premium/45 bg-linear-to-b from-premium/6 to-transparent hover:border-premium/70'
                    : 'border-foreground/10 bg-foreground/3 hover:border-foreground/20',
              )}
            >
              {plan.isVip && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-premium-solid px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-premium-foreground shadow-lg">
                  Хамгийн ашигтай
                </span>
              )}

              {/*
                ⚠️⚠️ УРАМШУУЛЛЫН ТУУЗ — ЗҮҮН ДЭЭД булан.
                Баруун дээд нь «Идэвхтэй»/«VIP-д багтсан» badge-тэй,
                дээд гол нь VIP-ийн туузтай тул зүүн л сул.
                ⚠️ VIP картад харуулахгүй — тэнд аль хэдийн 2 шошго бий,
                гурав дахь нь замбараагүй болгоно (шошго нь картын
                агуулгыг дарах ёсгүй).
              */}
              {promo && !plan.isVip && (
                <span className="absolute -top-2.5 left-3 z-10 whitespace-nowrap rounded-md bg-premium-solid px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-premium-foreground shadow-md sm:text-[11px]">
                  {promo.name}
                </span>
              )}
              {owned ? (
                <span
                  title={
                    expiryByPlan.get(plan.id)
                      ? `${expiryByPlan.get(plan.id)!.toLocaleDateString('mn-MN')} хүртэл`
                      : undefined
                  }
                  className="absolute right-2 top-2 rounded-full bg-success/20 px-1.5 py-0.5 text-[9px] font-bold text-success sm:right-4 sm:top-4 sm:px-2 sm:text-[11px]"
                >
                  Идэвхтэй
                </span>
              ) : supersededByVip ? (
                <span className="absolute right-2 top-2 rounded-full bg-premium-solid/20 px-1.5 py-0.5 text-[9px] font-bold text-premium sm:right-4 sm:top-4 sm:px-2 sm:text-[11px]">
                  VIP-д багтсан
                </span>
              ) : null}

              {/*
                ⚠️ `pr-24` — баруун дээд буланд "Идэвхтэй"/"VIP-д багтсан"
                badge нь `absolute` байрлалтай тул урт нэртэй багцын
                гарчиг ТҮҮНИЙ ДООГУУР ОРЖ ДАВХЦАДАГ байв. Зай үлдээв.
              */}
              {/* ⚠️ `min-h` БАГАСГАВ (3.9rem → 2.6rem) — ихэнх багцын нэр
                  2 мөрөнд багтдаг тул 3 мөрийн зай дэмий үлддэг байв */}
              <h3 className="flex min-[380px]:min-h-[2.6rem] items-start gap-1.5 pr-14 text-sm font-bold leading-snug text-foreground sm:min-h-0 sm:pr-24 sm:text-lg">
                {plan.isVip && <Crown size={16} className="text-premium" />}
                {plan.name}
              </h3>

              {/*
                ⚠️ МОБАЙЛД НЯГТРУУЛАВ — үнэ ба хугацаа НЭГ мөрөнд.
                Өмнө нь тусад нь 2 мөр байсан тул карт өндөр болж,
                утсан дээр 1.5 багц л дэлгэцэнд багтдаг байв.
              */}
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:mt-3">
                {showStrike ? (
                  <>
                    <p className="text-xl font-black text-foreground sm:text-3xl">{formatPrice(finalPrice)}</p>
                    <p className="text-sm text-foreground/35 line-through">{formatPrice(plan.price)}</p>
                  </>
                ) : (
                  <p className="text-xl font-black text-foreground sm:text-3xl">{formatPrice(plan.price)}</p>
                )}
                {/* ⚠️ "≈ 330₮ / өдөр" ХАСАВ — үндсэн үнээс анхаарал
                    сарниулж, картыг дүүргэдэг байв (админы шийдвэр) */}
                {/* ⚠️ Бонус хоног байвал НИЙТ хугацааг харуулна — «60 хоног»
                    гэж хараад «30-ыг төлж 60 авна» гэдэг нь шууд ойлгогдоно */}
                {promo?.bonusDays ? (
                  <span className="text-xs font-semibold text-premium">
                    / {promo.totalDays} хоног
                    <span className="ml-1 text-foreground/35 line-through">
                      {plan.durationDays}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-foreground/40">/ {plan.durationDays} хоног</span>
                )}
              </div>

              {/*
                ⚠️⚠️ УРАМШУУЛЛЫН ТАЙЛБАР — үнийн ЯГ ДООР.
                Хэрэглэгч үнэ хараад «яагаад хямд вэ» гэж эргэлзэх
                мөчид л энэ хариултыг өгнө. Доор нь тавибал уншихгүй.
              */}
              {promo?.shortText && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-dashed border-premium/40 bg-premium/8 px-2.5 py-1.5 sm:mt-3">
                  <Gift size={13} className="mt-0.5 shrink-0 text-premium" />
                  <p className="text-[11px] font-semibold leading-snug text-premium sm:text-xs">
                    {promo.shortText}
                  </p>
                </div>
              )}

              {/* ⚠️ Бэлэг багц — «нэмж юу авахыг» тодорхой хэлнэ */}
              {promo?.giftPlanName && (
                <p className="mt-1.5 text-[11px] text-premium/85">
                  + «{promo.giftPlanName}» багц дагалдана
                </p>
              )}

              {/* Нээгдэх контент */}
              <div className="mt-2.5 rounded-lg bg-black/20 p-2 sm:mt-4 sm:p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/35 sm:text-[11px]">
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
                          g.isAdult ? 'bg-destructive/20 text-destructive' : 'bg-foreground/8 text-foreground/65',
                        )}
                      >
                        {g.isAdult && '🔞 '}
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/*
                ⚠️ МОБАЙЛД БОЛОМЖУУДЫГ НУУВ (`hidden min-[380px]:block`
                биш — `hidden sm:block`).

                "Завсаргүй үзвэр / FHD чанар / Олон төхөөрөмж" нь БҮХ
                багцад ИЖИЛ тул харьцуулахад тус болохгүй атлаа карт
                бүрд 3 мөр (≈70px) эзэлдэг байв. Утсан дээр тэр нь
                нэг дэлгэцэнд багтах багцын тоог ХАГАСЛАНА.
                Оронд нь доор НЭГ УДАА нэгтгэж харуулна.
              */}
              <ul className="mt-3 hidden flex-1 space-y-1.5 sm:mt-4 sm:block sm:space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs leading-snug text-foreground/70 sm:gap-2 sm:text-sm">
                    <Check size={15} className="mt-0.5 shrink-0 text-success" /> {f}
                  </li>
                ))}
              </ul>
              {/* ⚠️ Мобайлд `flex-1`-ийг ЭНД барина — эс бөгөөс `mt-auto`
                  ажиллахгүй, товч картын дунд гацна */}
              <div className="flex-1 sm:hidden" />

              {/*
                ⚠️ `mt-auto` — товчны блокыг картын ЁРООЛД бэхлэнэ.
                Багцуудын гарчиг/боломжийн жагсаалт өөр өөр урттай тул
                mobile-д (grid-cols-2) товчнууд ӨӨР ӨНДӨРТ таарч,
                зэрэгцээ нь замбараагүй харагддаг байв.
              */}
              <div className="mt-auto space-y-2 pt-5">
                {supersededByVip && (
                  <p className="rounded-lg bg-premium-solid/10 px-3 py-2 text-center text-[11px] leading-relaxed text-premium">
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
                    /* ⚠️ `min-h-10` — хүрэх талбар (WCAG) */
                    'flex min-h-10 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg py-2 text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 sm:gap-2 sm:py-2.5 sm:text-sm',
                    canPayWithWallet
                      ? plan.isVip
                        ? 'bg-premium-solid text-premium-foreground hover:brightness-105'
                        : 'bg-primary text-primary-foreground hover:brightness-110'
                      : 'bg-foreground/8 text-foreground/50',
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
                  /* ⚠️ ХҮРЭЭТЭЙ — `bg-foreground/8` ганцаараа гэрэл горимд
                     саарал картан дээр БҮДЭГ харагдаж, товч эсэхийг ялгахад
                     хэцүү байв. Хүрээ + бараан текст нь хоёр горимд ч тод. */
                  className="flex min-h-9 w-full items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-foreground/15 bg-foreground/5 py-1.5 text-[11px] font-semibold text-foreground/85 transition-colors hover:border-foreground/30 hover:bg-foreground/12 hover:text-foreground disabled:opacity-50 sm:gap-1.5 sm:py-2 sm:text-xs"
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

                {/*
                  ⚠️ ДАНСААР ШИЛЖҮҮЛЭХ — ЗӨВХӨН админ асаасан үед.
                  Унтраалттай үед backend нь дансны дугаарыг ч
                  буцаадаггүй тул товч харуулах утгагүй.

                  ⚠️ ЖИЖИГ, гуравдугаар зэрэглэлийн товч — QPay нь
                  автоматаар баталгаажих тул ҮНДСЭН зам байх ёстой.
                  Дансаар нь гараар шалгадаг (удаан) тул нөөц сонголт.
                */}
                {bank?.enabled && !supersededByVip && (
                  <button
                    onClick={() => {
                      /**
                       * ⚠️⚠️ НЭВТРЭЭГҮЙ БОЛ ЭХЛЭЭД НЭВТРҮҮЛНЭ.
                       *
                       * Өмнө нь модал шууд нээгдээд `/bank/initiate`
                       * нь 401 буцааж «Authentication required» гэсэн
                       * АНГЛИ алдаа гардаг байв (хэрэглэгчийн скриншот).
                       *
                       * `loginUrlWithIntent` нь нэвтэрсний дараа ЭНЭ
                       * хуудас руу буцаж, модалыг автоматаар нээнэ.
                       */
                      if (!user) {
                        router.push(
                          loginUrlWithIntent({
                            type: 'buy-plan',
                            planId: plan.id,
                            method: 'bank',
                            couponCode: appliedCoupon?.code,
                          }),
                        );
                        return;
                      }
                      setBankPlan({ id: plan.id, name: plan.name });
                    }}
                    className="flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-lg py-1 text-[10px] font-medium text-foreground/45 transition-colors hover:text-foreground/75 sm:text-[11px]"
                  >
                    <Building2 size={11} />
                    Дансаар шилжүүлэх
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/*
        ⚠️ МОБАЙЛД БОЛОМЖУУДЫГ НЭГ УДАА — карт бүрд давтахын оронд.
        Эдгээр нь БҮХ багцад ижил тул харьцуулахад тус болохгүй атлаа
        карт бүрд ~70px эзэлж, нэг дэлгэцэнд багтах багцын тоог
        хагаслаж байв.
      */}
      <div className="mx-auto mt-5 flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-xl border border-foreground/10 bg-foreground/3 px-4 py-3 sm:hidden">
        {/*
          ⚠️ «Олон төхөөрөмж» гэж бичихээ БОЛИВ — нэг эрхээр зэрэг
          нэвтрэх төхөөрөмж 2-оор ХЯЗГААРЛАГДСАН тул тэр үг ХУДАЛ
          амлалт болно (хэрэглэгч гомдох, буцаалт нэхэх үндэслэл).
          Тодорхой тоо бичих нь итгэл алдахаас сэргийлнэ.
        */}
        {['Завсаргүй үзвэр', 'FHD чанар', '2 төхөөрөмж хүртэл'].map((f) => (
          <span key={f} className="flex items-center gap-1.5 text-xs text-foreground/70">
            <Check size={14} className="shrink-0 text-success" /> {f}
          </span>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-md text-center text-xs text-foreground/35">
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

      {/*
        ⚠️ ДАНСААР ШИЛЖҮҮЛЭХ МОДАЛ — QPay-тэй зэрэг нээгдэхгүй
        (хоёулаа `absolute` тул давхарлавал будлиан үүснэ). Хэрэглэгч
        нэг замыг сонгоно.

        ⚠️ `couponCode` дамжуулна — модал дотор backend нь ижил үнэ
        бодох ёстой (хэрэглэгч купонтой үнийг харчихсан).
      */}
      {bankPlan && bank?.enabled && (
        <BankTransferModal
          open
          info={bank}
          planId={bankPlan.id}
          couponCode={appliedCoupon?.code}
          label={bankPlan.name}
          onClose={() => setBankPlan(null)}
          onClaimed={() => void refreshAll()}
        />
      )}

    </main>
  );
}
