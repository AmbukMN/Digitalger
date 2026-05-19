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

function BankAppButton({ name, link, logo }: { name: string; link: string; logo: string }) {
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-3 hover:bg-muted transition-colors active:scale-95"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt={name} className="h-10 w-10 rounded-lg object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <span className="text-[10px] font-medium text-center leading-tight text-muted-foreground line-clamp-2 w-full">
        {name}
      </span>
    </a>
  );
}

export function QPayCheckout({ payment, token, onSuccess, onClose }: QPayCheckoutProps) {
  const [checking, setChecking] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkPayment = async (silent = false) => {
    if (!silent) setChecking(true);
    setError(null);
    try {
      const result = await paymentsApi.checkQPay(token, payment.orderId);
      if (result.paid) {
        setPaid(true);
        if (pollRef.current) clearInterval(pollRef.current);
        setTimeout(onSuccess, 1500);
      }
    } catch {
      if (!silent) setError('Шалгахад алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      if (!silent) setChecking(false);
    }
  };

  // Auto-poll every 5 seconds
  useEffect(() => {
    pollRef.current = setInterval(() => checkPayment(true), POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment.orderId]);

  const qrImageSrc = payment.qrImage
    ? payment.qrImage.startsWith('data:')
      ? payment.qrImage
      : `data:image/png;base64,${payment.qrImage}`
    : null;

  const bankUrls = payment.urls ?? [];

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
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            {/* QPay logo-style text */}
            <span className="font-bold text-lg text-primary">Q</span>
            <span className="font-bold text-lg">Pay</span>
            <span className="ml-1 text-sm text-muted-foreground">төлбөр</span>
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

        <div className="p-5">
          {paid ? (
            /* Success state */
            <div className="flex flex-col items-center gap-3 py-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </motion.div>
              <p className="text-lg font-bold">Төлбөр амжилттай!</p>
              <p className="text-sm text-muted-foreground text-center">
                Захиалга баталгаажлаа. Миний сан руу чиглэж байна...
              </p>
            </div>
          ) : (
            <>
              {/* Desktop: QR code */}
              {qrImageSrc && (
                <div className="hidden sm:flex flex-col items-center gap-3">
                  <p className="text-sm text-muted-foreground text-center">
                    QPay апп эсвэл банкны апп-аар QR кодыг уншуулна уу
                  </p>
                  <div className="rounded-xl border-2 border-primary/20 p-2 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrImageSrc}
                      alt="QPay QR код"
                      className="h-52 w-52 object-contain"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Хугацаа: 15 минут</p>
                </div>
              )}

              {/* Mobile: Bank apps */}
              {bankUrls.length > 0 && (
                <div className={qrImageSrc ? 'sm:hidden' : ''}>
                  <p className="text-sm text-muted-foreground text-center mb-3">
                    Банкны апп-аа сонгоно уу
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {bankUrls.slice(0, 9).map((url) => (
                      <BankAppButton key={url.name} name={url.name} link={url.link} logo={url.logo} />
                    ))}
                  </div>
                </div>
              )}

              {/* No QR and no bank urls: wait message */}
              {!qrImageSrc && bankUrls.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Төлбөр хүлээж байна...</p>
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="mt-3 text-center text-xs text-destructive">{error}</p>
              )}

              {/* Check button */}
              <div className="mt-4 space-y-2">
                <Button
                  className="w-full gap-2"
                  variant="outline"
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
                  Төлбөр хийсний дараа автоматаар шалгана
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
