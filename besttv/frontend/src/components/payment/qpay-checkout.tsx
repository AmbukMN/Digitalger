'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
import { formatPrice } from '@besttv/shared';
import { api } from '@/lib/api';

export interface QPayInvoice {
  paymentId: string;
  qrImage?: string;
  qrText?: string;
  urls?: { name: string; link: string; logo: string }[];
  amount?: number;
}

interface Props {
  invoice: QPayInvoice;
  /** Модалын гарчиг доорх тайлбар — "Багц", "Хэтэвч цэнэглэх", "Түрээс" гэх мэт */
  subtitle?: string;
  /** Төлбөр батлагдмагц (модал хаагдахаас өмнө) */
  onPaid: () => void | Promise<void>;
  onClose: () => void;
  /** Амжилтын дэлгэц дээрх текст */
  successText?: string;
}

const POLL_INTERVAL = 3000;

/**
 * QPay V2 банкны deeplink scheme.
 * ⚠️ QPay-ийн буцаадаг `link` нь заримдаа вэб хуудас руу заадаг тул утсан дээр
 * апп нээхгүй. Тиймээс банкны нэрээр scheme-ийг ГАРААР тааруулж deeplink
 * үүсгэнэ — эс бөгөөс мобайл хэрэглэгч QR-ыг скан хийх аргагүй гацна.
 */
const BANK_DEEPLINKS: Record<string, string> = {
  'Khan Bank': 'khanbank://q?qPay_QRcode=',
  'Golomt Bank': 'golomtbank://q?qPay_QRcode=',
  TDB: 'tdbbank://q?qPay_QRcode=',
  'Trade and Development Bank': 'tdbbank://q?qPay_QRcode=',
  'Xac Bank': 'xacbank://q?qPay_QRcode=',
  XacBank: 'xacbank://q?qPay_QRcode=',
  'State Bank': 'statebank://q?qPay_QRcode=',
  'Capitron Bank': 'capitronbank://q?qPay_QRcode=',
  'M Bank': 'mbank://q?qPay_QRcode=',
  'Most Money': 'mostmoney://q?qPay_QRcode=',
  'Ard App': 'ardapp://q?qPay_QRcode=',
  Ard: 'ardapp://q?qPay_QRcode=',
  'Bogd Bank': 'bogdbank://q?qPay_QRcode=',
  NIBank: 'nibank://q?qPay_QRcode=',
  'National Investment Bank': 'nibank://q?qPay_QRcode=',
  'Chinggis Khaan Bank': 'ckbank://q?qPay_QRcode=',
  'CK Bank': 'ckbank://q?qPay_QRcode=',
};

