'use client';

import { useEffect, useState } from 'react';
import { Button } from '@digitalger/shared/ui';
import { ArrowRight, Check, Copy, ExternalLink, MoreHorizontal, ShieldCheck, X } from 'lucide-react';
import { inAppBrowserName, isIOS } from '@/lib/download-helper';
import { buildTransferUrl, switchToSystemBrowser } from '@/lib/browser-switch';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Шилжих зам (жиш: '/checkout', '/cart'). State хадгалагдаж дамжина. */
  targetPath: string;
}

// ─── Системийн браузар руу шилжих modal ────────────────────────────────────
// FB/IG доторх браузар нь файл татаж чаддаггүй + тусдаа орчинтой тул худалдан
// авах/нэвтрэхийн өмнө Safari/Chrome руу шилжүүлнэ. Сагс/wishlist/coupon бүгд
// автоматаар дамжина — хэрэглэгч дахин сагслах шаардлагагүй.
export function BrowserSwitchModal({ open, onClose, targetPath }: Props) {
  const browser = inAppBrowserName() ?? 'Энэ апп';
  const ios = isIOS();
  const [copied, setCopied] = useState(false);
  const [transferUrl, setTransferUrl] = useState('');
  const [switching, setSwitching] = useState(false);

  // Modal нээгдэхэд transfer URL-ийг урьдчилан бэлдэнэ (хуулах товчид бэлэн байх)
  useEffect(() => {
    if (!open) return;
    let active = true;
    buildTransferUrl(targetPath)
      .then((url) => { if (active) setTransferUrl(url); })
      .catch(() => {});
    return () => { active = false; };
  }, [open, targetPath]);

  if (!open) return null;

  const handleSwitch = async () => {
    setSwitching(true);
    try {
      const url = await switchToSystemBrowser(targetPath);
      setTransferUrl(url);
    } finally {
      setSwitching(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(transferUrl || (await buildTransferUrl(targetPath)));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard амжилтгүй */
    }
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Толгой */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ExternalLink className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">Үргэлжлүүлэхийн тулд браузараар нээнэ үү</h3>
              <p className="text-xs text-muted-foreground">{browser} доторх цонхонд төлбөр/татах боломжгүй</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* State дамжих баталгаа — хэрэглэгчийг тайвшруулна */}
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 dark:bg-emerald-950/30">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-300">
            Таны <span className="font-semibold">сагс, хадгалсан, купон</span> бүгд хадгалагдаж дамжина —
            дахин нэмэх шаардлагагүй.
          </p>
        </div>

        {/* ГОЛ ТОВЧ: системийн браузар руу шилжих */}
        <Button
          className="mb-3 h-12 w-full gap-2 text-base font-bold"
          disabled={switching}
          onClick={handleSwitch}
        >
          {switching ? 'Бэлдэж байна...' : (
            <>
              {ios ? 'Safari-д нээх' : 'Chrome-д нээх'}
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </Button>

        {/* FALLBACK: дээрх товч ажиллахгүй бол гар аргаар */}
        <div className="rounded-xl bg-muted/40 p-4">
          <p className="mb-2.5 text-xs font-medium text-muted-foreground">
            Хэрэв нээгдэхгүй бол:
          </p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
              <p className="text-sm leading-relaxed">
                Доорх товчоор линкээ хуулна
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span>
              <p className="text-sm leading-relaxed">
                Баруун дээд{' '}
                <span className="inline-flex items-center justify-center rounded-md border border-border bg-background px-1.5 py-0.5 align-middle">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </span>{' '}
                → <span className="font-semibold">{ios ? '«Safari-д нээх»' : '«Браузараар нээх»'}</span> → линкээ буулгана
              </p>
            </div>
          </div>
          <Button variant="outline" className="mt-3 w-full gap-2" onClick={copyLink}>
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Линк хуулагдлаа!' : 'Линк хуулах'}
          </Button>
        </div>
      </div>
    </div>
  );
}
