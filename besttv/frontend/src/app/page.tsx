import { HomeClient } from './home-client';
import { SERVER_API_URL } from '@/lib/server-api';
import type { HomeData } from '@/lib/queries';

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

/**
 * ⚠️ ЗОЧНЫ нүүрийг сервер талд татна (`revalidate` кэштэй тул нэмэлт
 * зардал бага). Унавал `undefined` буцаана — client хуучнаараа татна.
 */
async function fetchHome(): Promise<HomeData | undefined> {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/titles/home`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return undefined;
    return (await res.json()) as HomeData;
  } catch {
    return undefined;
  }
}

export default async function HomePage() {
  const initial = await fetchHome();
  return <HomeClient initial={initial} />;
}
