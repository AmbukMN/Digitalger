import { HomeClient } from './home-client';

/**
 * ⚠️⚠️ НҮҮР ХУУДАС — SERVER WRAPPER. `'use client'` БҮҮ нэм.
 *
 * БОДИТ АЛДАА: энэ файл өмнө нь бүхэлдээ `'use client'` байсан тул Next
 * нь нүүрийг БҮРЭН СТАТИК болгож, root `layout.tsx`-ийн meta tag-уудыг
 * HTML-д ШАТААЖ бичдэг байв. `docker build` явах үед backend контейнер
 * сүлжээнд БАЙХГҮЙ тул `/api/seo` fetch унаж, кодын анхдагч og зураг
 * шатсан — админ панелиас Open Graph зураг тохируулсан ч Facebook-д
 * ХУУЧИН зураг л гардаг байсан (дахин build хийхээс нааш арилахгүй).
 *
 * ⚠️ `revalidate`-г `'use client'` файлаас экспортлож БОЛОХГҮЙ — Next
 *    build үед «Invalid revalidate value ... revalidate is on the client»
 *    гэж унана. Тиймээс server wrapper ЗААВАЛ хэрэгтэй.
 *
 * Контент нь client талд `useHome()`-оор татагддаг тул энэ тоо нь
 * ЗӨВХӨН meta tag-д нөлөөлнө — хуудасны хурдад НӨЛӨӨЛӨХГҮЙ.
 */
export const revalidate = 300;

export default function HomePage() {
  return <HomeClient />;
}
