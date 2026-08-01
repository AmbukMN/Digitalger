'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, Loader2, Ticket, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@besttv/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { QPayCheckout, type QPayInvoice } from '@/components/payment/qpay-checkout';
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
    setBusy(true);
    try {
      await api(`/rentals/${titleId}/wallet`, { method: 'POST', body: JSON.stringify({}) });
      await refreshMe();
      setDone(true);
      onRented();
      toast.success(`${hours} цагийн турш үзэх эрх нээгдлээ 🎬`);
      setTimeout(onClose, 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа, дахин оролдоно уу');
    } finally {
      setBusy(false);
    }
  };

  /** Дутуу дүнг QPay-ээр цэнэглэх → батлагдмагц автомат түрээслэнэ */
  const startTopup = async () => {
    setBusy(true);
    try {
      const res = await api<QPayInvoice & { devMode?: boolean }>('/payments/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount: topupAmount }),
      });
      if (res.devMode) {
        await refreshMe();
        await rent();
        return;
      }
      setInvoice({
        paymentId: res.paymentId,
        qrImage: res.qrImage,
        qrText: res.qrText,
        urls: res.urls,
        amount: topupAmount,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'QPay нэхэмжлэл үүсгэж чадсангүй');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  // QPay төлбөрийн модал — цэнэглэгдмэгц автоматаар түрээслэнэ
  if (invoice) {
    return (
      <QPayCheckout
        invoice={invoice}
        subtitle={`${titleName} — ${hours}ц түрээс`}
        successText="Кино нээгдэж байна…"
        onPaid={async () => {
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
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#141518] shadow-2xl"
        >
          <button
            onClick={onClose}
            aria-label="Хаах"
            className="absolute right-3 top-3 rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>

          {done ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <CheckCircle2 size={52} className="text-success" />
              <p className="mt-4 text-lg font-bold text-white">Түрээс амжилттай</p>
              <p className="mt-1 text-sm text-white/55">{hours} цагийн турш үзэх боломжтой</p>
            </div>
          ) : (
            <div className="px-6 py-7">
              <div className="flex items-center gap-2 text-primary">
                <Ticket size={20} />
                <p className="text-sm font-bold uppercase tracking-wide">Ширхэгээр түрээслэх</p>
              </div>

              <h3 className="mt-2 text-xl font-black leading-tight text-white">{titleName}</h3>

              <div className="mt-5 rounded-xl border border-white/10 bg-white/4 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-white/60">Түрээсийн үнэ</span>
                  <span className="text-2xl font-black text-white">{formatPrice(price)}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-sm text-white/55">
                  <Clock size={14} /> Төлсөн үеэс {hours} цагийн турш хязгааргүй үзнэ
                </div>
              </div>

              {!user ? (
                <button
                  onClick={() =>
                    // ⚠️ Нэвтэрсний дараа энэ кино руу буцаж ирээд түрээсийн
                    // модал АВТОМАТ нээгдэнэ
                    router.push(loginUrlWithIntent({ type: 'rent-title', titleId }))
                  }
                  className="mt-5 w-full rounded-lg bg-primary py-3 font-semibold text-white hover:brightness-110"
                >
                  Нэвтэрч түрээслэх
                </button>
              ) : (
                <>
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-white/4 px-3.5 py-2.5 text-sm">
                    <span className="flex items-center gap-1.5 text-white/60">
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

                  <button
                    onClick={shortfall > 0 ? startTopup : rent}
                    disabled={busy}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-white hover:brightness-110 disabled:opacity-50"
                  >
                    {busy && <Loader2 size={16} className="animate-spin" />}
                    {shortfall > 0
                      ? `${formatPrice(topupAmount)} цэнэглээд түрээслэх`
                      : `${formatPrice(price)} төлж түрээслэх`}
                  </button>
                </>
              )}

              <p className="mt-3 text-center text-xs text-white/35">
                Багц авбал энэ болон бусад киног хязгааргүй үзнэ
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
