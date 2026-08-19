'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TitleCard as TitleCardType } from '@besttv/shared';
import { cn } from '@besttv/shared';
/* ⚠️ `useWheelScroll` ХАСАГДСАН — доод тайлбарыг харна уу.
   Hook нь бусад газар (cast-row, gallery-row) хэвээр ажиллана. */
import { TitleCard, Top10Card } from './title-card';
import { api } from '@/lib/api';

interface TitleRowProps {
  title: string;
  items: TitleCardType[];
  /** "Бүгдийг үзэх" холбоос (ж: /movies?genre=dram) */
  href?: string;
  /** Top-10 том дугаартай загвар */
  variant?: 'default' | 'top10';
  /** Continue-watching — item.id → үзсэн хувь */
  progressById?: Record<string, number>;
  /**
   * ⚠️ ҮРГЭЛЖ НЭГ МӨР (2 эгнээ болгохгүй).
   *
   * «Үргэлжлүүлэн үзэх» нь 6-10 кинотой байхад 2 мөр болж дэлгэцийн
   * зайг дэмий эзэлдэг байв — энэ хэсэг нь ХУРДАН үргэлжлүүлэх
   * зорилготой тул нэг харцаар харагдах ёстой. Олон кино байвал
   * хэвтээ гүйлгэнэ (сум товч / хуруу).
   */
  singleRow?: boolean;
  /**
   * ⚠️⚠️ ДУУСТАЛ АЧААЛАХ — жанрын slug.
   *
   * Нүүр хуудас нь эгнээ бүрд 24 кино л өгдөг (илүү өгвөл анхны
   * ачаалалт УДААШИРНА). Хэрэглэгч баруун тийш гүйлгэж төгсгөлд
   * ойртоход тухайн жанрын ДАРААГИЙН хуудсыг нэмж татна.
   *
   * ⚠️ Заагаагүй бол lazy-load ОГТ ажиллахгүй (top10, continue
   * watching зэрэгт хэрэггүй).
   */
  genreSlug?: string;
}

