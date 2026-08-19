'use client';

/**
 * PLAYER-ИЙН НЭГДСЭН ЦЭС — хадмал, чанар, хурд.
 *
 * ⚠️⚠️ ЯАГААД ӨӨРСДӨӨ БАРЬСАН БЭ (хоёр бүтэлгүй оролдлогын дараа):
 *
 *   1-р оролдлого: Vidstack-ийн цэсийг CSS-ээр bottom sheet болгох
 *      (`position: fixed !important`). Vidstack нь цэсийг JS-ЭЭР
 *      байрлуулж inline `transform`/`top` бичдэг тул зөрчилдөж, цэс
 *      ОГТ НЭЭГДЭХГҮЙ болсон.
 *
 *   2-р оролдлого: `!important` хасаад зөвхөн хэмжээ тохируулах.
 *      Цэс нээгдэх болсон ч Vidstack нь товчны ДЭЭР байрлуулдаг тул
 *      удирдлагын мөр дэлгэцийн ёроолд байхад цэс нь ДЭЭШЭЭ гарч
 *      ТАСАРДАГ (хэрэглэгчийн гомдол).
 *
 * ЭЦСИЙН ШИЙДЭЛ: цэсийг БҮРЭН өөрсдөө барина. Portal-аар `body`
 * (эсвэл fullscreen элемент) рүү гаргаж, ДЭЛГЭЦЭД харьцангуй
 * байрлуулна — товчны байрлалаас ХАМААРАХГҮЙ тул хэзээ ч тасрахгүй.
 *
 * ⚠️ Гар утсанд доороос гарах хуудас (bottom sheet), desktop дээр
 * баруун доод буланд — Netflix, YouTube хоёулаа ийм загвартай.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, Settings, Subtitles, X } from 'lucide-react';
import { cn } from '@besttv/shared';

export interface SubtitleOption {
  lang: string;
  label: string;
}

export interface QualityOption {
  /** Vidstack-ийн жагсаалт дахь индекс. `-1` = Авто (ABR) */
  index: number;
  label: string;
}

/** Хадмалын хэмжээ — `globals.css`-ийн `--bt-cue-scale` хувьсагчид */
const SIZES = [
  { id: 'sm', label: 'Жижиг', scale: 0.85 },
  { id: 'md', label: 'Дунд', scale: 1 },
  { id: 'lg', label: 'Том', scale: 1.25 },
  { id: 'xl', label: 'Маш том', scale: 1.5 },
] as const;

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

type SizeId = (typeof SIZES)[number]['id'];
/** Аль дэлгэц харагдаж байгаа — `null` = үндсэн жагсаалт */
type Panel = null | 'subs' | 'quality' | 'speed' | 'cue';

const STORAGE_SIZE = 'besttv:cue-size';
const STORAGE_BG = 'besttv:cue-bg';

