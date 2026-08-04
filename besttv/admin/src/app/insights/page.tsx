import { redirect } from 'next/navigation';

/**
 * ⚠️ ХУУЧИН ЗАМ — "Шинжилгээ" нь Хянах самбарын "Зан төлөв" таб болж
 * НЭГТГЭГДСЭН. Хадгалсан bookmark, хуучин линк эвдрэхгүйн тулд redirect.
 */
export default function InsightsRedirect() {
  redirect('/');
}
