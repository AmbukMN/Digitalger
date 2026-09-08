import { BRAND } from '@/lib/brand';

/**
 * ⚠️⚠️ BESTFILM ЛОГО — DARK/LIGHT ХОЁУЛАА.
 *
 * ЯАГААД ТУСДАА КОМПОНЕНТ ВЭ:
 *
 * `@besttv/shared`-ийн `BrandLogo` нь НЭГ зураг авдаг. BestFilm-ийн
 * лого нь горимоор ӨӨР:
 *   dark  — «best» МӨНГӨЛӨГ (хар дэвсгэр дээр уншигдана)
 *   light — «best» ХАР      (цагаан дэвсгэр дээр уншигдана)
 *
 * Нэг логог хоёр горимд тавибал нэг нь ҮЛ ҮЗЭГДЭНЭ.
 *
 * ⚠️⚠️ ЯАГААД `useTheme()` БИШ, CSS ВЭ:
 *
 * `next-themes`-ийн `resolvedTheme` нь ЭХНИЙ рендерт `undefined`.
 * Тиймээс:
 *   1. Сервер нь лого-г сонгож чадахгүй → нэг нь шатаагдана
 *   2. Client hydrate болоход НӨГӨӨ нь солигдоно → ЛОГО АНИВЧИНА
 *
 * БОДИТ АЛДАА (BestTV-д тохиолдсон): `useBrand()` нь client талд
 * татдаг тул эхний рендерт лого байхгүй → текст гарч, API ирэхэд
 * зураг болж СОЛИГДДОГ байв. Хэрэглэгч refresh бүрт «үсрэхийг» харна.
 *
 * ШИЙДЭЛ: ХОЁУЛАНГ нь зэрэг рендерлээд CSS-ээр нэгийг нь нуух.
 * Hydration зөрүү БАЙХГҮЙ, анивчихгүй.
 *
 * ⚠️⚠️ `light:` VARIANT БАЙХГҮЙ (батлагдсан — CSS-д үүсээгүй).
 * Tailwind-д зөвхөн `dark:` бий. Тиймээс өөрийн класс
 * (`bf-logo-dark` / `bf-logo-light`) + `globals.css`-ийн дүрэм.
 *
 * ⚠️ ӨГӨГДМӨЛ нь DARK — `defaultTheme="dark"` тул серверийн HTML
 * (`.dark` класс хараахан байхгүй) дээр зөв лого харагдана.
 *
 * ⚠️ `loading="eager"` + `fetchPriority="high"` — лого нь LCP-д
 * ордог тул хойшлуулж болохгүй.
 */
export function BestFilmLogo({ className = 'h-7 w-auto sm:h-9' }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND.logo.dark}
        alt={BRAND.name}
        className={`bf-logo-dark object-contain ${className}`}
        loading="eager"
        fetchPriority="high"
      />
      {/* ⚠️ `aria-hidden` — дэлгэц уншигч НЭГ л удаа «BestFilm» гэж хэлнэ */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND.logo.light}
        alt=""
        aria-hidden
        className={`bf-logo-light object-contain ${className}`}
        loading="eager"
      />
    </>
  );
}
