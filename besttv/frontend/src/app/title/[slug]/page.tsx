import { permanentRedirect } from 'next/navigation';

/**
 * ⚠️ ХУУЧИН ЗАМ — `/title/:slug` нь `/movie/:slug` болж өөрчлөгдсөн.
 *
 * Гадаад талд тархсан холбоосууд (чатбот, сошиал хуваалцалт, Google index)
 * эвдрэхгүйн тулд 308 permanent redirect үлдээв. Шинэ холбоос үүсгэхдээ
 * ЗААВАЛ `/movie/...` ашиглана.
 */
export default async function LegacyTitleRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/movie/${slug}`);
}