function getBankLink(name: string, link: string, qrText?: string): string {
  if (!qrText) return link;
  const scheme = BANK_DEEPLINKS[name];
  if (scheme) return `${scheme}${encodeURIComponent(qrText)}`;
  // Нэр таарахгүй бол хэсэгчилсэн тааралт хайна (QPay нэрийг өөрчилдөг)
  const upper = name.toUpperCase();
  for (const [key, val] of Object.entries(BANK_DEEPLINKS)) {
    if (upper.includes(key.toUpperCase()) || key.toUpperCase().includes(upper)) {
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
  return (
    <a
      href={getBankLink(name, link, qrText)}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-foreground/10 bg-foreground/5 p-2.5 transition-all hover:bg-foreground/10 active:scale-95"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        alt={name}
        className="h-10 w-10 rounded-lg bg-foreground/90 object-contain p-0.5"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      <span className="line-clamp-2 w-full text-center text-[9px] font-medium leading-tight text-foreground/60">
        {name}
      </span>
    </a>
  );
}

function StepsDesktop() {
  const steps = [
    'Банкны аппликейшнаа нээнэ',
    'QR код скан хийнэ',
    'Дүнг баталгаажуулаад нэг товшилтоор төлнө',
  ];
  return (
    <div className="hidden space-y-2 rounded-xl border border-foreground/8 bg-foreground/4 px-4 py-3 sm:block">
      <p className="mb-1 text-xs font-semibold text-foreground">3 алхамаар амархан төлнө</p>
      {steps.map((s, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {i + 1}
          </span>
          <span className="text-xs leading-relaxed text-foreground/75">{s}</span>
        </div>
      ))}
      <p className="mt-1 border-t border-foreground/8 pt-1 text-[10px] leading-relaxed text-foreground/40">
        Төлбөр баталгаажмагц үзэх эрх нэн даруй нээгдэнэ.
      </p>
    </div>
  );
}

function StepsMobile() {
  return (
    <div className="rounded-xl border border-primary/25 bg-foreground/5 px-4 py-3 sm:hidden">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          !
        </span>
        <div>
          <p className="text-sm font-semibold leading-snug text-foreground">
            Дээрх банкны товч дээр дараад төлбөрөө хийгээрэй.
          </p>
          <p className="pt-1 text-[10px] leading-relaxed text-foreground/45">
            Төлбөр баталгаажмагц үзэх эрх нэн даруй нээгдэнэ.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * QPay төлбөрийн модал — БҮХ төлбөрт (багц, хэтэвч цэнэглэлт, түрээс) нийтлэг.
 *
 * ⚠️ Мобайл дээр QR скан хийх боломжгүй тул банкны аппын deeplink товчнууд
 * ЗААВАЛ байна. QR ганцаараа хангалтгүй.
 */
export function QPayCheckout({ invoice, subtitle, onPaid, onClose, successText }: Props) {
  const [checking, setChecking] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
  };

  const check = async (silent = true) => {
    if (!silent) setChecking(true);
    setError(null);
    try {
      const res = await api<{ paid: boolean }>(`/payments/${invoice.paymentId}/check`);
      if (res.paid) {
        stop();
        setPaid(true);
        await onPaid();
      }
    } catch {
      if (!silent) setError('Шалгахад алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      if (!silent) setChecking(false);
    }
  };

  useEffect(() => {
    // ⚠️ try/catch check() дотор — сүлжээ тасрахад polling зогсож,
    // хэрэглэгч мөнхийн spinner дээр гацахаас сэргийлнэ
    pollRef.current = setInterval(() => void check(true), POLL_INTERVAL);
    timeoutRef.current = setTimeout(
      () => {
        stop();
        setExpired(true);
      },
      15 * 60 * 1000,
    );
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.paymentId]);

  // Esc-ээр хаана (төлөгдсөн үед хаахгүй — амжилтын дэлгэц харагдана)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !paid && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [paid, onClose]);

  const qrSrc = invoice.qrImage
    ? invoice.qrImage.startsWith('data:')
      ? invoice.qrImage
      : `data:image/png;base64,${invoice.qrImage}`
    : null;
  const banks = invoice.urls ?? [];

  return (
    <AnimatePresence>
      <motion.div
        key="qpay-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={paid ? undefined : onClose}
        className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm"
        aria-hidden
      />

      <motion.div
        key="qpay-modal"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="fixed left-1/2 top-1/2 z-100 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-[#141518] shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-foreground/8 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">
              Q
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-foreground">QPay-ээр төлбөр хийх</p>
              <p className="text-[10px] leading-tight text-foreground/45">
                {subtitle ?? 'Монголын бүх банкны аппаар нэн даруй төлнө'}
              </p>
            </div>
          </div>
          {!paid && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Хаах"
              className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {paid ? (
            <div className="flex flex-col items-center gap-3 px-5 py-10">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <CheckCircle2 className="h-16 w-16 text-success" />
              </motion.div>
              <p className="text-lg font-bold text-foreground">Төлбөр амжилттай</p>
              <p className="text-center text-sm text-foreground/55">
                {successText ?? 'Эрх нээгдэж байна…'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 p-5">
              {invoice.amount != null && (
                <div className="flex items-baseline justify-between rounded-xl border border-foreground/8 bg-foreground/4 px-4 py-3">
                  <span className="text-sm text-foreground/55">Төлөх дүн</span>
                  <span className="text-xl font-black text-foreground">{formatPrice(invoice.amount)}</span>
                </div>
              )}

              {/* QR — desktop ТОМ (скан), mobile ЖИЖИГ */}
              {qrSrc && !expired && (
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-xl border-2 border-primary/25 bg-white p-2 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrSrc}
                      alt="QPay QR код"
                      className="h-32 w-32 object-contain sm:h-48 sm:w-48"
                    />
                  </div>
                  <p className="flex items-center gap-1 text-[10px] text-foreground/40">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-premium" />
                    QR хүчинтэй хугацаа: 15 минут
                  </p>
                </div>
              )}

              {/* ⚠️ MOBILE — банкны апп (QR-ийн ДООР). Утсан дээр QR скан хийх
                   боломжгүй тул хэрэглэгч аппаа дарж төлнө. */}
              {banks.length > 0 && !expired && (
                <div className="sm:hidden">
                  <p className="mb-1 text-sm font-semibold text-foreground">Банкны аппаа сонгоно уу</p>
                  <p className="mb-2.5 text-[11px] text-foreground/45">
                    Аппаа дарвал шууд төлбөрийн хуудас нээгдэнэ
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {banks.map((u) => (
                      <BankAppButton
                        key={u.name}
                        name={u.name}
                        link={u.link}
                        logo={u.logo}
                        qrText={invoice.qrText}
                      />
                    ))}
                  </div>
                </div>
              )}

              {expired && (
                <div className="py-8 text-center">
                  <p className="text-sm text-foreground/60">QR-ийн хугацаа дууслаа</p>
                  <button
                    onClick={onClose}
                    className="mt-3 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
                  >
                    Хаах
                  </button>
                </div>
              )}

              {!qrSrc && banks.length === 0 && !expired && (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-foreground/55">Төлбөрийн мэдээлэл ачаалж байна…</p>
                </div>
              )}

              {error && (
                <p className="rounded-lg bg-destructive/15 px-3 py-2 text-center text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer — алхмууд + гар шалгах товч (үргэлж харагдана) */}
        {!paid && !expired && (
          <div className="shrink-0 space-y-3 border-t border-foreground/8 bg-[#141518] px-5 py-4">
            <StepsDesktop />
            <StepsMobile />

            <button
              onClick={() => void check(false)}
              disabled={checking}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-md transition-all hover:brightness-110 disabled:opacity-60"
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {checking ? 'Шалгаж байна…' : 'Төлбөр шалгах'}
            </button>
            <p className="text-center text-[10px] text-foreground/35">
              Төлбөр хийсний дараа автоматаар баталгаажна
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
