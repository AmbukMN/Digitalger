'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@digitalger/shared/ui';
import { paymentsApi } from '@/lib/api';
import type { PaymentInitiateResult } from '@/types/api';

interface QPayCheckoutProps {
  payment: PaymentInitiateResult;
  token: string;
  onSuccess: () => void;
  onClose: () => void;
}

const POLL_INTERVAL = 5000;

// Bank deeplink schemes from QPay V2 API docs
const BANK_DEEPLINKS: Record<string, string> = {
  'Khan Bank': 'khanbank://q?qPay_QRcode=',
  'Golomt Bank': 'golomtbank://q?qPay_QRcode=',
  'TDB': 'tdbbank://q?qPay_QRcode=',
  'Trade and Development Bank': 'tdbbank://q?qPay_QRcode=',
  'Xac Bank': 'xacbank://q?qPay_QRcode=',
  'XacBank': 'xacbank://q?qPay_QRcode=',
  'State Bank': 'statebank://q?qPay_QRcode=',
  'Capitron Bank': 'capitronbank://q?qPay_QRcode=',
  'M Bank': 'mbank://q?qPay_QRcode=',
  'Most Money': 'mostmoney://q?qPay_QRcode=',
  'Ard App': 'ardapp://q?qPay_QRcode=',
  'Ard': 'ardapp://q?qPay_QRcode=',
  'Bogd Bank': 'bogdbank://q?qPay_QRcode=',
  'NIBank': 'nibank://q?qPay_QRcode=',
  'National Investment Bank': 'nibank://q?qPay_QRcode=',
  'Chinggis Khaan Bank': 'ckbank://q?qPay_QRcode=',
  'CK Bank': 'ckbank://q?qPay_QRcode=',
};

function getBankLink(name: string, link: string, qrText?: string): string {
  if (!qrText) return link;
  const scheme = BANK_DEEPLINKS[name];
  if (scheme) return `${scheme}${encodeURIComponent(qrText)}`;
  // Fallback: try to find partial match
  const nameUpper = name.toUpperCase();
  for (const [key, val] of Object.entries(BANK_DEEPLINKS)) {
    if (nameUpper.includes(key.toUpperCase()) || key.toUpperCase().includes(nameUpper)) {
      return `${val}${encodeURIComponent(qrText)}`;
    }
  }
  return link;
}

function BankAppButton({
  name,
  link,
  logo,
  qrText,
}: {
  name: string;
  link: string;
  logo: string;
  qrText?: string;
}) {
  const deeplink = getBankLink(name, link, qrText);
  return (
    <a
      href={deeplink}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/30 p-2.5 hover:bg-muted transition-all active:scale-95 cursor-pointer"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        alt={name}
        className="h-10 w-10 rounded-lg object-contain"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      <span className="text-[9px] font-medium text-center leading-tight text-muted-foreground line-clamp-2 w-full">
        {name}
      </span>
    </a>
  );
}

function PaymentStepsDesktop() {
  const steps = [
    'Банкны аппликейшнаа нээнэ',
    'QR код скан хийх',
    'Дүнг баталгаажуулаад, нэг товшилтоор төлнө',
  ];
  return (
    <div className="hidden sm:block rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-2">
      <p className="text-xs font-semibold text-foreground mb-1">3 алхамаар амархан төлнө</p>
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground mt-0.5">
            {i + 1}
          </span>
          <span className="text-xs text-foreground leading-relaxed">{step}</span>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground pt-1 leading-relaxed border-t border-border/40 mt-1">
        Төлбөр баталгаажмагц нэн даруй файл татах, сургалт үзэх эрх нээгдэнэ.
      </p>
    </div>
  );
}

function PaymentStepsMobile() {
  return (
    <div className="sm:hidden rounded-xl border border-primary/20 bg-muted/40 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground mt-0.5">!</span>
        <div>
          <p className="text-sm font-semibold text-foreground leading-snug">
            Дээрх банкны товч дээр дараад төлбөрөө хийгээрэй.
          </p>
          <p className="text-[10px] text-muted-foreground pt-1 leading-relaxed">
            Төлбөр баталгаажмагц нэн даруй файл татах, сургалт үзэх эрх нээгдэнэ.
          </p>
        </div>
      </div>
    </div>
  );
}

