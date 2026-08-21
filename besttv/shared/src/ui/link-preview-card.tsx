'use client';

import { cn } from '../lib/utils';

/**
 * ЧАТ ДОТОРХ ХОЛБООСЫН OG КАРТ — ГУРВАН СУВАГТ ИЖИЛ.
 *
 * ⚠️⚠️ ЯАГААД SHARED ПАКЕТАД БАЙНА ВЭ:
 * Хэрэглэгчийн шаардлага — «neg l umiig 2 tald haruulaachee».
 * Өмнө нь вэб чат болон админ панельд ТУС ТУСАД НЬ бичсэн байсан:
 * нэгийг зассан алдаа нөгөөд үлдэх, хэлбэр нь зөрөх эрсдэлтэй байв.
 *
 * ⚠️ Өгөгдлийг ЭНД татахгүй — backend нь мессеж хадгалах үед OG-г
 * нэг удаа татаад `ChatMessage.linkPreview`-д хийчихсэн байдаг.
 * Ингэснээр вэб, админ, FB/IG гурвуулаа НЭГ эх сурвалжаас уншина.
 *
 * FB/IG дээр энэ компонент ажиллахгүй (React байхгүй) — тэнд n8n нь
 * ижил өгөгдлөөр Messenger generic template угсарна. Үр дүн нь ижил:
 * зураг + гарчиг + тайлбар + «Үзэх» товч.
 */
export interface ChatLinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

export function LinkPreviewCard({
  data,
  className,
}: {
  data: ChatLinkPreview | null | undefined;
  /** Админд нарийн (max-w-xs), вэб чатад бүтэн өргөн */
  className?: string;
}) {
  /* ⚠️ Гарчиг ч зураг ч байхгүй бол карт утгагүй — линк текст хэвээр */
  if (!data || (!data.title && !data.image)) return null;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      /* ⚠️ Чатын мессеж дээр дарах үйлдэлтэй зөрчихгүй */
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'mt-1.5 block overflow-hidden rounded-xl border border-foreground/12 bg-foreground/5 transition-colors hover:border-primary/50 hover:bg-foreground/8',
        className,
      )}
    >
      {data.image && (
        /* ⚠️ next/image БИШ — shared пакет нь Next.js-ээс хамаарахгүй,
           мөн OG зураг гадаад домэйнаас ирнэ (FB webview-д ч ажиллана) */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.image}
          alt={data.title ?? ''}
          loading="lazy"
          referrerPolicy="no-referrer"
          /* OG стандарт харьцаа 1200×630 */
          className="aspect-[1200/630] w-full object-cover"
        />
      )}
      <div className="px-3 py-2">
        {data.siteName && (
          <p className="text-[10px] uppercase tracking-wide text-foreground/45">
            {data.siteName}
          </p>
        )}
        {data.title && (
          <p className="line-clamp-2 text-xs font-semibold text-foreground">{data.title}</p>
        )}
        {data.description && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-foreground/60">{data.description}</p>
        )}
      </div>
    </a>
  );
}
