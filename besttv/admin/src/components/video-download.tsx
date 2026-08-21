'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { api } from '@/lib/api';

/**
 * АДМИН — БАЙРШУУЛСАН ВИДЕОГ ТАТАЖ АВАХ.
 *
 * ⚠️⚠️ ЯАГААД ЦЭС ГАРГАДАГ ВЭ: видео нь хөрвүүлэлтийн үед 1-3 түвшин
 * (1080p/720p/480p) үүсдэг. Эх файл 720p байсан бол 1080p ҮҮСДЭГГҮЙ
 * тул боломжит түвшнийг backend-ээс уншиж байж харуулна — хатуу
 * бичвэл байхгүй чанарыг санал болгож, татахад унана.
 *
 * ⚠️ Татах нь `-c copy` (remux) тул ДАХИН КОДЛОГДОХГҮЙ — чанар 100%
 * хэвээр, хурд нь R2-гийн татах хурдаар л хязгаарлагдана.
 */

interface Variant {
  index: number;
  label: string;
  width: number;
  height: number;
  /** Ойролцоо хэмжээ МБ-аар (мэдэгдэхгүй бол null) */
  approxMb: number | null;
}

export function VideoDownload({
  kind,
  id,
}: {
  kind: 'movie' | 'episode';
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [started, setStarted] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  /* ⚠️ Гадуур дарах / Esc — цэс хаана (админ панелийн стандарт) */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (variants) return;

    setLoading(true);
    try {
      const r = await api<{ name: string; variants: Variant[] }>(
        `/admin/video-download/${kind}/${id}/variants`,
      );
      setVariants(r.variants ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Чанарын жагсаалт авч чадсангүй');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * ⚠️⚠️ ТАСАЛБАРААР ТАТНА — токеныг URL-д ТАВИХГҮЙ.
   *
   * 1) header-тэйгээр 2 минутын нэг удаагийн тасалбар авна
   * 2) хөтчийг тэр тасалбартай URL руу шууд навигацилна
   *
   * ⚠️ `fetch`+`blob` ХЭРЭГЛЭХГҮЙ — файл хэдэн ГБ байж болно, бүгдийг
   * санах ойд хураавал хөтөч унана. Шууд навигаци нь хөтчийн ӨӨРИЙН
   * татагчийг ажиллуулах тул диск рүү урсгалаар бичигдэж, явцыг ч
   * хөтөч харуулна.
   */
  const download = async (v: Variant) => {
    setStarted(v.index);
    try {
      const r = await api<{ ticket: string }>(
        `/admin/video-download/${kind}/${id}/ticket`,
        { method: 'POST', body: JSON.stringify({ v: v.index }) },
      );
      window.location.href =
        `${process.env.NEXT_PUBLIC_API_URL}/admin/video-download/file?t=${encodeURIComponent(r.ticket)}`;
      toast.success(`${v.label} татаж эхэллээ — хөтчийн татах хэсгээс харна уу`);
      setTimeout(() => setOpen(false), 900);
    } catch (e) {
      setStarted(null);
      toast.error(e instanceof Error ? e.message : 'Татаж чадсангүй');
    }
  };

  return (
    <div ref={boxRef} className="relative mt-2">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Татаж авах
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 z-30 mb-1.5 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          {loading && (
            <p className="px-3 py-3 text-center text-xs text-muted-foreground">
              Чанарыг шалгаж байна…
            </p>
          )}

          {!loading && variants?.length === 0 && (
            <p className="px-3 py-3 text-center text-xs text-muted-foreground">
              Татах чанар олдсонгүй
            </p>
          )}

          {!loading &&
            variants?.map((v) => (
              <button
                key={v.index}
                type="button"
                onClick={() => download(v)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
              >
                <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{v.label}</span>
                  {v.width > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {v.width}×{v.height}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {v.approxMb != null && (
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      ~{v.approxMb >= 1024 ? `${(v.approxMb / 1024).toFixed(1)} ГБ` : `${v.approxMb} МБ`}
                    </span>
                  )}
                  {started === v.index && <Check size={13} className="text-success" />}
                </span>
              </button>
            ))}

          <p className={cn('border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground')}>
            MP4 · дахин кодлохгүй тул чанар хэвээр
          </p>
        </div>
      )}
    </div>
  );
}