/** Жанрын карусель мөр — hide-scrollbar + чиглэл товч + edge fade (Netflix загвар) */
export function TitleRow({
  title,
  items,
  href,
  variant = 'default',
  progressById,
  singleRow,
  genreSlug,
}: TitleRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  /**
   * ⚠️⚠️ ГҮЙЛГЭХЭД НЭМЖ АЧААЛНА (нүүрийг удаашруулахгүй).
   *
   * Анх нээхэд эгнээ бүрд 24 кино л ирнэ. Хэрэглэгч төгсгөлд
   * ойртоход л дараагийн хуудас татагдана — 4 жанр × бүх кино
   * гэдэг нь эхний ачаалалтад хэдэн зуун мөр болно.
   */
  const [extra, setExtra] = useState<TitleCardType[]>([]);
  const [page, setPage] = useState(1);
  const [exhausted, setExhausted] = useState(!genreSlug);
  const loadingRef = useRef(false);

  /* ⚠️ Эх жагсаалт + нэмж татсан. Давхардлыг ID-аар шүүнэ —
     backend-ийн эрэмбэ өөрчлөгдвөл ижил кино хоёр удаа ирж болно. */
  const allItems = useMemo(() => {
    if (!extra.length) return items;
    const seen = new Set(items.map((t) => t.id));
    return [...items, ...extra.filter((t) => !seen.has(t.id) && !seen.has(t.id))];
  }, [items, extra]);

  const loadMore = useCallback(async () => {
    if (!genreSlug || exhausted || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const next = page + 1;
      const r = await api<{ items: TitleCardType[]; totalPages: number }>(
        `/titles?genre=${encodeURIComponent(genreSlug)}&page=${next}&limit=24`,
      );
      const rows = r.items ?? [];
      setExtra((cur) => [...cur, ...rows]);
      setPage(next);
      /* ⚠️ Төгсгөлд хүрсэн эсэхийг ХОЁР шалгуураар — хоосон хариу
         эсвэл сүүлийн хуудас (аль нэг нь буруу байж болно) */
      if (!rows.length || next >= (r.totalPages ?? next)) setExhausted(true);
    } catch {
      /* ⚠️ Алдаа гарвал ДАХИН оролдохгүй — эс бөгөөс гүйлгэх бүрд
         унасан хүсэлт давтагдана */
      setExhausted(true);
    } finally {
      loadingRef.current = false;
    }
  }, [genreSlug, exhausted, page]);

  /**
   * ⚠️⚠️ ХОЁР ЭГНЭЭ — ЗӨВХӨН нэг мөр ДҮҮРСНИЙ ДАРАА.
   *
   * Өмнө нь `items.length >= 6` гэсэн ТОГТМОЛ тоогоор шийддэг байсан
   * нь БУРУУ: том дэлгэцэнд 6 кино нэг мөрөнд амархан багтдаг тул
   * эхний мөр ХАГАС ХООСОН байхад хоёр дахь мөр эхэлж, 3 кино
   * дээр-доор өрөгдөж эвгүй харагддаг байв.
   *
   * Зөв логик: эхний мөр БҮРЭН дүүрч, багтахаа больсон үед л 2 дахь
   * мөр рүү шилжинэ. Дэлгэцийн өргөн, картын хэмжээ хоёулаа
   * өөрчлөгддөг тул ТОГТМОЛ тоогоор таамаглах боломжгүй — БОДИТООР
   * хэмжинэ (доорх `useEffect`).
   *
   * ⚠️ TOP10 нь эрэмбэ 1→10 гэж уншигддаг тул ҮРГЭЛЖ нэг мөр.
   * ⚠️ `singleRow` — «Үргэлжлүүлэн үзэх» ҮРГЭЛЖ нэг мөр (кино хэдэн ч
   * байсан). Тэр хэсэг нь ХУРДАН үргэлжлүүлэх зорилготой тул нэг
   * харцаар харагдах ёстой, олон бол хэвтээ гүйлгэнэ.
   */
  const allowTwoRows = !singleRow && variant !== 'top10';

  /**
   * ⚠️ Анхны утга `false` — нэг мөрөөр эхэлнэ.
   *
   * SSR дээр дэлгэцийн өргөн МЭДЭГДЭХГҮЙ. `true`-гээр эхэлбэл цөөн
   * кинотой эгнээ агшин зуур 2 мөр болж, дараа нь нэг мөр болж
   * ҮСРЭНЭ (layout shift). Нэг мөрөөс 2 мөр болох нь харагдацад
   * илүү зөөлөн.
   */
  const [twoRows, setTwoRows] = useState(false);
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

    /**
     * ⚠️⚠️ ТӨГСГӨЛД ОЙРТВОЛ ДАРААГИЙН ХУУДСЫГ ТАТНА.
     *
     * ⚠️ 2 дэлгэцийн өргөнөөр урьдчилна — хэрэглэгч төгсгөлд ХҮРТЭЛ
     * хүлээвэл эгнээ гэнэт зогсоод дараа нь үсэрч уртсана. Урьдчилж
     * татвал гүйлт ТАСРАЛТГҮЙ мэдрэгдэнэ.
     */
    const remaining = el.scrollWidth - (el.scrollLeft + el.clientWidth);
    if (remaining < el.clientWidth * 2) void loadMoreRef.current?.();
  }, []);

  /* ⚠️ `useCallback`-ийн хамаарлын гогцоо үүсэхээс сэргийлж ref-ээр */
  const loadMoreRef = useRef<(() => void) | null>(null);

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
  /**
   * ⚠️⚠️ НЭГ МӨРӨНД ХЭДЭН КАРТ БАГТАХЫГ БОДИТООР ХЭМЖИНЭ.
   *
   * Картын өргөн нь breakpoint-оор өөрчлөгддөг (`w-37.5` → `sm:w-45`),
   * дэлгэцийн өргөн ч янз бүр. Тиймээс «6-аас олон бол 2 мөр» гэсэн
   * ТОГТМОЛ тоо аль ч дэлгэцэнд таарахгүй — эхний мөр хагас хоосон
   * байхад 2 дахь мөр эхэлдэг байв.
   *
   * АРГА: эхний картын бодит өргөн + gap-аар нэг мөрөнд хэдэн карт
   * багтахыг тооцоод, кино түүнээс ОЛОН байвал л 2 мөр болгоно.
   */
  const updateRows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    if (!allowTwoRows) {
      setTwoRows(false);
      return;
    }

    const first = el.firstElementChild as HTMLElement | null;
    if (!first) return;

    /**
     * ⚠️⚠️ ХЭМЖЭЭГ ҮРГЭЛЖ НЭГ МӨРИЙН ТӨЛӨВӨӨР ТООЦНО.
     *
     * БОДИТ АЛДАА: 2 мөр болмогц контейнер нь `grid grid-rows-2`
     * болдог. Тэр үед `el.clientWidth` нь ГҮЙЛТИЙН бүтэн өргөнийг
     * (scrollWidth-тэй ойролцоо) өгч эхэлдэг тул `perRow` нь бодит
     * дэлгэцээс ХАМААГҮЙ ИХ гарна. Үр дүнд `cols >= perRow` нөхцөл
     * хэзээ ч худал болохгүй → нэгэнт 2 мөр болсон эгнээ БУЦАЖ
     * НЭГ МӨР БОЛДОГГҮЙ (хэрэглэгчийн скриншот: 16 кино 8+8 болж,
     * баруун тал хоосон).
     *
     * ЗАСВАР: эцэг элементийн (`overflow` савны) өргөнийг хэмжинэ —
     * тэр нь мөрийн тооноос ХАМААРАХГҮЙ, үргэлж дэлгэцийн бодит
     * харагдах өргөн.
     */
    const viewport = el.parentElement?.clientWidth || el.clientWidth;

    /* ⚠️ `gap-3` = 0.75rem. CSS-ээс уншина — Tailwind класс өөрчлөгдвөл
       энд гараар засах шаардлагагүй. */
    const gap = parseFloat(getComputedStyle(el).columnGap || '0') || 12;
    const cardWidth = first.getBoundingClientRect().width;
    if (cardWidth <= 0) return;

    /**
     * ⚠️ `+ gap` хоёр талд — n ширхэг карт нь `n*w + (n-1)*gap` эзэлнэ.
     * Томьёог хөрвүүлбэл `n = (W + gap) / (w + gap)`.
     */
    const perRow = Math.max(1, Math.floor((viewport + gap) / (cardWidth + gap)));

    /**
     * ⚠️⚠️ 2 МӨР БОЛБОЛ БАГАНЫН ТОО = `ceil(n / 2)`.
     *
     * Өмнөх `items.length > perRow` дүрэм БУРУУ байв: 10 кино нь нэг
     * мөрөнд багтахгүй (perRow=9) тул 2 мөр болдог — гэвч 2 мөр болбол
     * ердөө 5 БАГАНА болж, дэлгэцийн ТЭН ХАГАС хоосон үлдэнэ
     * (хэрэглэгчийн скриншот дээр яг тэр).
     *
     * Зөв дүрэм: 2 мөр нь дэлгэцийг ДҮҮРГЭДЭГ бол л утгатай —
     * өөрөөр хэлбэл `ceil(n/2) >= perRow`. Эс бөгөөс нэг мөрөнд
     * үлдээж хэвтээ гүйлгэсэн нь цэвэрхэн.
     *
     * Жишээ (perRow=9):
     *   10 кино → 5 багана  < 9 → НЭГ мөр (гүйлгэнэ)
     *   18 кино → 9 багана >= 9 → ХОЁР мөр (дүүрнэ)
     *
     * ⚠️ Гистерезис: 2 мөр рүү шилжсэний дараа grid болж эхний
     * картын хэмжээ өөрчлөгдөж болзошгүй. Буцаж 1 мөр болохын тулд
     * нэг баганын зайгаар илүү зөрүү шаардана (1↔2 хооронд
     * хязгааргүй сэлгэхээс сэргийлнэ).
     */
    const cols = Math.ceil(allItems.length / 2);
    /**
     * ⚠️ Гистерезис: 1→2 руу шилжихэд `perRow` хүрэх ёстой, 2→1 руу
     * буцахад нэг баганын зөрүү өгнө (хязгааргүй сэлгэхээс сэргийлнэ).
     * Хэмжилт нь одоо мөрийн тооноос хамаарахгүй тул найдвартай.
     */
    setTwoRows((prev) => (prev ? cols > perRow : cols >= perRow));
  }, [allowTwoRows, allItems.length]);

  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  useEffect(() => {
    updateScrollState();
    updateRows();
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      updateScrollState();
      updateRows();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [allItems.length, updateScrollState, updateRows]);

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
            ? allItems.slice(0, 10).map((t, i) => <Top10Card key={t.id} title={t} rank={i + 1} />)
            : allItems.map((t) => (
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
