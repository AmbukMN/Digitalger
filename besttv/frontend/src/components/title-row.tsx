'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TitleCard as TitleCardType } from '@besttv/shared';
import { cn } from '@besttv/shared';
/* ⚠️ `useWheelScroll` ХАСАГДСАН — доод тайлбарыг харна уу.
   Hook нь бусад газар (cast-row, gallery-row) хэвээр ажиллана. */
import { TitleCard, Top10Card } from './title-card';

interface TitleRowProps {
  title: string;
  items: TitleCardType[];
  /** "Бүгдийг үзэх" холбоос (ж: /movies?genre=dram) */
  href?: string;
  /** Top-10 том дугаартай загвар */
  variant?: 'default' | 'top10';
  /** Continue-watching — item.id → үзсэн хувь */
  progressById?: Record<string, number>;
}

/** Жанрын карусель мөр — hide-scrollbar + чиглэл товч + edge fade (Netflix загвар) */
export function TitleRow({ title, items, href, variant = 'default', progressById }: TitleRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  /**
   * ⚠️⚠️ ХОЁР ЭГНЭЭ — гэхдээ ЗӨВХӨН хангалттай кино байвал.
   *
   * 6-аас цөөн кинотой жанрыг 2 мөр болговол хоёр дахь мөр хагас
   * хоосон үлдэж эвгүй харагдана ("Үргэлжлүүлэн үзэх" нь ихэвчлэн
   * 1-3 кинотой). Тэр тохиолдолд нэг мөр илүү цэвэрхэн.
   *
   * ⚠️ TOP10 нь эрэмбэ 1→10 гэж уншигддаг тул ҮРГЭЛЖ нэг мөр.
   */
  const twoRows = variant !== 'top10' && items.length >= 6;
  /**
   * ⚠️ Анхны утга `right: false` — өмнө нь `true` байсан тул гүйлгэх
   * зүйл БАЙХГҮЙ эгнээнд ч баруун fade харагдаж, "цааш кино бий"
   * гэж ХУУРДАГ байв (доорх `useEffect` бодит утгыг тавина).
   */
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanScroll({
      left: el.scrollLeft > 8,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 8,
    });
  }, []);

  /**
   * ⚠️⚠️ MOUNT + ХЭМЖЭЭ ӨӨРЧЛӨГДӨХӨД шалгана.
   *
   * `onScroll` нь хэрэглэгч ГҮЙЛГЭТЭЛ дуудагддаггүй тул анхны төлөв
   * хэзээ ч зөв болдоггүй байв. Мобайлд сум товч байхгүй (`md:flex`),
   * scrollbar нуугдсан тул fade нь гүйлгэж болохыг заах ЦОРЫН ГАНЦ
   * дохио — тэр нь буруу байвал хэрэглэгч кино байгааг мэдэхгүй.
   *
   * ⚠️ `ResizeObserver` — дэлгэц эргүүлэх/цонх өөрчлөхөд картын тоо
   * өөрчлөгдөж gүйлт шаардлагатай эсэх нь өөрчлөгдөнө.
   */
  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length, updateScrollState]);

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    /**
     * ⚠️⚠️ ХАРАГДАХ ӨРГӨНӨӨР гүйлгэнэ (тогтмол 720px БИШ).
     *
     * 720px нь картын өргөнтэй (150/180px + gap) таардаггүй тул
     * гүйлт бүрд кино ХАГАСААР тасарч, эцэст нь зарим кино огт
     * харагдахгүй өнгөрдөг байв.
     *
     * ⚠️ `clientWidth` нь ЯГ харагдах хэсэг — түүгээр гүйлгэвэл өмнөх
     * дэлгэцийн сүүлчийн карт шинэ дэлгэцийн эхэнд ирнэ.
     * ⚠️ `- 40` — нэг картын багахан хэсэг үлдээж "цааш үргэлжилж
     * байна" гэдгийг харуулна (чиг баримжаа алдагдахгүй).
     */
    el.scrollBy({ left: dir * Math.max(200, el.clientWidth - 40), behavior: 'smooth' });
  };

  // Хулганы дугуйгаар хэвтээ гүйлгэнэ (desktop)
  /**
   * ⚠️⚠️ ХУЛГАНЫ ДУГУЙГААР ХЭВТЭЭ ГҮЙЛГЭХИЙГ ХАСАВ (`useWheelScroll`).
   *
   * Хэрэглэгч хуудсыг ДООШ гүйлгэж явахад курсор киноны эгнээ дээр
   * тааралдмагц гүйлт нь ХЭВТЭЭ болж хувирдаг байв — хуудас гацаж,
   * кино хажуу тийш гүйнэ. Энэ нь хамгийн түгээмэл гомдол.
   *
   * Эгнээг гүйлгэх бусад зам БҮГД хэвээр: хажуугийн сум товч,
   * чирэх (drag), мобайлд хуруу, трекпадын хэвтээ дохио.
   */

  if (items.length === 0) return null;

  return (
    <section className="px-4 md:px-8" aria-label={title}>
      {/*
        ⚠️⚠️ ЖАНРЫН ТОЛГОЙ — зураас нь бүх өргөнөөр ДООГУУР нь явна.

        БҮТЭЦ: гарчиг болон "БҮГД" товч нь НЭГ мөрөнд, тэдний ДООР
        (эцэг элементийн `border-b`) улаан зураас. Товч нь зурааснаас
        ДЭЭШЭЭ сууж, баруун үзүүрт нь нийлнэ.

        ⚠️ Өмнө нь зураасыг гарчиг ба товчны ХООРОНД `flex-1` div-ээр
        тавьсан нь БУРУУ байв — зураас нь гарчгийн ХАЖУУГААР явж,
        доогуур нь ОРООГҮЙ.

        ЯАГААД зураас вэ: жанрууд хооронд хараагаар ЯЛГАРАХГҮЙ, эгнээ
        бүр нэг урсгал мэт харагддаг байв. Зураас нь хэсгийн ХИЛ болно.
      */}
      <div className="mb-3 flex items-end justify-between gap-3 border-b-2 border-primary">
        <h2 className="truncate pb-1.5 text-lg font-bold tracking-tight text-foreground md:text-xl">
          {title}
        </h2>
        {href && (
          /* ⚠️ `rounded-t-md` + padding зөвхөн дээр — товч зураасан
             дээр СУУСАН мэт харагдана (доод ирмэг нь зурааст нийлнэ) */
          <Link
            href={href}
            className="group flex shrink-0 items-center gap-1 rounded-t-md bg-primary px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-foreground transition-all hover:brightness-110"
          >
            Бүгд
            <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      <div className="group/row relative -mx-1 px-1">
        <button
          onClick={() => scroll(-1)}
          aria-label="Зүүн тийш"
          className={cn(
            'absolute -left-2 top-0 bottom-0 z-20 hidden w-12 items-center justify-center bg-linear-to-r from-background via-background/80 to-transparent text-foreground transition-opacity md:flex',
            canScroll.left ? 'opacity-0 group-hover/row:opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <ChevronLeft size={30} />
        </button>

        <div
          ref={trackRef}
          onScroll={updateScrollState}
          className={cn(
            // ⚠️ snap нь ЗӨВХӨН мобайлд (хуруугаар гүйлгэхэд карт цэгцтэй
            // зогсоно). Desktop дээр snap-mandatory нь хулганы дугуй/чирэлтийг
            // гацаадаг тул md-ээс дээш унтраана.
            /**
             * ⚠️ `snap-*` ХАСАВ — картад `snap-start` тавиагүй тул snap
             * ОГТ ажиллахгүй байсан (зөвхөн `md:snap-none`-оор
             * унтраадаг байдал). Хэрэглэхгүй CSS нь зөвхөн будлиан
             * үүсгэнэ. Мобайлд чөлөөт гүйлт илүү жигд мэдрэгдэнэ.
             */
            'hide-scrollbar gap-3 overflow-x-auto scroll-smooth pb-2 pt-1',
            /**
             * ⚠️ `grid-flow-col` — элементүүд БАГАНААР дүүрнэ (1-2 нь
             * эхний багана, 3-4 нь хоёр дахь…). `grid-flow-row` бол
             * хэвтээ гүйлт утгагүй болно.
             * ⚠️ `auto-cols-max` — багана нь картын өргөнөөр (`w-37.5`)
             * тогтоно, эс бөгөөс grid тэдгээрийг тэнцүү сунгана.
             */
            twoRows ? 'grid grid-flow-col grid-rows-2 auto-cols-max' : 'flex',
            canScroll.right && 'row-fade-right',
          )}
        >
          {variant === 'top10'
            ? items.slice(0, 10).map((t, i) => <Top10Card key={t.id} title={t} rank={i + 1} />)
            : items.map((t) => (
                <TitleCard key={t.id} title={t} progressPercent={progressById?.[t.id]} />
              ))}
        </div>

        <button
          onClick={() => scroll(1)}
          aria-label="Баруун тийш"
          className={cn(
            'absolute -right-2 top-0 bottom-0 z-20 hidden w-12 items-center justify-center bg-linear-to-l from-background via-background/80 to-transparent text-foreground transition-opacity md:flex',
            canScroll.right ? 'opacity-0 group-hover/row:opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <ChevronRight size={30} />
        </button>
      </div>
    </section>
  );
}
