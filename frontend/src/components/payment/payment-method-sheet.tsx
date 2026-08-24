'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Loader2, X } from 'lucide-react';
import { cn, formatPrice } from '@digitalger/shared';
import { paymentsApi } from '@/lib/api';
import {
  AmexMark,
  ApplePayMark,
  BRAND_CHIP,
  CardGenericMark,
  GooglePayMark,
  MastercardMark,
  QPayBankStrip,
  QPayMark,
  TCardMark,
  UnionPayMark,
  VisaMark,
  WeChatPayMark,
} from './brand-marks';

/**
 * ТӨЛБӨРИЙН АРГЫН ЦОНХ — accordion (Temu маягийн).
 *
 * ⚠️⚠️ ЯАГААД: QPay + Данс + Карт + Apple Pay + Google Pay + WeChat гэсэн
 * олон арга нэг товчинд багтахгүй. Тиймээс НЭГ «Худалдан авах» товч →
 * энэ цонх → арга бүр өөрийн мөр.
 *
 * ⚠️⚠️ QPay ЭХЛЭЭД СОНГОГДСОН — цонх нээгдэнгүүт задарсан (хамгийн түгээмэл).
 * Бусад арга дарвал ДОР НЬ задарна.
 *
 * ⚠️⚠️ «Bonum» нэр ХЭРЭГЛЭГЧИД ХЭЗЭЭ Ч ХАРАГДАХГҮЙ — зүгээр «Карт»,
 * «Apple Pay». Арын зуучлагч нуугдана.
 *
 * ⚠️ DigitalGer — нэг удаагийн худалдан авалт (subscription/хэтэвч БАЙХГҮЙ)
 * тул авто сунгалт/хэтэвч мөр ОГТ байхгүй (BestTV-ээс ялгаатай).
 */

export type PayMethod = 'qpay' | 'card' | 'applepay' | 'googlepay' | 'wechat' | 'bank';

export interface PaymentSheetProps {
  open: boolean;
  onClose: () => void;
  /** Төлөх дүн (харуулахад) */
  amount: number;
  /** Гарчиг доорх мөр — бүтээгдэхүүний нэр г.м */
  subtitle?: string;
  /** Дансаар шилжүүлэх идэвхтэй эсэх (админ тохиргоо) */
  bankEnabled?: boolean;
  /** Карт/Apple/Google/WeChat боломжтой эсэх (Bonum тохируулаагүй бол false) */
  cardEnabled?: boolean;
  /**
   * Арга сонгогдоод «Төлөх» дарахад. QPay бол дуудагч тал QR цонхоо
   * нээнэ; card/applepay/googlepay/wechat бол redirect; bank бол данс modal.
   */
  onSelect: (method: PayMethod) => void | Promise<void>;
  /** Гадна талын ачаалал (invoice үүсгэж байх зуур) */
  busy?: boolean;
}

/** ⚠️ Дэвсгэр/хүрээ нь `BRAND_CHIP`-ээс ирнэ (лого бүр өөр шаардлагатай) */
const CHIP = 'flex h-7 items-center justify-center rounded px-1.5';