export function QPayCheckout({ payment, token, onSuccess, onClose }: QPayCheckoutProps) {
  const [checking, setChecking] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkPayment = async (silent = false) => {
    if (!silent) setChecking(true);
    setError(null);
    try {
      const result = await paymentsApi.checkQPay(token, payment.orderId);
      if (result.paid) {
        setPaid(true);
        if (pollRef.current) clearInterval(pollRef.current);
        successTimerRef.current = setTimeout(onSuccess, 1500);
      }
    } catch {
      if (!silent) setError('Шалгахад алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      if (!silent) setChecking(false);
    }
  };

  useEffect(() => {
    pollRef.current = setInterval(() => checkPayment(true), POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      // unmount болоход success setTimeout-ийг ч цэвэрлэнэ (unmounted component
      // дээр onSuccess дуудах React warning/navigation алдаанаас сэргийлнэ).
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment.orderId]);

  const qrImageSrc = payment.qrImage
    ? payment.qrImage.startsWith('data:')
      ? payment.qrImage
      : `data:image/png;base64,${payment.qrImage}`
    : null;

  const bankUrls = payment.urls ?? [];
  const qrText = payment.qrText;

  return (
    <AnimatePresence>
      <motion.div
        key="qpay-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={paid ? undefined : onClose}
        aria-hidden
      />

      <motion.div
        key="qpay-modal"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-sm">Q</div>
            <div>
              <p className="font-bold text-sm leading-tight">QPay-ээр Төлбөр Хийх</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Монголын бүх банкны аппаар нэн даруй төлнө</p>
            </div>
          </div>
          {!paid && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
              aria-label="Хаах"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1">
          {paid ? (
            /* Success state */
            <div className="flex flex-col items-center gap-3 py-10 px-5">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </motion.div>
              <p className="text-lg font-bold">Амжилттай! Захиалга баталгаажлаа</p>
              <p className="text-sm text-muted-foreground text-center">
                Захиалга баталгаажлаа. Миний сан руу шилжиж байна...
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* ── MOBILE: банкны апп ЭХЭНД (утсан дээр QR скан хийх боломжгүй,
                   хэрэглэгч шууд аппаа сонгоно). QR-г доор жижиг харуулна. ── */}
              {bankUrls.length > 0 && (
                <div className="sm:hidden">
                  <p className="text-sm font-semibold text-foreground mb-1">Банкны аппаа сонгоно уу</p>
                  <p className="text-[11px] text-muted-foreground mb-2.5">Аппаа дарвал шууд төлбөрийн хуудас нээгдэнэ</p>
                  <div className="grid grid-cols-4 gap-2">
                    {bankUrls.map((url) => (
                      <BankAppButton
                        key={url.name}
                        name={url.name}
                        link={url.link}
                        logo={url.logo}
                        qrText={qrText}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* QR code — desktop ТОМ (скан), mobile ЖИЖИГ (өөр төхөөрөмжөөс скан) */}
              {qrImageSrc && (
                <div className="flex flex-col items-center gap-2">
                  <p className="sm:hidden text-[11px] font-medium text-muted-foreground self-start">
                    Эсвэл өөр төхөөрөмжөөс QR-ийг уншуулна уу:
                  </p>
                  <div className="rounded-xl border-2 border-primary/20 p-2 bg-white shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrImageSrc}
                      alt="QPay QR код"
                      className="h-32 w-32 sm:h-48 sm:w-48 object-contain"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                    QR хүчинтэй хугацаа: 15 минут
                  </p>
                </div>
              )}

              {/* No data */}
              {!qrImageSrc && bankUrls.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Төлбөрийн мэдээлэл ачаалж байна...</p>
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-center text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer: steps + check button — always visible */}
        {!paid && (
          <div className="shrink-0 border-t border-border px-5 py-4 space-y-3 bg-background">
            <PaymentStepsDesktop />
            <PaymentStepsMobile />

            <Button
              className="w-full gap-2 h-11 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
              onClick={() => checkPayment(false)}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {checking ? 'Шалгаж байна...' : 'Төлбөр шалгах'}
            </Button>
            <p className="text-center text-[10px] text-muted-foreground">
              Төлбөр хийсний дараа автоматаар баталгаажна
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