export function PlayerMenu({
  tracks,
  activeLang,
  onSelectLang,
  qualities,
  activeQuality,
  onSelectQuality,
  speed,
  onSelectSpeed,
}: {
  tracks: SubtitleOption[];
  activeLang: string | null;
  onSelectLang: (lang: string | null) => void;
  qualities: QualityOption[];
  activeQuality: number;
  onSelectQuality: (index: number) => void;
  speed: number;
  onSelectSpeed: (rate: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [size, setSize] = useState<SizeId>('md');
  /** Хадмалын ард хар дэвсгэр — гэрэлтэй кадрт уншихад хэрэгтэй */
  const [bg, setBg] = useState(true);

  const btnRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openedAt = useRef(0);

  /* ⚠️ SSR-д `document` байхгүй — portal зөвхөн browser-т */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /**
   * ⚠️⚠️ ДЭЛГЭЦ ДҮҮРЭН ҮЕД PORTAL-ЫН ЗОРИЛГО ӨӨРЧЛӨГДӨНӨ.
   * Browser нь fullscreen горимд ЗӨВХӨН `fullscreenElement`-ийн
   * доторх DOM-ыг зурдаг — `body`-д гаргасан цэс огт харагдахгүй.
   */
  const [fsEl, setFsEl] = useState<Element | null>(null);
  useEffect(() => {
    const sync = () => setFsEl(document.fullscreenElement);
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  /* ⚠️ Тохиргоог САНАНА — анги бүрд дахин тохируулах ёсгүй */
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_SIZE) as SizeId | null;
      if (s && SIZES.some((x) => x.id === s)) setSize(s);
      const b = localStorage.getItem(STORAGE_BG);
      if (b != null) setBg(b === '1');
    } catch {
      /* Private mode — анхдагчаар үлдэнэ */
    }
  }, []);

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

  /**
   * ⚠️⚠️ ГАДНА ДАРАХ — «АНИВЧААД АЛГА БОЛОХ» АЛДААНААС СЭРГИЙЛНЭ.
   *
   * Гар утсанд нэг хүрэлт ХОЁР эвент өгдөг — `touchstart`, дараа нь
   * ~300ms-д синтетик `mousedown`. `pointerdown` нь БҮГДИЙГ нэг удаа
   * барина; нээсэн мөчийн 250ms доторх эвентийг алгасна.
   */
  useEffect(() => {
    if (!open) return;
    openedAt.current = Date.now();
    const onDown = (e: PointerEvent) => {
      if (Date.now() - openedAt.current < 250) return;
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || sheetRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      /* ⚠️ Дэд дэлгэцээс эхлээд буцна — шууд хаах нь гэнэтийн */
      if (panel) setPanel(null);
      else setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, panel]);

  /* Хаах бүрд үндсэн жагсаалт руу — дараагийн нээлт цэвэр эхэлнэ */
  useEffect(() => {
    if (!open) setPanel(null);
  }, [open]);

  const activeLangLabel = activeLang
    ? (tracks.find((t) => t.lang === activeLang)?.label ?? activeLang)
    : 'Хаалттай';
  const activeQualityLabel =
    qualities.find((q) => q.index === activeQuality)?.label ?? 'Авто';

  const close = () => setOpen(false);

  return (
    <div ref={btnRef} className="relative">
      <button
        /* ⚠️ Player руу эвент явуулахгүй — play/pause солигдох, удирдлага
           нуугдах зэрэг нь цэсийг ч хамт хаадаг */
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label="Тохиргоо"
        title="Тохиргоо"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/15 hover:text-white"
      >
        <Settings size={20} />
      </button>

      {open &&
        mounted &&
        createPortal(
          <>
            {/* ⚠️ Дэвсгэр — дарж хаана. `pointerdown` дээр зогсоохгүй бол
                player руу очиж кино зогсоно. */}
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                close();
              }}
              style={{ zIndex: 2147483000 }}
              className="fixed inset-0 bg-black/60 animate-in fade-in duration-150"
              aria-hidden
            />

            <div
              ref={sheetRef}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{ zIndex: 2147483001 }}
              className={cn(
                'overflow-hidden border-white/12 bg-[#141414]/98 text-white shadow-2xl backdrop-blur-xl',
                /**
                 * ⚠️⚠️ MOBILE: доод талд наалдсан бүтэн өргөн хуудас.
                 * ДЭЛГЭЦЭД харьцангуй тул товчны байрлалаас ХАМААРАХГҮЙ
                 * — хэзээ ч дээшээ тасрахгүй.
                 * ⚠️ `dvh` — хаяг талбар нуугдахад `vh` буруу тооцоологдоно.
                 */
                'fixed inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-2xl border-t',
                'pb-[env(safe-area-inset-bottom,0.5rem)]',
                'animate-in slide-in-from-bottom duration-200',
                /* Desktop: баруун доод буланд жижиг цэс */
                'sm:inset-x-auto sm:bottom-20 sm:right-6 sm:w-72 sm:max-h-[70dvh] sm:rounded-xl sm:border sm:pb-0',
                'sm:animate-in sm:fade-in sm:slide-in-from-bottom-2 sm:duration-150',
              )}
              role="menu"
            >
              {/* ⚠️ Барих зурвас — mobile-д «доошоо чирж хаах» дохио */}
              <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-white/25 sm:hidden" />

              {/* ── Толгой ── */}
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
                {panel ? (
                  <button
                    onClick={() => setPanel(null)}
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-semibold hover:bg-white/10"
                    aria-label="Буцах"
                  >
                    <ChevronLeft size={16} />
                    {panel === 'subs'
                      ? 'Хадмал'
                      : panel === 'quality'
                        ? 'Чанар'
                        : panel === 'speed'
                          ? 'Хурд'
                          : 'Хадмалын харагдац'}
                  </button>
                ) : (
                  <p className="px-1.5 text-sm font-bold">Тохиргоо</p>
                )}
                <button
                  onClick={close}
                  className="ml-auto rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white"
                  aria-label="Хаах"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-1.5">
                {/* ── ҮНДСЭН ЖАГСААЛТ ── */}
                {!panel && (
                  <>
                    {/* ⚠️ Хадмалгүй видеонд мөр ОГТ гарахгүй — байгаа нь
                        өөрөө «хадмал бий» гэсэн худал дохио */}
                    {tracks.length > 0 && (
                      <NavRow
                        icon={<Subtitles size={16} />}
                        label="Хадмал"
                        value={activeLangLabel}
                        onClick={() => setPanel('subs')}
                      />
                    )}
                    {qualities.length > 1 && (
                      <NavRow
                        label="Чанар"
                        value={activeQualityLabel}
                        onClick={() => setPanel('quality')}
                      />
                    )}
                    <NavRow
                      label="Хурд"
                      value={speed === 1 ? 'Хэвийн' : `${speed}x`}
                      onClick={() => setPanel('speed')}
                    />
                    {activeLang && (
                      <NavRow
                        label="Хадмалын харагдац"
                        value={SIZES.find((s) => s.id === size)?.label ?? ''}
                        onClick={() => setPanel('cue')}
                      />
                    )}
                  </>
                )}

                {/* ── ХАДМАЛ ── */}
                {panel === 'subs' && (
                  <>
                    <PickRow
                      label="Хаалттай"
                      active={activeLang === null}
                      onClick={() => {
                        onSelectLang(null);
                        close();
                      }}
                    />
                    {tracks.map((t) => (
                      <PickRow
                        key={t.lang}
                        label={t.label}
                        active={activeLang === t.lang}
                        onClick={() => {
                          onSelectLang(t.lang);
                          close();
                        }}
                      />
                    ))}
                  </>
                )}

                {/* ── ЧАНАР ── */}
                {panel === 'quality' &&
                  qualities.map((q) => (
                    <PickRow
                      key={q.index}
                      label={q.label}
                      active={activeQuality === q.index}
                      onClick={() => {
                        onSelectQuality(q.index);
                        close();
                      }}
                    />
                  ))}

                {/* ── ХУРД ── */}
                {panel === 'speed' &&
                  SPEEDS.map((r) => (
                    <PickRow
                      key={r}
                      label={r === 1 ? 'Хэвийн' : `${r}x`}
                      active={speed === r}
                      onClick={() => {
                        onSelectSpeed(r);
                        close();
                      }}
                    />
                  ))}

                {/* ── ХАДМАЛЫН ХАРАГДАЦ ── */}
                {panel === 'cue' && (
                  <div className="space-y-3 p-1">
                    <div>
                      <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                        Үсгийн хэмжээ
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {SIZES.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setSize(s.id)}
                            className={cn(
                              'rounded-lg py-2.5 text-xs font-medium transition-colors',
                              size === s.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-white/8 text-white/70 hover:bg-white/14',
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-3 text-sm hover:bg-white/8">
                      Хар дэвсгэр
                      <input
                        type="checkbox"
                        checked={bg}
                        onChange={(e) => setBg(e.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </>,
          fsEl ?? document.body,
        )}
    </div>
  );
}

/** Дэд дэлгэц рүү шилжих мөр — одоогийн утгыг баруун талд харуулна */
function NavRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      /* ⚠️ 48px — гар утасны хүрэх талбай (Apple 44px хязгаараас дээш) */
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-3.5 text-left text-sm transition-colors hover:bg-white/8 sm:py-2.5"
    >
      {icon && <span className="text-white/60">{icon}</span>}
      <span className="flex-1">{label}</span>
      <span className="max-w-[45%] truncate text-white/50">{value}</span>
      <ChevronLeft size={15} className="rotate-180 text-white/35" />
    </button>
  );
}

/** Сонголтын мөр — идэвхтэйг чагтаар тэмдэглэнэ */
function PickRow({
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
        'flex w-full items-center justify-between rounded-lg px-3 py-3.5 text-left text-sm transition-colors sm:py-2.5',
        active ? 'bg-primary/20 text-white' : 'text-white/80 hover:bg-white/8',
      )}
    >
      {label}
      {active && <Check size={16} className="text-primary" />}
    </button>
  );
}
