'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

/**
 * «Багц авах» товчны ТАЙЛБАР (tooltip).
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: товч дээр ердөө «Багц авах» гэж бичээстэй
 * байсан тул хэрэглэгч ЮУ авахаа мэдэхгүй /pricing руу орж, тэндээс
 * олон багц хараад эргэлзэж БУЦДАГ байв.
 *
 * ⚠️ ЗӨВХӨН киноны дэлгэрэнгүй хуудсанд. Бусад «Багц авах» товчнууд
 * (плеер, hero, түрээсийн цонх, footer, navbar) ХУУЧНААРАА үлдэнэ —
 * тэнд контекст өөр (тухайн киноны жанар тодорхойгүй).
 *
 * ⚠️⚠️ ГАР УТАС: hover БАЙХГҮЙ тул `touchstart`-аар нээж, 3.5 секундын
 * дараа автоматаар хаана. Товчны үндсэн үйлдэл (линк рүү шилжих)
 * ХЭВЭЭР — tooltip нь зөвхөн мэдээлэл, дарахад саад болохгүй.
 */

interface Props {
  /** Тухайн киноны жанрын нэрс (`data.genres`) — динамикаар бичнэ */
  genreNames?: string[];
  children: React.ReactNode;
  /** Товч баруун талд байвал tooltip зүүн тийш эгнэнэ */
  align?: 'left' | 'center' | 'right';
}

/**
 * Жанрын нэрсийг «… багцын» хэлбэрт оруулна.
 *
 * ⚠️ Жанрын БҮТЭН нэрийг хэвээр нь үлдээнэ («Монгол кино багцын») —
 * «кино» үгийг таславал «Монгол багцын» гэж эвгүй сонсогдоно.
 * Дунд нь «багцын» орсноор давхардал мэдрэгдэхгүй.
 *
 * ⚠️ Жанр олон бол таслалаар («Монгол кино, Шилдэг кино багцын»).
 * Жанргүй бол ерөнхий үг рүү унана — хоосон орхивол өгүүлбэр эвдэрнэ.
 */
function genreLabel(names: string[]): string {
  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  return cleaned.length ? `${cleaned.join(', ')} багцын` : 'тухайн жанрын';
}

export function PlanHint({ genreNames = [], children, align = 'center' }: Props) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ⚠️ Компонент устахад таймер үлдвэл санах ойд алдаа өгнө */
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const openNow = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const closeNow = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={openNow}
      onMouseLeave={closeNow}
      /* ⚠️ Гар утас: hover байхгүй тул хүрэхэд нээгээд өөрөө хаана.
         `preventDefault` ХИЙХГҮЙ — линк ажиллах ёстой. */
      onTouchStart={() => {
        openNow();
        closeTimer.current = setTimeout(() => setOpen(false), 3500);
      }}
      /* ⚠️ Гараар мэдээлэлд хүрэх боломж (Tab → focus) */
      onFocus={openNow}
      onBlur={closeNow}
    >
      {children}

      {open && (
        <span
          role="tooltip"
          /* ⚠️ `pointer-events-none` — tooltip нь товчны дарагдалтыг
             хааж болохгүй (гар утсанд хуруу түүн дээр буудаг) */
          className={[
            'plan-hint-in pointer-events-none absolute bottom-full z-50 mb-2.5 w-[14.5rem]',
            'rounded-xl border border-foreground/12 bg-background p-3 text-left shadow-2xl',
            align === 'right'
              ? 'right-0'
              : align === 'left'
                ? 'left-0'
                : 'left-1/2 -translate-x-1/2',
          ].join(' ')}
        >
          <span className="flex items-start gap-2">
            <Check size={14} className="mt-0.5 shrink-0 text-premium" />
            <span className="text-[12.5px] font-medium leading-snug text-foreground">
              Багц авбал {genreLabel(genreNames)} бүх кино контент үзэх эрхтэй
              болно
            </span>
          </span>

          {/* Заагч гурвалжин */}
          <span
            className={[
              'absolute top-full h-2 w-2 rotate-45 border-b border-r border-foreground/12 bg-background',
              align === 'right'
                ? 'right-6'
                : align === 'left'
                  ? 'left-6'
                  : 'left-1/2 -translate-x-1/2',
            ].join(' ')}
            style={{ marginTop: -4 }}
          />
        </span>
      )}
    </span>
  );
}
