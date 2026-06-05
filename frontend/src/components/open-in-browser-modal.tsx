'use client';

import { useState } from 'react';
import { Button } from '@digitalger/shared/ui';
import { Check, Copy, Download, ExternalLink, MoreHorizontal, X } from 'lucide-react';
import { inAppBrowserName, isIOS } from '@/lib/download-helper';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Хуулах/нээх линк (одоогийн хуудас эсвэл татах URL). */
  url: string;
  /** Татах "go" линк (байвал том "Татаж эхлүүлэх" товч харагдана). */
  goUrl?: string;
}

// ─── "Системийн браузераар нээх" заавар modal ──────────────────────────────
// FB/IG доторх браузер файл татахыг блоклодог. Энэ modal нь хэрэглэгчид
// Safari/Chrome дээр хэрхэн нээхийг ТОДОРХОЙ зааварчилна (toast биш — бүрэн,
// алга болохгүй). Линк хуулах товч + ··· цэсний заавар.
export function OpenInBrowserModal({ open, onClose, url, goUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const browser = inAppBrowserName() ?? 'Энэ апп';
  const ios = isIOS();
  // Хуулах линк — татах goUrl байвал түүнийг, эс бол хуудсын URL-ийг.
  const copyTarget = goUrl || url;

  if (!open) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(copyTarget);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard амжилтгүй — заавар хэвээр
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
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ExternalLink className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">Файл татах</h3>
              <p className="text-xs text-muted-foreground">{browser} доторх браузер татахыг хязгаарладаг</p>
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

        {/* ГОЛ АРГА: goUrl (proxy stream линк) байвал том "Татаж эхлүүлэх"
            жинхэнэ <a href> товч. Хэрэглэгч ӨӨРӨӨ дарах нь FB WebView-т хамгийн
            найдвартай navigate. target ӨГӨХГҮЙ — proxy нь Content-Disposition:
            attachment буцаадаг тул ижил цонхонд дарахад хуудас солигдохгүй, файл
            татагдана (target=_blank нь FB WebView-т шинэ таб блоклож унадаг). */}
        {goUrl && (
          <a
            href={goUrl}
            rel="noopener"
            onClick={() => setTimeout(onClose, 1500)}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-base font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Download className="h-5 w-5" />
            Татаж эхлүүлэх
          </a>
        )}

        {/* FALLBACK заавар: дээрх товч ажиллахгүй бол гадаад браузераар нээх */}
        <p className="mb-2 mt-1 text-xs font-medium text-muted-foreground">
          Хэрэв татагдахгүй бол:
        </p>
        <div className="space-y-3 rounded-xl bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
            <p className="text-sm leading-relaxed">
              Баруун дээд буланд байрлах{' '}
              <span className="inline-flex items-center justify-center rounded-md border border-border bg-background px-1.5 py-0.5 align-middle">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </span>{' '}
              цэсийг дарна
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span>
            <p className="text-sm leading-relaxed">
              <span className="font-semibold">
                {ios ? '«Safari-д нээх»' : '«Системийн браузераар нээх» (Chrome)'}
              </span>{' '}
              сонгоод дахин татна
            </p>
          </div>
        </div>

        {/* Линк хуулах (нэмэлт арга) */}
        <div className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground">Эсвэл татах линкийг хуулж браузерт буулгана уу:</p>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={copyLink}
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Хуулагдлаа!' : 'Линк хуулах'}
          </Button>
        </div>
      </div>
    </div>
  );
}
