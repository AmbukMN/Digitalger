'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Building2,
  Check,
  Copy,
  ImagePlus,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatPrice } from '@besttv/shared';
import { api, getAccessToken } from '@/lib/api';
import type { BankAccount, BankInfo } from '@/lib/queries';

/**
 * ДАНСААР ШИЛЖҮҮЛЭХ МОДАЛ.
 *
 * ⚠️⚠️ ГҮЙЛГЭЭНИЙ УТГА нь хамгийн чухал зүйл. Хэрэглэгч түүнийг
 * бичихгүй бол админ банкны хуулгаас хэний мөнгө болохыг таних
 * БОЛОМЖГҮЙ — төлбөр «алга болно», гомдол болно.
 *
 * ⚠️ 6 ОРОНТОЙ ТОО (өмнө «BTV-MPQD» байсан) — банкны апп утсан дээр,
 * тоон гараар шууд бичигдэнэ, үсэг андуурагдахгүй.
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
  info: BankInfo;
  /** Багц авах бол */
  planId?: string;
  /** Хэтэвч цэнэглэх бол */
  topupAmount?: number;
  couponCode?: string;
  /** Харуулах нэр — «Монгол кино багц» */
  label: string;
  onClaimed?: () => void;
}

/** Хуулах товч — амжилттай болоход 2 секунд ✓ */
function CopyRow({
  label,
  value,
  mono,
  emphasis,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ⚠️ `navigator.clipboard` нь HTTPS-гүй үед болон хуучин
         iOS/FB webview-д БАЙХГҮЙ. Гараар хуулж болно. */
      toast.info('Гараар хуулна уу');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-foreground/40">{label}</p>
        <p
          className={cn(
            'truncate font-semibold text-foreground/90',
            mono && 'font-mono tabular-nums',
            emphasis ? 'text-lg' : 'text-sm',
          )}
        >
          {value}
        </p>
      </div>
      <button
        onClick={() => void copy()}
        aria-label={`${label} хуулах`}
        className={cn(
          'shrink-0 rounded-lg p-2 transition-colors',
          copied
            ? 'bg-success/20 text-success'
            : 'bg-foreground/8 text-foreground/60 hover:bg-foreground/15 hover:text-foreground',
        )}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}

export function BankTransferModal({
  open,
  onClose,
  info,
  planId,
  topupAmount,
  couponCode,
  label,
  onClaimed,
}: Props) {
  const [order, setOrder] = useState<BankOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);

  /* ⚠️ Анхдагч данс — эхний идэвхтэй (backend ч ижил логиктой) */
  const [accountId, setAccountId] = useState<string>(info.accounts[0]?.id ?? '');
  const account: BankAccount | undefined =
    info.accounts.find((a) => a.id === accountId) ?? info.accounts[0];

  /* ─── Баримт ─── */
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  /**
   * ⚠️⚠️ БАРИМТГҮЙ БОЛ БАТАЛГААЖУУЛАЛТ ЗААВАЛ.
   *
   * Зарим хэрэглэгч банкны апп-аас screenshot авч чаддаггүй (ATM,
   * теллэр, өөр хүнээр гүйлгүүлсэн). Тэднийг хаахгүйн тулд
   * «Би шилжүүлсэн» гэсэн ЗӨВШӨӨРӨЛ өгнө — гэхдээ санамсаргүй
   * дарахаас сэргийлж ЯГ энэ нүдийг тэмдэглэх шаардлагатай.
   */
  const [confirmed, setConfirmed] = useState(false);

  /**
   * ⚠️ Модал НЭЭГДЭХЭД л захиалга үүсгэнэ — компонент mount болмогц
   * үүсгэвэл хэрэглэгч модал нээгээгүй атал DB-д хоосон PENDING
   * мөр үүснэ.
   */
  useEffect(() => {
    if (!open || order || !account) return;
    let cancelled = false;

    setLoading(true);
    api<BankOrder>('/bank/initiate', {
      method: 'POST',
      body: JSON.stringify({ planId, topupAmount, couponCode, bankAccountId: account.id }),
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
  }, [open, order, planId, topupAmount, couponCode, account, onClose]);

  /* ⚠️ Esc товчоор хаах — бүх модалд байх ёстой (UX дүрэм) */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !account) return null;

  /**
   * Данс солих — шинэ захиалга үүсгэхгүй, зөвхөн backend-д мэдэгдэнэ.
   * ⚠️ Гүйлгээний утга ХЭВЭЭР үлдэнэ (шинэ утга өгвөл хэрэглэгч
   * хуучныг нь бичээд төлбөр танигдахгүй болно).
   */
  const switchAccount = async (id: string) => {
    setAccountId(id);
    if (!order) return;
    await api('/bank/initiate', {
      method: 'POST',
      body: JSON.stringify({ planId, topupAmount, couponCode, bankAccountId: id }),
    }).catch(() => null);
  };

  const pickReceipt = async (file: File) => {
    if (!order) return;
    setUploading(true);
    try {
      /**
       * ⚠️ `FormData` + fetch — `api()` нь JSON-д зориулсан тул
       * файл илгээхэд Content-Type-ыг гараар тавихгүй байх ёстой
       * (browser нь boundary-тай хамт өөрөө тавина).
       */
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/bank/${order.paymentId}/receipt`, {
        method: 'POST',
        headers: { authorization: `Bearer ${getAccessToken() ?? ''}` },
        body: form,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message ?? 'Хуулж чадсангүй');
      }
      const data = (await res.json()) as { url: string };
      setReceiptUrl(data.url);
      toast.success('Баримт хавсаргалаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Зураг хуулж чадсангүй');
    } finally {
      setUploading(false);
    }
  };

  const claim = async () => {
    if (!order) return;
    /**
     * ⚠️⚠️ БАРИМТ ЭСВЭЛ БАТАЛГААЖУУЛАЛТ — аль нэг нь ЗААВАЛ.
     *
     * Өмнө нь товч шууд ажилладаг тул хэрэглэгч санамсаргүй дараад
     * «мэдэгдсэн» төлөвт орж, дараа нь өөрчлөх боломжгүй болдог байв.
     */
    if (!receiptUrl && !confirmed) {
      toast.error(
        info.requireReceipt
          ? 'Төлбөрийн баримтын зургаа хавсаргана уу'
          : 'Баримтаа хавсаргах эсвэл «Би шилжүүлсэн» гэдгийг тэмдэглэнэ үү',
      );
      return;
    }
    /* ⚠️ Админ «баримт заавал» гэж тохируулсан бол checkbox хангалтгүй */
    if (info.requireReceipt && !receiptUrl) {
      toast.error('Төлбөрийн баримтын зургаа хавсаргана уу');
      return;
    }

    setClaiming(true);
    try {
      await api(`/bank/${order.paymentId}/claim`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
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
              Шилжүүлгийг шалгаад эрхийг тань нээнэ. Баталгаажмагц мэдэгдэл ирж, профайл
              хуудсанд харагдана.
            </p>
            <div className="mt-4 rounded-xl bg-foreground/5 px-4 py-3 text-left">
              <p className="text-[10px] uppercase tracking-wide text-foreground/40">
                Гүйлгээний утга
              </p>
              <p className="font-mono text-lg font-bold tabular-nums text-foreground/90">
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
              <CopyRow label="Гүйлгээний утга" value={order.reference} mono emphasis />
              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-primary">
                Энэ 6 оронтой тоог ЗААВАЛ гүйлгээний утгад бичнэ үү. Үгүй бол төлбөр тань
                танигдахгүй.
              </p>
            </div>

            {/*
              ⚠️ ОЛОН ДАНС — хэрэглэгч ӨӨРИЙН банкийг сонговол
              шимтгэлгүй, шуурхай шилжинэ. Нэг данс байвал сонголт
              харуулахгүй (дэмий алхам).
            */}
            {info.accounts.length > 1 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] font-semibold text-foreground/50">
                  Өөрийн банкаа сонговол шимтгэлгүй шилжинэ
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {info.accounts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => void switchAccount(a.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                        a.id === account.id
                          ? 'border-primary bg-primary/12 text-foreground'
                          : 'border-foreground/12 text-foreground/55 hover:border-foreground/30',
                      )}
                    >
                      {/* ⚠️ Лого нь текстээс хурдан танигдана */}
                      {a.logoUrl && (
                        <Image
                          src={a.logoUrl}
                          alt=""
                          width={16}
                          height={16}
                          className="size-4 rounded object-contain"
                        />
                      )}
                      {a.bankName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 space-y-3 rounded-xl bg-foreground/5 p-3.5">
              <div className="flex items-center gap-2.5">
                {account.logoUrl ? (
                  <Image
                    src={account.logoUrl}
                    alt={account.bankName}
                    width={32}
                    height={32}
                    className="size-8 shrink-0 rounded-lg bg-white/90 object-contain p-0.5"
                  />
                ) : (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/10 text-foreground/50">
                    <Building2 size={15} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {account.bankName}
                  </p>
                </div>
              </div>

              <div className="h-px bg-foreground/8" />
              <CopyRow label="Дансны дугаар" value={account.accountNumber} mono emphasis />

              {/*
                ⚠️ ХҮЛЭЭН АВАГЧ нь ТУСДАА мөр, бусадтай ижил хэмжээтэй.
                Өмнө нь толгойд 11px-ээр бүдэг бичигдэж, хэрэглэгч
                банкны апп-д нэрээ бичихэд уншиж чаддаггүй байв
                (хэрэглэгчийн скриншот).
              */}
              <div className="h-px bg-foreground/8" />
              <CopyRow label="Хүлээн авагч" value={account.accountName} />

              {/*
                ⚠️ IBAN нь ТУСДАА мөр — өмнө нь дансны дугаартай нэг
                мөрөнд нийлж «MN16000500 5020959308» гэж харагдаж,
                хэрэглэгч алийг нь хуулахаа мэдэхгүй байв.
              */}
              {account.iban && (
                <>
                  <div className="h-px bg-foreground/8" />
                  <CopyRow label="IBAN (заавал биш)" value={account.iban} mono />
                </>
              )}

              <div className="h-px bg-foreground/8" />
              <CopyRow label="Шилжүүлэх дүн" value={String(order.amount)} mono emphasis />
            </div>

            {/* ─── Төлбөрийн баримт ─── */}
            <div className="mt-3 rounded-xl border border-dashed border-foreground/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-foreground/80">
                    Төлбөрийн баримт
                    {info.requireReceipt && <span className="ml-1 text-primary">*</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-foreground/45">
                    Банкны аппын зургаа хавсаргавал хурдан баталгаажна
                  </p>
                </div>
                {!receiptUrl && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground/8 px-3 py-2 text-xs font-semibold text-foreground/75 transition-colors hover:bg-foreground/15 disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <ImagePlus size={13} />
                    )}
                    Зураг сонгох
                  </button>
                )}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void pickReceipt(f);
                  e.target.value = '';
                }}
              />

              {/* ⚠️ PREVIEW — хэрэглэгч зөв зураг оруулсан эсэхээ харна */}
              {receiptUrl && (
                <div className="relative mt-2.5 overflow-hidden rounded-lg border border-foreground/10">
                  <Image
                    src={receiptUrl}
                    alt="Төлбөрийн баримт"
                    width={400}
                    height={260}
                    className="max-h-40 w-full object-contain bg-black/20"
                  />
                  <button
                    onClick={() => setReceiptUrl(null)}
                    aria-label="Зураг хасах"
                    className="absolute right-1.5 top-1.5 rounded-lg bg-black/70 p-1.5 text-white/80 transition-colors hover:bg-destructive hover:text-white"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>

            {/*
              ⚠️⚠️ БАРИМТГҮЙ ХЭРЭГЛЭГЧИД ЗОРИУЛСАН ЗАМ.
              ATM, теллэр, өөр хүнээр гүйлгүүлсэн бол screenshot
              байхгүй. Тэднийг хаахгүй, гэхдээ санамсаргүй дарахаас
              сэргийлж ЯГ энэ нүдийг тэмдэглүүлнэ.
              ⚠️ Баримт хавсаргасан бол ХЭРЭГГҮЙ (давхар алхам).
            */}
            {!receiptUrl && !info.requireReceipt && (
              <button
                onClick={() => setConfirmed((c) => !c)}
                className="mt-3 flex w-full items-start gap-2.5 rounded-xl border border-foreground/12 p-3 text-left transition-colors hover:border-foreground/25"
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                    confirmed
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-foreground/25',
                  )}
                >
                  {confirmed && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-foreground/85">
                    Би төлбөрөө шилжүүлсэн
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-foreground/45">
                    Баримт байхгүй бол энийг тэмдэглэнэ үү. Шаардлагатай бол админ
                    чатаар холбогдоно.
                  </span>
                </span>
              </button>
            )}

            {info.note && (
              <p className="mt-3 text-xs leading-relaxed text-foreground/45">{info.note}</p>
            )}

            <div className="mt-4 rounded-xl bg-foreground/5 px-4 py-3 text-center">
              <p className="text-xs text-foreground/50">Шилжүүлэх дүн</p>
              <p className="text-2xl font-black tabular-nums text-foreground">
                {formatPrice(order.amount)}
              </p>
            </div>

            {/*
              ⚠️ Баримт ЭСВЭЛ баталгаажуулалтгүй бол товч ИДЭВХГҮЙ —
              дарж болохгүй гэдгийг ХАРАГДАЦААР хэлнэ (дарсны дараа
              алдаа гаргахаас дээр).
            */}
            <button
              onClick={() => void claim()}
              disabled={claiming || uploading || (!receiptUrl && !confirmed)}
              className={cn(
                'mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-bold transition-all',
                !receiptUrl && !confirmed
                  ? 'cursor-not-allowed bg-foreground/10 text-foreground/35'
                  : 'bg-primary text-primary-foreground hover:brightness-110',
                (claiming || uploading) && 'opacity-60',
              )}
            >
              {claiming ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
              Шилжүүлсэн
            </button>
            <p className="mt-2 text-center text-[11px] text-foreground/35">
              {!receiptUrl && !confirmed
                ? 'Баримтаа хавсаргах эсвэл дээрх нүдийг тэмдэглэнэ үү'
                : 'Шилжүүлсний ДАРАА энэ товчийг дарна уу'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
