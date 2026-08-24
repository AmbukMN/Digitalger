'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, Loader2, Ticket, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice, formatRentDuration, formatRentDurationShort } from '@besttv/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { QPayCheckout, type QPayInvoice } from '@/components/payment/qpay-checkout';
import {
  PaymentMethodSheet,
  useCardPaymentEnabled,
  type PayMethod as SheetMethod,
} from '@/components/payment/payment-method-sheet';
import { loginUrlWithIntent } from '@/lib/auth-intent';

interface Props {
  open: boolean;
  onClose: () => void;
  titleId: string;
  titleName: string;
  price: number;
  hours: number;
  /** Түрээс амжилттай — detail-ыг refetch хийнэ */
  onRented: () => void;
}

/**
 * Ширхэгээр түрээслэх модал.
 *
 * ⚠️ Урсгал: хэтэвчийн үлдэгдэл хүрвэл ШУУД түрээслэнэ. Хүрэхгүй бол дутуу
 * дүнг QPay-ээр цэнэглээд (банкны апп + QR), төлбөр батлагдмагц АВТОМАТ
 * түрээслэнэ — хэрэглэгчийг профайл руу явуулж, буцаж ирүүл гэж шаардахгүй.
 */
export function RentDialog({ open, onClose, titleId, titleName, price, hours, onRented }: Props) {
  const router = useRouter();
  const { user, refreshMe } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [invoice, setInvoice] = useState<QPayInvoice | null>(null);
  /* ⚠️ Төлбөрийн аргын цонх — «төлж түрээслэх» дарахад */
  const [sheetOpen, setSheetOpen] = useState(false);
  const cardEnabled = useCardPaymentEnabled();

  /**
   * ⚠️⚠️ ДАВХАР ДАРАЛТААС ХАМГААЛАХ — `busy` state ХАНГАЛТГҮЙ.
   *
   * БОДИТ АЛДАА: `setBusy(true)` нь React-ийн дараагийн рендерт л
   * үйлчилнэ. Гар утсан дээр хурдан 2 удаа хүрэхэд (`touchstart` нь
   * рендерээс өмнө буудаг) хоёр дахь даралт нь `disabled` болоогүй
   * товч дээр бууж, `/rentals/:id/wallet` ХОЁР УДАА явна → хэтэвчнээс
   * ХОЁР ДАХИН мөнгө хасагдана.
   *
   * `ref` нь шууд, синхроноор өөрчлөгддөг тул энэ цонхыг бүрэн хаана.
   */
  const inFlight = useRef(false);

  const balance = user?.walletBalance ?? 0;
  const shortfall = Math.max(0, price - balance);
  // ⚠️ QPay хамгийн бага дүн 1,000₮ — дутагдал түүнээс бага ч 1,000₮ цэнэглэнэ
  const topupAmount = Math.max(1000, Math.ceil(shortfall / 100) * 100);

  // Модал хаагдахад төлөв бүрэн цэвэрлэнэ (дахин нээхэд хуучин QR гарахгүй)
  useEffect(() => {
    if (open) return;
    setInvoice(null);
    setDone(false);
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open || invoice) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, invoice, onClose]);

  /** Хэтэвчээр түрээслэх (үлдэгдэл хүрсэн үед) */
  const rent = async () => {
    /* ⚠️ Хэтэвчнээс ХОЁР ДАХИН хасагдахаас сэргийлнэ (дээрх тайлбар) */
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await api(`/rentals/${titleId}/wallet`, { method: 'POST', body: JSON.stringify({}) });
      await refreshMe();
      setDone(true);
      onRented();
      toast.success(`${formatRentDuration(hours)}-ийн турш үзэх эрх нээгдлээ 🎬`);
      setTimeout(onClose, 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа, дахин оролдоно уу');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  /**
   * ⚠️⚠️ ШУУД QPay-ЭЭР ТҮРЭЭСЛЭХ — хэтэвч ОГТ дамжихгүй.
   *
   * Өмнө нь цорын ганц зам нь "хэтэвч цэнэглэх" байсан тул хэрэглэгч
   * кино түрээслэх гэтэл "ХЭТЭВЧ ЦЭНЭГЛЭХ" гэсэн БУРУУ гарчиг харж,
   * "би кино авах гээд байхад яагаад хэтэвч?" гэж эргэлздэг байв
   * (бодит гомдол). Мөн 1,000₮-ийн доод хязгаараас болж 4,900₮-ийн
   * кинонд 5,000₮ цэнэглэгдэж, үлдэгдэл гацдаг.
   *
   * Одоо ЯГ киноны үнээр төлнө. Төлбөр батлагдмагц backend өөрөө
   * `Rental` үүсгэнэ (`completePayment` → `rentals.grantFromPayment`).
   */
  const payDirect = async (method?: SheetMethod) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await api<
        QPayInvoice & { devMode?: boolean; already?: boolean; redirectUrl?: string }
      >('/payments/rental/initiate', {
        method: 'POST',
        /* ⚠️ `method` байхгүй = QPay (хуучин зам огт өөрчлөгдөөгүй) */
        body: JSON.stringify({ titleId, ...(method ? { method } : {}) }),
      });
      /* ─── Карт · Apple Pay · Google Pay · WeChat → hosted хуудас ─── */
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      /* ⚠️ Хэрэглэгч өөр таб дээр аль хэдийн түрээсэлсэн байж болно */
      if (res.already) {
        onRented();
        toast.success('Энэ кино аль хэдийн нээлттэй байна');
        onClose();
        return;
      }
      if (res.devMode) {
        setDone(true);
        onRented();
        setTimeout(onClose, 1200);
        return;
      }
      setInvoice({
        paymentId: res.paymentId,
        qrImage: res.qrImage,
        qrText: res.qrText,
        urls: res.urls,
        amount: price,
        /* ⚠️ Энэ нэхэмжлэл нь ШУУД түрээс — төлөгдмөгц кино нээгдэнэ,
           хэтэвч рүү мөнгө ОРОХГҮЙ (`onPaid` дотор ялгана) */
        kind: 'rental',
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'QPay нэхэмжлэл үүсгэж чадсангүй');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  /** Дутуу дүнг QPay-ээр цэнэглэх → батлагдмагц автомат түрээслэнэ */
  const startTopup = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await api<QPayInvoice & { devMode?: boolean }>('/payments/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount: topupAmount }),
      });
      if (res.devMode) {
        await refreshMe();
        /* ⚠️ ЗААВАЛ суллана — `rent()` нь `inFlight`-ыг өөрөө шалгадаг
           тул суллахгүй бол dev горимд түрээс ЧИМЭЭГҮЙ алгасагдана */
        inFlight.current = false;
        await rent();
        return;
      }
      setInvoice({
        paymentId: res.paymentId,
        qrImage: res.qrImage,
        qrText: res.qrText,
        urls: res.urls,
        amount: topupAmount,
        kind: 'topup',
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'QPay нэхэмжлэл үүсгэж чадсангүй');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  /** Цонхон дээр арга сонгоод «Төлөх» дарахад */
  const paySelected = async (method: SheetMethod) => {
    setSheetOpen(false);
    if (method === 'wallet') {
      await rent();
      return;
    }
    if (method === 'qpay') {
      await payDirect();
      return;
    }
    /* карт/Apple/Google/WeChat — hosted хуудас руу */
    await payDirect(method);
  };

  if (!open) return null;

  /* Төлбөрийн аргын цонх — үндсэн модалын ОРОНД харагдана */
  if (sheetOpen) {
    return (
      <PaymentMethodSheet
        open
        onClose={() => setSheetOpen(false)}
        amount={price}
        subtitle={`${titleName} — ${formatRentDurationShort(hours)} түрээс`}
        kind="rental"
        walletBalance={balance}
        /* ⚠️ Кино түрээслэхэд дансаар шилжүүлэх БАЙХГҮЙ (гараар
           баталгаажуулах удаан — түрээс шуурхай байх ёстой) */
        bankEnabled={false}
        cardEnabled={cardEnabled}
        busy={busy}
        onSelect={paySelected}
      />
    );
  }

  // QPay төлбөрийн модал — цэнэглэгдмэгц автоматаар түрээслэнэ
  if (invoice) {
    return (
      <QPayCheckout
        invoice={invoice}
        subtitle={`${titleName} — ${formatRentDurationShort(hours)} түрээс`}
        successText="Кино нээгдэж байна…"
        onPaid={async () => {
          /**
           * ⚠️ ХОЁР ӨӨР УРСГАЛ:
           *  `rental` — backend аль хэдийн Rental үүсгэсэн. Дахин
           *             `rent()` дуудвал ХОЁР ДАХЬ удаа мөнгө хасагдана.
           *  `topup`  — зөвхөн хэтэвч цэнэглэгдсэн, түрээсийг ЭНД хийнэ.
           */
          if (invoice.kind === 'rental') {
            /**
             * ⚠️⚠️ `refreshMe()` ЗААВАЛ — өмнө нь ЭНД байхгүй байв.
             *
             * БОДИТ АЛДАА: `rentedTitleIds` нь `/auth/me`-ээс ирдэг ба
             * зөвхөн 3 минут тутам шинэчлэгддэг. QPay-ээр түрээсэлсэн
             * хэрэглэгч нүүр рүү буцахад САЯ мөнгө төлсөн кино нь
             * «🔒 Төлбөртэй» гэж харагдаж, дарвал дахин түрээслэхийг
             * санал болгодог байв — итгэл алдагдуулах шууд асуудал.
             *
             * ⚠️ `await` хийхгүй — модал хаагдахыг саатуулах хэрэггүй,
             * гэхдээ алдааг чимээгүй залгина (эрх нь аль хэдийн нээгдсэн).
             */
            refreshMe().catch(() => null);
            setDone(true);
            onRented();
            setTimeout(onClose, 1500);
            return;
          }
          await refreshMe();
          await rent();
        }}
        onClose={() => setInvoice(null)}
      />
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 z-100 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-foreground/10 bg-card shadow-2xl"
        >
          <button
            onClick={onClose}
            aria-label="Хаах"
            className="absolute right-3 top-3 rounded-full p-1.5 text-foreground/50 hover:bg-foreground/10 hover:text-foreground"
          >
            <X size={18} />
          </button>

          {done ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <CheckCircle2 size={52} className="text-success" />
              <p className="mt-4 text-lg font-bold text-foreground">Түрээс амжилттай</p>
              <p className="mt-1 text-sm text-foreground/55">{formatRentDuration(hours)}-ийн турш үзэх боломжтой</p>
            </div>
          ) : (
            <div className="px-6 py-7">
              <div className="flex items-center gap-2 text-primary">
                <Ticket size={20} />
                <p className="text-sm font-bold uppercase tracking-wide">Ширхэгээр түрээслэх</p>
              </div>

              <h3 className="mt-2 text-xl font-black leading-tight text-foreground">{titleName}</h3>

              <div className="mt-5 rounded-xl border border-foreground/10 bg-foreground/4 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-foreground/60">Түрээсийн үнэ</span>
                  <span className="text-2xl font-black text-foreground">{formatPrice(price)}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-sm text-foreground/55">
                  <Clock size={14} /> Төлсөн үеэс {formatRentDuration(hours)}-ийн турш хязгааргүй үзнэ
                </div>
              </div>

              {!user ? (
                <button
                  onClick={() =>
                    // ⚠️ Нэвтэрсний дараа энэ кино руу буцаж ирээд түрээсийн
                    // модал АВТОМАТ нээгдэнэ
                    router.push(loginUrlWithIntent({ type: 'rent-title', titleId }))
                  }
                  className="mt-5 w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground hover:brightness-110"
                >
                  Нэвтэрч түрээслэх
                </button>
              ) : (
                <>
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-foreground/4 px-3.5 py-2.5 text-sm">
                    <span className="flex items-center gap-1.5 text-foreground/60">
                      <Wallet size={14} /> Хэтэвчийн үлдэгдэл
                    </span>
                    <span
                      className={
                        shortfall > 0 ? 'font-semibold text-premium' : 'font-semibold text-success'
                      }
                    >
                      {formatPrice(balance)}
                    </span>
                  </div>

                  {/*
                    ⚠️⚠️ ҮНДСЭН ТОВЧ нь ҮРГЭЛЖ "төлж түрээслэх".
                    Хэтэвч хүрвэл хэтэвчээр, эс бөгөөс ШУУД QPay-ээр —
                    хоёр тохиолдолд ч хэрэглэгч ЯГ киноны үнийг л төлнө.
                    Өмнө нь хүрэхгүй үед "5,000₮ цэнэглээд түрээслэх"
                    гэж гардаг байсан нь: (1) илүү мөнгө шаардаж байгаа
                    мэт харагдана, (2) "хэтэвч" гэдэг нь киноны хуудсанд
                    хамааралгүй ойлголт (бодит гомдол).
                  */}
                  {/* ⚠️ Төлбөрийн аргын цонх нээнэ (QPay default, карт/
                      Apple/Google/WeChat/хэтэвч мөн тэндээс) */}
                  <button
                    onClick={() => setSheetOpen(true)}
                    disabled={busy}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
                  >
                    {busy && <Loader2 size={16} className="animate-spin" />}
                    {formatPrice(price)} төлж түрээслэх
                  </button>

                  {/*
                    ⚠️ Хэтэвч цэнэглэх нь НЭМЭЛТ сонголт болов — олон
                    кино авах хүнд хэрэгтэй (нэг цэнэглээд олон удаа).
                    Зөвхөн үлдэгдэл хүрэхгүй үед харуулна.
                  */}
                  {shortfall > 0 && (
                    <button
                      onClick={startTopup}
                      disabled={busy}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-foreground/12 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5 disabled:opacity-50"
                    >
                      <Wallet size={14} />
                      Эсвэл {formatPrice(topupAmount)} хэтэвчээ цэнэглэх
                    </button>
                  )}
                </>
              )}

              <p className="mt-3 text-center text-xs text-foreground/35">
                Багц авбал энэ болон бусад киног хязгааргүй үзнэ
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
