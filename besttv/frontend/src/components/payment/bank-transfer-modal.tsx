'use client';

import { useEffect, useState } from 'react';
import { Building2, Check, Copy, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatPrice } from '@besttv/shared';
import { api } from '@/lib/api';
import type { BankSettings } from '@/lib/queries';

/**
 * ДАНСААР ШИЛЖҮҮЛЭХ МОДАЛ.
 *
 * ⚠️⚠️ ГҮЙЛГЭЭНИЙ УТГА нь хамгийн чухал зүйл. Хэрэглэгч түүнийг
 * бичихгүй бол админ банкны хуулгаас хэний мөнгө болохыг таних
 * БОЛОМЖГҮЙ — төлбөр «алга болно», гомдол болно.
 *
 * Тиймээс: хамгийн том, хамгийн тод, хуулах товч нь эхэнд, доор нь
 * улаан анхааруулга.
 */

interface BankOrder {
  paymentId: string;
  reference: string;
  amount: number;
  claimed: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  settings: BankSettings;
  /** Багц авах бол */
  planId?: string;
  /** Хэтэвч цэнэглэх бол */
  topupAmount?: number;
  couponCode?: string;
  /** Харуулах нэр — «Монгол кино багц» */
  label: string;
  onClaimed?: () => void;
}

/** Хуулах товч — амжилттай болоход 2 секунд ✓ харуулна */
function CopyField({
  label,
  value,
  big,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /**
       * ⚠️ `navigator.clipboard` нь HTTPS-гүй үед болон хуучин
       * iOS/FB webview-д БАЙХГҮЙ. Хэрэглэгч гараар хуулж чадах тул
       * зөвхөн мэдэгдэнэ (алдаа биш).
       */
      toast.info('Гараар хуулна уу');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-foreground/40">{label}</p>
        <p
          className={cn(
            'truncate font-semibold text-foreground/90 tabular-nums',
            big ? 'text-lg' : 'text-sm',
          )}
        >
          {value}
        </p>
      </div>
      <button
        onClick={() => void copy()}
        aria-label={`${label} хуулах`}
        className={cn(
          'shrink-0 rounded-lg p-2.5 transition-colors',
          copied
            ? 'bg-success/20 text-success'
            : 'bg-foreground/8 text-foreground/60 hover:bg-foreground/15 hover:text-foreground',
        )}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  );
}

export function BankTransferModal({
  open,
  onClose,
  settings,
  planId,
  topupAmount,
  couponCode,
  label,
  onClaimed,
}: Props) {
  const [order, setOrder] = useState<BankOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);

  /**
   * ⚠️ Модал НЭЭГДЭХЭД л захиалга үүсгэнэ — компонент mount болмогц
   * үүсгэвэл хэрэглэгч модал нээгээгүй атал DB-д хоосон PENDING
   * мөр үүснэ.
   */
  useEffect(() => {
    if (!open || order) return;
    let cancelled = false;

    setLoading(true);
    api<BankOrder>('/bank/initiate', {
      method: 'POST',
      body: JSON.stringify({ planId, topupAmount, couponCode }),
    })
      .then((r) => {
        if (!cancelled) setOrder(r);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : 'Захиалга үүсгэж чадсангүй');
        onClose();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, order, planId, topupAmount, couponCode, onClose]);

  /* ⚠️ Esc товчоор хаах — бүх модалд байх ёстой (UX дүрэм) */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const claim = async () => {
    if (!order) return;
    setClaiming(true);
    try {
      await api(`/bank/${order.paymentId}/claim`, { method: 'POST' });
      toast.success('Хүлээн авлаа! Баталгаажмагц эрх нээгдэнэ.');
      setOrder({ ...order, claimed: true });
      onClaimed?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Дансаар шилжүүлэх"
    >
      {/*
        ⚠️ Мобайлд ДООД талаас (bottom sheet), десктопт голд — утсан дээр
        дэлгэцийн голд гарах модал нь эрхий хуруунд хүрэхэд хол байдаг.
      */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-in max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-foreground/10 bg-background p-5 sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Дансаар шилжүүлэх</h2>
              <p className="text-xs text-foreground/50">{label}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Хаах"
            className="shrink-0 rounded-lg p-1.5 text-foreground/40 transition-colors hover:bg-foreground/8 hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {loading || !order ? (
          <div className="mt-5 space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-foreground/6" />
            ))}
          </div>
        ) : order.claimed ? (
          /* ─── Мэдэгдсэний дараах төлөв ─── */
          <div className="mt-6 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
              <Check size={28} />
            </div>
            <p className="mt-3.5 font-semibold text-foreground">Хүлээн авлаа</p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/55">
              Шилжүүлгийг шалгаад эрхийг тань нээнэ. Баталгаажмагц имэйл болон
              профайл хуудсанд харагдана.
            </p>
            <div className="mt-4 rounded-xl bg-foreground/5 px-4 py-3 text-left">
              <p className="text-[11px] uppercase tracking-wide text-foreground/40">
                Гүйлгээний утга
              </p>
              <p className="font-mono text-base font-bold text-foreground/90">
                {order.reference}
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-foreground/8 py-3 font-semibold text-foreground/80 transition-colors hover:bg-foreground/12"
            >
              Хаах
            </button>
          </div>
        ) : (
          <>
            {/*
              ⚠️⚠️ ГҮЙЛГЭЭНИЙ УТГА нь ЭХЭНД, хамгийн тод. Хэрэглэгч
              доошоо гүйлгэхгүйгээр л хардаг байх ёстой — банкны апп
              руу шилжсэний дараа буцаж ирээд хайх нь бухимдал.
            */}
            <div className="mt-5 rounded-xl border-2 border-primary/40 bg-primary/8 p-3.5">
              <CopyField label="Гүйлгээний утга" value={order.reference} big />
              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-primary">
                Энэ кодыг ЗААВАЛ гүйлгээний утгад бичнэ үү. Үгүй бол төлбөр тань
                танигдахгүй.
              </p>
            </div>

            <div className="mt-3 space-y-3 rounded-xl bg-foreground/5 p-3.5">
              <CopyField label="Дансны дугаар" value={settings.accountNumber ?? ''} big />
              <div className="h-px bg-foreground/8" />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-foreground/40">Банк</p>
                <p className="text-sm font-semibold text-foreground/90">{settings.bankName}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-foreground/40">
                  Хүлээн авагч
                </p>
                <p className="text-sm font-semibold text-foreground/90">
                  {settings.accountName}
                </p>
              </div>
              <div className="h-px bg-foreground/8" />
              <CopyField label="Дүн" value={String(order.amount)} big />
            </div>

            {settings.note && (
              <p className="mt-3 text-xs leading-relaxed text-foreground/45">{settings.note}</p>
            )}

            <div className="mt-4 rounded-xl bg-foreground/5 px-4 py-3 text-center">
              <p className="text-xs text-foreground/50">Шилжүүлэх дүн</p>
              <p className="text-2xl font-black tabular-nums text-foreground">
                {formatPrice(order.amount)}
              </p>
            </div>

            <button
              onClick={() => void claim()}
              disabled={claiming}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60"
            >
              {claiming ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
              Шилжүүлсэн
            </button>
            <p className="mt-2 text-center text-[11px] text-foreground/35">
              Шилжүүлсний ДАРАА энэ товчийг дарна уу
            </p>
          </>
        )}
      </div>
    </div>
  );
}