export function PaymentMethodSheet({
  open,
  onClose,
  amount,
  subtitle,
  bankEnabled = false,
  cardEnabled = true,
  onSelect,
  busy = false,
}: PaymentSheetProps) {
  /* ⚠️ QPay DEFAULT — нээгдэнгүүт задарсан байна */
  const [selected, setSelected] = useState<PayMethod>('qpay');

  /* ⚠️ Esc-ээр хаах — бүх модалд байх ёстой (төслийн UX дүрэм) */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* Цонх хаагдахад сонголтыг QPay руу сэргээнэ (дараагийн удаад цэвэр) */
  useEffect(() => {
    if (!open) setSelected('qpay');
  }, [open]);

  if (!open) return null;

  const rows: {
    id: PayMethod;
    title: string;
    hint?: string;
    mark: React.ReactNode;
    /** Мөрний нэр доорх нэмэлт лого эгнээ (Temu маягаар) */
    extra?: React.ReactNode;
    show: boolean;
  }[] = [
    {
      id: 'qpay',
      title: 'QPay',
      mark: <QPayMark className="size-7 rounded-md object-contain" />,
      extra: <QPayBankStrip />,
      show: true,
    },
    {
      id: 'card',
      title: 'Карт',
      /* ⚠️ ЦАГААН chip дотор тул `text-neutral-700` тогтмол (dark theme-д
         цайрахгүй) */
      mark: <CardGenericMark className="h-4 w-6 text-neutral-700" />,
      /* Хүлээж авах БҮХ картын брэнд — хэрэглэгч «миний карт болох уу» мэднэ.
         Лого бүр өөр харьцаатай тул `h-* w-auto` (сунгаж гажуудуулахгүй). */
      extra: (
        <span className="flex flex-wrap items-center gap-1">
          <span className={cn(CHIP, BRAND_CHIP.visa)}>
            <VisaMark className="h-3 w-auto" />
          </span>
          <span className={cn(CHIP, BRAND_CHIP.mastercard)}>
            <MastercardMark className="h-4 w-auto" />
          </span>
          <span className={cn(CHIP, BRAND_CHIP.unionpay)}>
            <UnionPayMark className="h-4 w-auto" />
          </span>
          <span className={cn(CHIP, BRAND_CHIP.amex, 'px-0')}>
            <AmexMark className="h-7 w-auto rounded-[3px]" />
          </span>
          <span className={cn(CHIP, BRAND_CHIP.tcard)}>
            <TCardMark className="h-4 w-auto" />
          </span>
        </span>
      ),
      show: cardEnabled,
    },
    {
      id: 'applepay',
      title: 'Apple Pay',
      mark: <ApplePayMark className="h-4 w-auto" />,
      show: cardEnabled,
    },
    {
      id: 'googlepay',
      title: 'Google Pay',
      mark: <GooglePayMark className="h-4 w-auto" />,
      show: cardEnabled,
    },
    {
      id: 'wechat',
      title: 'WeChat Pay',
      hint: 'Гадаад зочдод',
      mark: <WeChatPayMark className="size-7 rounded-md object-contain" />,
      show: cardEnabled,
    },
    {
      id: 'bank',
      title: 'Дансаар шилжүүлэх',
      hint: 'Баримт хавсаргана',
      mark: <Building2 size={17} className="text-foreground/70" />,
      show: bankEnabled,
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        key="pay-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
      />
      {/* ⚠️ MOBILE-FIRST: утсан дээр ДООРООС гарах bottom-sheet, десктопт голд */}
      <motion.div
        key="pay-sheet"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Төлбөр төлөх"
        className="fixed inset-x-0 bottom-0 z-[100] flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl border border-border bg-card sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <p className="text-sm font-bold leading-tight text-foreground">Төлбөр төлөх</p>
            {subtitle && <p className="text-[11px] leading-tight text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Хаах"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="mb-4 flex items-baseline justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
            <span className="text-sm text-muted-foreground">Төлөх дүн</span>
            <span className="text-xl font-black text-foreground">{formatPrice(amount)}</span>
          </div>

          <div className="space-y-2">
            {rows
              .filter((r) => r.show)
              .map((r) => {
                const isSel = selected === r.id;
                return (
                  <div
                    key={r.id}
                    className={cn(
                      'overflow-hidden rounded-xl border transition-colors',
                      isSel
                        ? 'border-primary/45 bg-primary/8'
                        : 'border-border hover:border-foreground/25',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(r.id)}
                      /* ⚠️ min-h-14 — хүрэх талбар (мобайл, WCAG) */
                      className="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left"
                    >
                      <span
                        className={cn(
                          'flex size-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          isSel ? 'border-primary' : 'border-foreground/25',
                        )}
                      >
                        {isSel && <span className="size-2 rounded-full bg-primary" />}
                      </span>
                      {/* Брэндийн лого — цагаан/хар chip дотор (өнгө уншигдана) */}
                      <span
                        className={cn(
                          'flex h-8 w-11 shrink-0 items-center justify-center rounded-md',
                          r.id === 'applepay'
                            ? 'bg-black ring-1 ring-white/15'
                            : r.id === 'bank'
                              ? 'bg-muted'
                              : r.id === 'wechat'
                                ? 'bg-transparent'
                                : 'bg-white ring-1 ring-black/10',
                        )}
                      >
                        {r.mark}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {r.title}
                        </span>
                        {r.hint && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {r.hint}
                          </span>
                        )}
                        {r.extra && <span className="mt-1 block">{r.extra}</span>}
                      </span>
                    </button>

                    {/* ─── ЗАДАРСАН ХЭСЭГ ─── */}
                    {isSel && (
                      <div className="border-t border-dashed border-primary/25 px-3.5 pb-3.5 pt-3">
                        {r.id === 'qpay' && (
                          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                            «Төлөх» дарахад QR код гарна. Банкны аппаараа уншуулна.
                            Төлмөгц <b className="text-foreground/75">эрх автоматаар нээгдэнэ</b>.
                          </p>
                        )}
                        {(r.id === 'card' || r.id === 'applepay' || r.id === 'googlepay') && (
                          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                            Төлбөрийн аюулгүй хуудас руу шилжинэ. Төлсний дараа эрх тань
                            автоматаар нээгдэнэ.
                          </p>
                        )}
                        {r.id === 'wechat' && (
                          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                            WeChat аппаараа төлөх хуудас руу шилжинэ.
                          </p>
                        )}
                        {r.id === 'bank' && (
                          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                            Дансны мэдээлэл харагдана. Шилжүүлээд баримтаа чатаар илгээнэ —
                            бид баталгаажуулаад эрхийг тань нээнэ.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-card p-4 sm:p-5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSelect(selected)}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
          >
            {busy && <Loader2 size={17} className="animate-spin" />}
            Төлөх
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Bonum (карт/Apple/Google/WeChat) боломжтой эсэхийг backend-ээс асууна.
 * ⚠️ Тохируулаагүй бол тэдгээр мөр ГАРАХГҮЙ (fail-closed UI).
 */
export function useCardPaymentEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    paymentsApi
      .getMethods()
      .then((r) => {
        if (!cancelled) setEnabled(!!r.card);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}
