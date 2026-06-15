'use client';

import { useEffect, useState } from 'react';
import { Button } from '@digitalger/shared/ui';
import { ArrowRight, Check, Copy, ExternalLink, MoreHorizontal, ShieldCheck, X } from 'lucide-react';
import { inAppBrowserName, isIOS } from '@/lib/download-helper';
import { buildTransferUrl, switchToSystemBrowser, copyLinkRobust } from '@/lib/browser-switch';

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
  // clipboard 3 түвшний fallback ч унавал линкийг дэлгэцэнд харуулна (гар сонголт).
  const [showRawLink, setShowRawLink] = useState(false);
  // iOS-д заавар (··· → Open external) АНХНААСАА биш, товч дарж scheme унасны
  // ДАРАА л тод гарна — ингэснээр scheme дэмждэг iPhone (шинэ iOS) дээр илүүц
  // UI харагдахгүй, зөвхөн шаардлагатай (iOS15) үед заавар тодорно.
  const [showGuide, setShowGuide] = useState(false);

  // Modal нээгдэхэд transfer URL (?t=token)-ийг урьдчилан бэлдэнэ.
  // ⚠️ ЧУХАЛ (session дамжуулах гол арга): FB-ийн "··· → Open in external browser"
  // нь FB webview-ийн ОДООГИЙН URL-ийг Safari-д нээдэг. Тиймээс энэ хуудасны
  // URL-ийг ?t=token-той болгож history.replaceState-ээр СОЛИНО — ингэснээр
  // хэрэглэгч "Open in external browser" дарахад Safari тэр ?t=token-той URL-ийг
  // нээж, нэвтэрсэн session/cart/coupon АВТОМАТААР дамжина (scheme-ээс хамаарахгүй).
  useEffect(() => {
    if (!open) return;
    let active = true;
    buildTransferUrl(targetPath)
      .then((url) => {
        if (!active) return;
        setTransferUrl(url);
        // FB webview-ийн одоогийн URL-д ?t=token-ийг шингээнэ (FB external browser
        // тэрийг нээнэ). Зөвхөн token гарч ирсэн бол (state хадгалагдсан) солино.
        try {
          const t = new URL(url).searchParams.get('t');
          if (t) {
            const cur = new URL(window.location.href);
            cur.searchParams.set('t', t);
            window.history.replaceState({}, '', cur.toString());
          }
        } catch { /* URL parse алдаа — алгасна */ }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [open, targetPath]);

  if (!open) return null;

  const handleSwitch = async () => {
    setSwitching(true);
    try {
      const url = await switchToSystemBrowser(targetPath);
      setTransferUrl(url);
      // iOS: scheme туршигдсан. scheme дэмждэг iOS (шинэ iPhone) дээр Safari нээгдэж энэ
      // хуудас орхигдоно (заавар гарахгүй). iOS15 (iPhone7) дээр scheme унаж
      // хуудас энд хэвээр → 1.5с дараа заавар тод гарна + линк хуулна.
      if (isIOS()) {
        setTimeout(async () => {
          setShowGuide(true);
          const ok = await copyLinkRobust(url);
          if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 4000);
          } else {
            setShowRawLink(true);
          }
          setSwitching(false);
        }, 1500);
        return;
      }
      // Android: intent ихэвчлэн нэг товшилтоор ажиллана. Хэрэв 2с-ийн дараа
      // хуудас энд хэвээр (intent блоклогдсон ховор тохиолдол) бол линк хуулж
      // өгнө (UI өөрчлөхгүй, зүгээр "хуулагдлаа" төлөв) — хэрэглэгч гацахгүй.
      setTimeout(async () => {
        const ok = await copyLinkRobust(url);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 4000);
        }
        setSwitching(false);
      }, 2000);
      return;
    } finally {
      setSwitching(false);
    }
  };

  const copyLink = async () => {
    const url = transferUrl || (await buildTransferUrl(targetPath));
    const ok = await copyLinkRobust(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      // clipboard 3 түвшин унасан — линкийг харуулж хэрэглэгч гараар сонгоно
      setShowRawLink(true);
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/70 text-primary">
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

        {/* iOS заавар — товч дарж scheme унасны ДАРАА л тод гарна (showGuide).
            scheme дэмждэг iPhone (шинэ iOS) дээр огт гарахгүй — илүүц UI байхгүй. */}
        {isIOS() && showGuide && (
          <div className="mb-3 rounded-xl border-2 border-primary/30 bg-muted/40 p-4">
            <p className="mb-2.5 text-sm font-bold text-foreground">
              📲 Safari-д нээж татна уу:
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
                  <span className="font-semibold">"Open in external browser"</span> сонгоно → нэвтрэлт хадгалагдан Safari нээгдэнэ
                </span>
              </p>
            </div>
          </div>
        )}

        {/* ГОЛ ТОВЧ: гадаад браузар руу шилжих (Android-д нэг товшилт, iOS-д нэмэлт) */}
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

        {/* FALLBACK заавар: Android-д "Нээгдэхгүй бол" (iOS-д дээр аль хэдийн гарсан
            тул давхардуулахгүй — зөвхөн линк хуулах товч үлдээнэ). */}
        <div className="rounded-xl bg-muted/40 p-4">
          {!isIOS() && (
            <>
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
            </>
          )}
          <Button variant="outline" className={`w-full gap-2${isIOS() ? '' : ' mt-3'}`} onClick={copyLink}>
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Хуулагдлаа!' : 'Линк хуулах'}
          </Button>

          {/* clipboard бүрэн унасан — линкийг гар аргаар сонгож хуулах боломж
              (хэрэглэгч линкгүй гацахаас сэргийлнэ). Урт дармал → автомат сонгогдоно. */}
          {showRawLink && transferUrl && (
            <div className="mt-2.5">
              <p className="mb-1 text-[11px] text-muted-foreground">
                Дарж сонгоод хуулна уу:
              </p>
              <input
                readOnly
                value={transferUrl}
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.currentTarget.select()}
                className="w-full select-all rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
