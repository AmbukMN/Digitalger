'use client';

import { cn } from '../lib/utils';

/**
 * BestTV лого — админаас удирдагдана.
 *
 * `logoUrl` өгвөл зураг, эс бөгөөс "Best**TV**" текст fallback.
 * ⚠️ next/image ХЭРЭГЛЭХГҮЙ — shared багц нь Next-ээс хамааралгүй байх ёстой
 * (admin болон frontend хоёулаа импортолдог). Лого нь жижиг PNG тул
 * оптимизаци шаардлагагүй.
 */
export function BrandLogo({
  logoUrl,
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
  logoUrl?: string | null;
  siteName?: string;
  className?: string;
  imgClassName?: string;
  textSize?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={siteName}
        className={cn('h-8 w-auto object-contain', imgClassName, className)}
        loading="eager"
      />
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
      <span className="text-white">{first}</span>
      {second && <span className="text-primary">{second}</span>}
    </span>
  );
}
