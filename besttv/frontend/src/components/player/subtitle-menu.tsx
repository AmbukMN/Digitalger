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
import { createPortal } from 'react-dom';
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
  /** ⚠️ Цэсний DOM — `contains` шалгалтад ЗААВАЛ (portal-д гардаг) */
  const sheetRef = useRef<HTMLDivElement>(null);
  /**
   * ⚠️ SSR-д `document` байхгүй тул portal-ыг зөвхөн browser-т
   * рендерлэнэ (Next.js hydration алдаанаас сэргийлнэ).
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /**
   * ⚠️⚠️ ДЭЛГЭЦ ДҮҮРЭН ҮЕД PORTAL-ЫН ЗОРИЛГО ӨӨРЧЛӨГДӨНӨ.
   *
   * Fullscreen горимд browser нь ЗӨВХӨН `fullscreenElement`-ийн
   * доторх DOM-ыг зурдаг. `document.body`-д гаргасан цэс нь тэр
   * модны ГАДНА үлдэх тул ОГТ ХАРАГДАХГҮЙ.
   *
   * Тиймээс fullscreen үед portal-ыг тэр элемент рүү шилжүүлнэ.
   */
  const [fsEl, setFsEl] = useState<Element | null>(null);
  useEffect(() => {
    const sync = () => setFsEl(document.fullscreenElement);
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

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

  /**
   * ⚠️⚠️ ГАДНА ДАРАХ — ГАР УТАСНЫ «АНИВЧААД АЛГА БОЛОХ» АЛДАА.
   *
   * БОДИТ АЛДАА: гар утсанд нэг хүрэлт нь ХОЁР эвент өгдөг —
   * эхлээд `touchstart`, дараа нь ~300ms-ийн дотор СИНТЕТИК
   * `mousedown`. Товч дарахад:
   *   1. `onClick` → цэс НЭЭГДЭНЭ
   *   2. Синтетик `mousedown` ирнэ → «гадна дарсан» гэж үзэж ХААНА
   * Үр дүнд цэс анивчаад алга болно (хэрэглэгчийн гомдол).
   *
   * ⚠️ Мөн bottom sheet нь `fixed` боловч DOM-д `rootRef` ДОТОР
   * үлддэг тул `contains` зөв ажиллана — асуудал нь ЗӨВХӨН
   * эвентийн давхардал.
   *
   * ЗАСВАР:
   *   • `pointerdown` — touch/mouse/pen БҮГДИЙГ НЭГ удаа барина
   *     (синтетик `mousedown` давхардахгүй)
   *   • Нээгдсэн ЯГ тэр мөчид ирсэн эвентийг алгасна (`openedAt`)
   */
  const openedAt = useRef(0);
  useEffect(() => {
    if (!open) return;
    openedAt.current = Date.now();

    const onDown = (e: PointerEvent) => {
      /* ⚠️ Нээсэн дарагдалтын үлдэгдэл эвентийг алгасна */
      if (Date.now() - openedAt.current < 250) return;
      const t = e.target as Node;
      /* ⚠️ Portal-д гарсан цэс нь `rootRef`-ийн ГАДНА байрлана —
         тусад нь шалгахгүй бол цэс дотор дарахад ХААГДАНА */
      if (rootRef.current?.contains(t) || sheetRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  /* ⚠️ ХАДМАЛГҮЙ бол товч ОГТ гарахгүй */
  if (!tracks.length) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        /**
         * ⚠️⚠️ ЭВЕНТИЙГ ЗОГСООНО — Vidstack руу ЦААШ БҮҮ ЯВУУЛ.
         *
         * Товч нь player-ийн ДОТОР байрладаг тул дарагдалт нь
         * player руу «бөмбөрцөглөж» очоод:
         *   • play/pause солигдох (gestures)
         *   • удирдлага нуугдаж, товч алга болох
         * Эдгээр нь цэсийг ч хамт хаадаг.
         */
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          /**
           * ⚠️ Vidstack-ийн ТОХИРГООНЫ цэс нээлттэй бол ХААНА —
           * хоёр цэс зэрэг нээгдвэл давхцаж, аль нь ажиллаж байгаа
           * нь ойлгомжгүй болно.
           */
          if (!open) {
            document
              .querySelectorAll<HTMLElement>('.vds-menu-button[aria-expanded="true"]')
              .forEach((b) => b.click());
          }
          setOpen((v) => !v);
        }}
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

      {/**
        * ⚠️⚠️ PORTAL — ЦЭС АНИВЧААД АЛГА БОЛДОГ БАЙСНЫ ГОЛ ШАЛТГААН.
        *
        * БОДИТ АЛДАА: товч нь Vidstack-ийн УДИРДЛАГЫН МӨРӨНД
        * байрладаг. Тэр мөр нь хэрэглэгч 2 сек хөдөлгөөнгүй байхад
        * `opacity: 0` болдог — `opacity` нь ҮР УДАМД УДАМШДАГ тул
        * `fixed` байсан ч цэс ХАМТ алга болно.
        *
        * Мөн удирдлагын мөр нь `overflow`/`transform`-тэй байж
        * болох тул `fixed` нь түүнд харьцангуй болж, дэлгэцийн
        * доод талд наалдахгүй.
        *
        * `createPortal(document.body)` нь цэсийг DOM-ийн ҮНДЭС рүү
        * гаргана — эцгийн `opacity`, `transform`, `overflow` ямар ч
        * нөлөөгүй.
        */}
      {open && mounted && createPortal(
        <>
          {/*
            ⚠️⚠️ MOBILE — ДООРООС ГАРАХ ХУУДАС (bottom sheet).

            БОДИТ АЛДАА: `absolute bottom-12 right-0` нь ТОВЧНЫ
            байрлалаас хамаардаг. Player-ийн удирдлага mobile-д ДЭЭД
            талд байрлах үед цэс нь дэлгэцээс ДЭЭШ гарч, огт
            харагдахгүй байв (хэрэглэгчийн зураг).

            Bottom sheet нь товчны байрлалаас ХАМААРАХГҮЙ — үргэлж
            дэлгэцийн доод талд наалдана. Netflix, YouTube, Spotify
            бүгд гар утсанд ийм загвартай (эрхий хуруунд ойр).
          */}
          <div
            /* ⚠️ Vidstack-ийн цэс 1000+ z-index-тэй тул Tailwind-ийн
               `z-50` (=50) нь ДООГУУР үлдэнэ — inline утга өгнө */
            style={{ zIndex: 2147483000 }}
            className="fixed inset-0 bg-black/60 sm:hidden"
            onPointerDown={(e) => {
              /* ⚠️ Player руу явуулахгүй — эс бөгөөс дэвсгэр дарахад
                 кино зогсдог/эхэлдэг */
              e.stopPropagation();
              setOpen(false);
            }}
            aria-hidden
          />
        <div
          ref={sheetRef}
          /* ⚠️ Цэс дотор дарахад player руу очих ёсгүй (play/pause) */
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          /* ⚠️ Дэвсгэрээс 1-ээр дээш — цэс нь дэвсгэр дээр байна */
          style={{ zIndex: 2147483001 }}
          className={cn(
            'overflow-hidden border-white/12 bg-[#151515]/97 shadow-2xl backdrop-blur',
            /* Mobile: доод талд наалдсан бүтэн өргөн хуудас */
            'fixed inset-x-0 bottom-0 max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t',
            'animate-in slide-in-from-bottom duration-200',
            /**
             * Desktop: баруун доод буланд жижиг цэс.
             * ⚠️ Portal-д гарсан тул `absolute` нь `body`-д харьцангуй
             * болно — `fixed`-ээр байрлуулж, товчны ойролцоо тавина.
             */
            'sm:inset-x-auto sm:bottom-20 sm:right-6 sm:max-h-[70dvh] sm:w-64 sm:rounded-xl sm:border',
            'sm:animate-in sm:fade-in sm:slide-in-from-bottom-2 sm:duration-150',
          )}
          role="menu"
        >
          {/* ⚠️ Барих зурвас — mobile-д «доошоо чирж хаах» дохио */}
          <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-white/25 sm:hidden" />
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
        </>,
        fsEl ?? document.body,
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
        /* ⚠️ Mobile-д 44px өндөр — Apple/Google-ийн хүрэх талбай */
        'flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm transition-colors sm:px-2 sm:py-2',
        active ? 'bg-primary/20 text-white' : 'text-white/75 hover:bg-white/8',
      )}
    >
      {label}
      {active && <Check size={14} className="text-primary" />}
    </button>
  );
}
