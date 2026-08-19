'use client';

/**
 * ХАДМАЛЫН ТОВЧ + ЦЭС.
 *
 * ⚠️⚠️ ЯАГААД ӨӨРСДӨӨ БАРЬСАН БЭ: Vidstack-ийн анхдагч CC товч нь
 * дарахад хадмалыг ЗҮГЭЭР Л АСААДАГ/УНТРААДАГ. Хэл сонгох, хэмжээ
 * тохируулах нь «Тохиргоо → Хадмал → …» гэсэн 3 давхар цэсний ард
 * нуугдана. Хэрэглэгч монгол хадмал руу шилжихийн тулд хэдэн ч
 * товшилт хийж, «баахан юм руу орж» байна гэж гомдоллосон.
 *
 * Энэ товч нь НЭГ дарахад бүх хэл + хэмжээ + байрлалыг НЭГ дэлгэцэд
 * харуулна. Netflix, YouTube-ийн гар утасны загвартай ойролцоо.
 *
 * ⚠️ Хадмалгүй видеонд ОГТ РЕНДЕРЛЭГДЭХГҮЙ (`null` буцаана) — товч
 * байгаа нь өөрөө «хадмал бий» гэсэн худал дохио өгнө.
 */

import { useEffect, useRef, useState } from 'react';
import { Check, Subtitles, X } from 'lucide-react';
import { cn } from '@besttv/shared';

export interface SubtitleOption {
  lang: string;
  label: string;
}

/** Хадмалын хэмжээ — `globals.css`-ийн `--vds-cue-scale` хувьсагчид */
const SIZES = [
  { id: 'sm', label: 'Жижиг', scale: 0.85 },
  { id: 'md', label: 'Дунд', scale: 1 },
  { id: 'lg', label: 'Том', scale: 1.25 },
  { id: 'xl', label: 'Маш том', scale: 1.5 },
] as const;

type SizeId = (typeof SIZES)[number]['id'];

const STORAGE_SIZE = 'besttv:cue-size';
const STORAGE_BG = 'besttv:cue-bg';

export function SubtitleMenu({
  tracks,
  activeLang,
  onSelect,
}: {
  tracks: SubtitleOption[];
  /** `null` = унтраасан */
  activeLang: string | null;
  onSelect: (lang: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<SizeId>('md');
  /** Хадмалын ард хар дэвсгэр — гэрэлтэй кадрт уншихад хэрэгтэй */
  const [bg, setBg] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  /* ⚠️ Тохиргоог САНАНА — хэрэглэгч анги бүрд дахин тохируулах ёсгүй */
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_SIZE) as SizeId | null;
      if (s && SIZES.some((x) => x.id === s)) setSize(s);
      const b = localStorage.getItem(STORAGE_BG);
      if (b != null) setBg(b === '1');
    } catch {
      /* ⚠️ Private mode-д localStorage шидэж болно — анхдагчаар үлдэнэ */
    }
  }, []);

  /* CSS хувьсагчид бичнэ — `globals.css` дахь `.vds-captions` уншина */
  useEffect(() => {
    const scale = SIZES.find((s) => s.id === size)?.scale ?? 1;
    document.documentElement.style.setProperty('--bt-cue-scale', String(scale));
    document.documentElement.style.setProperty('--bt-cue-bg', bg ? '0.75' : '0');
    try {
      localStorage.setItem(STORAGE_SIZE, size);
      localStorage.setItem(STORAGE_BG, bg ? '1' : '0');
    } catch {
      /* хадгалж чадаагүй ч UI ажиллана */
    }
  }, [size, bg]);

  /* ⚠️ Гадна дарах + Esc — цэс мөнхөд нээлттэй үлдэхээс сэргийлнэ */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  /* ⚠️ ХАДМАЛГҮЙ бол товч ОГТ гарахгүй */
  if (!tracks.length) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Хадмал"
        title="Хадмал"
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
          activeLang ? 'text-white' : 'text-white/55',
          'hover:bg-white/15',
        )}
      >
        <Subtitles size={20} />
        {/* ⚠️ Идэвхтэй хэлийг ТОВЧ ДЭЭР харуулна — нээхгүйгээр мэдэгдэнэ */}
        {activeLang && (
          <span className="absolute -bottom-0.5 text-[8px] font-bold uppercase leading-none">
            {activeLang}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute bottom-12 right-0 z-50 w-60 overflow-hidden rounded-xl border border-white/12 bg-[#151515]/97 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-bottom-2 duration-150"
          role="menu"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <p className="text-xs font-bold text-white">Хадмал</p>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white"
              aria-label="Хаах"
            >
              <X size={14} />
            </button>
          </div>

          {/* ── Хэл ── */}
          <div className="p-1.5">
            <Row
              label="Хаах"
              active={activeLang === null}
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
            />
            {tracks.map((t) => (
              <Row
                key={t.lang}
                label={t.label}
                active={activeLang === t.lang}
                onClick={() => {
                  onSelect(t.lang);
                  setOpen(false);
                }}
              />
            ))}
          </div>

          {/* ── Хэмжээ (зөвхөн асаалттай үед утгатай) ── */}
          {activeLang && (
            <div className="border-t border-white/10 p-1.5">
              <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                Үсгийн хэмжээ
              </p>
              <div className="grid grid-cols-4 gap-1 px-1">
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSize(s.id)}
                    className={cn(
                      'rounded-md py-1.5 text-[11px] font-medium transition-colors',
                      size === s.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white/8 text-white/65 hover:bg-white/14',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <label className="mt-1.5 flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs text-white/75 hover:bg-white/8">
                Хар дэвсгэр
                <input
                  type="checkbox"
                  checked={bg}
                  onChange={(e) => setBg(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors',
        active ? 'bg-primary/20 text-white' : 'text-white/75 hover:bg-white/8',
      )}
    >
      {label}
      {active && <Check size={14} className="text-primary" />}
    </button>
  );
}
