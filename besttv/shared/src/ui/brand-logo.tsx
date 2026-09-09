'use client';

import { cn } from '../lib/utils';

/**
 * Сайтын лого — админаас удирдагдана (BestTV | BestFilm).
 *
 * `logoUrl` өгвөл зураг, эс бөгөөс "Best**TV**" текст fallback.
 * ⚠️ next/image ХЭРЭГЛЭХГҮЙ — shared багц нь Next-ээс хамааралгүй байх ёстой
 * (admin болон frontend хоёулаа импортолдог). Лого нь жижиг PNG тул
 * оптимизаци шаардлагагүй.
 */
export function BrandLogo({
  logoUrl,
  logoLightUrl,
  /**
   * ⚠️ Анхны утга нь `'BestTV'` — BestFilm-ийн bundle-д ч шигтгэгддэг
   * (хэрэглэгчид харагдахгүй, бүх дуудагч тодорхой дамжуулдаг).
   * Хоосон болговол лого огт харагдахгүй болох тул ҮЛДЭЭВ.
   */
  siteName = 'BestTV',
  className,
  imgClassName,
  /** Текст fallback-ийн хэмжээ */
  textSize = 'text-2xl',
}: {
  /** ⚠️ БАРААН (dark) горимын лого — хуучин нэр, өгөгдмөл */
  logoUrl?: string | null;
  /**
   * ⚠️ ГЭРЭЛ (light) горимын лого. Өгөөгүй бол `logoUrl` хоёуланд
   * хэрэглэгдэнэ — өмнөх зан төлөв ЯГ ХЭВЭЭР.
   */
  logoLightUrl?: string | null;
  siteName?: string;
  className?: string;
  imgClassName?: string;
  textSize?: string;
}) {
  if (logoUrl) {
    const imgCls = cn('h-8 w-auto object-contain', imgClassName, className);

    /**
     * ⚠️⚠️ ХОЁР ЛОГО — DARK/LIGHT АВТОМАТ СОЛИГДОНО.
     *
     * ЯАГААД `useTheme()` БИШ, CSS ВЭ:
     *
     * `next-themes`-ийн `resolvedTheme` нь ЭХНИЙ рендерт `undefined`.
     * Тиймээс JS-ээр сонговол:
     *   1. Сервер лого-г сонгож чадахгүй → нэг нь шатаагдана
     *   2. Client hydrate болоход НӨГӨӨ нь солигдоно → ЛОГО АНИВЧИНА
     *
     * БОДИТ АЛДАА: `useBrand()` нь client талд татдаг тул эхний
     * рендерт лого байхгүй → текст гарч, API ирэхэд зураг болж
     * СОЛИГДДОГ байв. Хэрэглэгч refresh бүрт «үсрэхийг» харна.
     *
     * ШИЙДЭЛ: ХОЁУЛАНГ нь зэрэг рендерлээд CSS-ээр нэгийг нь нуух.
     * Hydration зөрүү БАЙХГҮЙ, анивчихгүй.
     *
     * ⚠️⚠️ `light:` Tailwind VARIANT БАЙХГҮЙ (батлагдсан — CSS-д
     * үүсээгүй). Зөвхөн `dark:` бий. Тиймээс өөрийн класс
     * (`brand-logo-dark` / `brand-logo-light`) + `globals.css` дүрэм.
     *
     * ⚠️ ӨГӨГДМӨЛ нь DARK — `defaultTheme="dark"` тул серверийн HTML
     * (`.dark`/`.light` класс хараахан байхгүй) дээр зөв лого гарна.
     *
     * ⚠️ `logoLightUrl` байхгүй бол НЭГ зураг л рендерлэнэ — илүүдэл
     * татаж авалт үүсгэхгүй, өмнөх зан төлөвтэй ЯГ ИЖИЛ.
     */
    if (!logoLightUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={siteName} className={imgCls} loading="eager" />
      );
    }

    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={siteName}
          className={cn('brand-logo-dark', imgCls)}
          loading="eager"
        />
        {/* ⚠️ `aria-hidden` — дэлгэц уншигч НЭГ л удаа сайтын нэрийг хэлнэ */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoLightUrl}
          alt=""
          aria-hidden
          className={cn('brand-logo-light', imgCls)}
          loading="eager"
        />
      </>
    );
  }

  /**
   * Лого тохируулаагүй үед — брэндийн текст.
   *
   * ⚠️⚠️ ХОЁР ХЭСЭГТ ХУВААНА — «Best|TV», «Best|Film» гэх мэт.
   *
   * ⛔ БОДИТ АЛДАА (2026-09-09 аудит): `split(/(?=TV$)/)` нь ЗӨВХӨН
   * «TV»-ээр төгссөн нэрийг хуваадаг байв. «BestFilm» → `['BestFilm']`,
   * `rest=[]` → бүхэлдээ цагаан, улаан өнгө ОГТ гарахгүй.
   *
   * ⚠️ Одоо `Best` угтварыг таньж хуваана — «BestTV», «BestFilm»,
   * ирээдүйн «BestXxx» бүгд ажиллана. Танихгүй нэр бол бүхэлдээ
   * цагаан (өмнөх зан төлөвтэй ижил).
   *
   * ⚠️ Энэ нь ЗӨВХӨН fallback — хоёр сайтад `logoUrl` тохируулагдсан
   * тул хэвийн үед хүрдэггүй. Лого уствал/R2 унавал л харагдана.
   */
  const m = /^(Best)(.+)$/i.exec(siteName);
  const [first, second] = m ? [m[1], m[2]] : [siteName, ''];
  return (
    <span className={cn('font-black tracking-tight', textSize, className)}>
      {/* ⚠️ `text-white` БИШ — гэрэл горимд цагаан текст УУСНА.
          `text-foreground` нь горим бүрд эсрэг өнгийг өгнө. */}
      <span className="text-foreground">{first}</span>
      {second && <span className="text-primary">{second}</span>}
    </span>
  );
}
