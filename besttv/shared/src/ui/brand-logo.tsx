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

  // Лого тохируулаагүй үед — брэндийн текст
  const [first, ...rest] = siteName.split(/(?=TV$)/);
  return (
    <span className={cn('font-black tracking-tight', textSize, className)}>
      <span className="text-white">{first}</span>
      {rest.length > 0 && <span className="text-primary">{rest.join('')}</span>}
    </span>
  );
}
