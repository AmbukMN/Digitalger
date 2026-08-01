'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from './auth-store';
import { loginUrl } from './auth-intent';

/** Play товч дарагдахад шаардлагатай хамгийн бага мэдээлэл */
export interface PlayTarget {
  slug: string;
  isPremium?: boolean;
  comingSoon?: boolean;
  /** MOVIE бол `streamStatus === 'READY'`; SERIES-д ангиас хамаарна */
  playable?: boolean;
  type?: 'MOVIE' | 'SERIES' | string;
}

/**
 * "Үзэх" товчны нэгдсэн шалгуур.
 *
 * ⚠️ Өмнө нь нүүр/картын play товч эрх шалгалгүй ШУУД `/watch/...` руу
 * шиддэг байсан → нэвтрээгүй хэрэглэгч хоосон плеер дээр гацдаг, төлбөртэй
 * кино ч нээгддэг мэт харагддаг байсан. Одоо БҮХ play цэг энэ hook-оор дамжина:
 *
 *   1. Удахгүй гарах / видео бэлэн биш → дэлгэрэнгүй рүү, тайлбартай
 *   2. Төлбөртэй + нэвтрээгүй → нэвтрэх (буцах зам хадгална)
 *   3. Төлбөртэй + нэвтэрсэн ч эрхгүй → дэлгэрэнгүй рүү (тэнд түрээс/багц сонголт)
 *   4. Бүх шалгуур давсан → /watch
 */
export function usePlayGuard() {
  const router = useRouter();
  const { user } = useAuth();

  /**
   * @param t тухайн контент
   * @param hasAccess дэлгэрэнгүйгээс ирсэн бодит эрх (мэдэгдэхгүй бол undefined)
   */
  return (t: PlayTarget, hasAccess?: boolean) => {
    const detailHref = `/movie/${t.slug}`;

    if (t.comingSoon) {
      toast.info('Энэ контент удахгүй гарна');
      router.push(detailHref);
      return;
    }

    // MOVIE-д видео бэлэн эсэхийг шалгана (SERIES-д playable ирэхгүй)
    if (t.type === 'MOVIE' && t.playable === false) {
      toast.info('Видео бэлтгэгдэж байна');
      router.push(detailHref);
      return;
    }

    if (t.isPremium) {
      if (!user) {
        toast.info('Энэ контентыг үзэхэд нэвтэрнэ үү');
        router.push(loginUrl(detailHref));
        return;
      }
      // hasAccess мэдэгдэхгүй (картаас дарсан) бол дэлгэрэнгүй рүү — тэнд
      // backend-ийн бодит эрх шалгагдаж, түрээс/багцын сонголт харагдана
      if (hasAccess !== true) {
        router.push(detailHref);
        return;
      }
    }

    router.push(`/watch/${t.slug}`);
  };
}
