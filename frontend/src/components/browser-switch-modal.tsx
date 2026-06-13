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
// FB/IG доторх цонх нь нэвтрэх/төлбөр хийхийг хязгаарладаг тул худалдан
// авах/нэвтрэхийн өмнө гадаад браузар руу шилжүүлнэ.
//
// UI зарчим: "Safari/Chrome" нэр ашиглахгүй (хэрэглэгч мэдэхгүй) — "браузер"
// гэх ерөнхий үг. Заавар нь FB/IG-ийн ··· цэсэнд БОДИТООР байдаг "Open in
// external browser" сонголтыг зааж өгнө. Текст богино, ойлгомжтой.
export function BrowserSwitchModal({ open, onClose, targetPath }: Props) {
  const browser = inAppBrowserName() ?? 'Энэ'; // 'Facebook' | 'Instagram' | ...
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
      // iOS x-safari scheme нь олон тохиолдолд блоклогддог тул "товч ажиллаагүй"
      // мэт харагдана. Тиймээс iOS дээр зэрэг clipboard-д хуулж "хуулагдлаа"
      // төлөв харуулна — scheme ажиллахгүй бол хэрэглэгч шууд ··· → буулгана.
      if (isIOS()) {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 4000);
        } catch { /* clipboard амжилтгүй — заавар хэвээр */ }
      }
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
              <h3 className="text-base font-bold leading-tight">Файл татахын тулд браузерт нээнэ үү</h3>
              <p className="text-xs text-muted-foreground">{browser} цонхонд файл татах боломжгүй</p>
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

        {/* FB/IG доторх цонхонд файл татах боломжгүй (page-not-found) тул browser шилжинэ */}
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 dark:bg-amber-950/30">
          <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            {browser} доторх цонхонд <span className="font-semibold">файл татах боломжгүй</span> тул гадаад браузераар нээж татна уу. Нэвтрэлт, сагс, бусад бүх зүйл хадгалагдана.
          </p>
        </div>

        {/* ГОЛ ТОВЧ: гадаад браузар руу шилжих */}
        <Button
          className="mb-2 h-12 w-full gap-2 text-base font-bold"
          disabled={switching}
          onClick={handleSwitch}
        >
          {switching ? 'Нээж байна...' : (
            <>
              Браузерт нээх
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </Button>

        {/* iOS дээр scheme ажиллаагүй бол — линк хуулагдсан гэдгийг тод харуулна */}
        {copied && (
          <p className="mb-3 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            Линк хуулагдлаа — нээгдэхгүй бол доорх зааврыг үзнэ үү
          </p>
        )}
        {!copied && <div className="mb-2" />}

        {/* FALLBACK: дээрх товч ажиллахгүй бол — FB/IG-д БОДИТ заавар */}
        <div className="rounded-xl bg-muted/40 p-4">
          <p className="mb-2.5 text-xs font-medium text-muted-foreground">
            Нээгдэхгүй бол:
          </p>
          <div className="space-y-2">
            <p className="flex items-start gap-2 text-sm leading-relaxed">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
              <span>
                Баруун дээд{' '}
                <span className="inline-flex items-center justify-center rounded-md border border-border bg-background px-1.5 py-0.5 align-middle">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </span>{' '}
                товч дарна
              </span>
            </p>
            <p className="flex items-start gap-2 text-sm leading-relaxed">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span>
              <span>
                <span className="font-semibold">"Open in external browser"</span> сонгоно
              </span>
            </p>
          </div>
          <Button variant="outline" className="mt-3 w-full gap-2" onClick={copyLink}>
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Хуулагдлаа!' : 'Линк хуулах'}
          </Button>
        </div>
      </div>
    </div>
  );
}
