'use client';

import { useState, useCallback } from 'react';
import Image, { type ImageProps } from 'next/image';
import { ImageOff } from 'lucide-react';
import { cn } from '@digitalger/shared';
import { BLUR_DATA_URL } from '@/lib/image-blur';

/**
 * SmartImage — контент зураг (banner, blog cover, product thumbnail) найдвартай
 * харуулах next/image wrapper.
 *
 * ⚠️ Шийдэж буй асуудал (хэрэглэгчийн SS5/SS6):
 *  - R2/optimizer удаан эсвэл timeout болоход зураг ОГТ ИРЭХГҮЙ гацдаг байсан.
 *    onError дээр cache-busting query (?r=1, ?r=2)-аар 2 удаа ДАХИН оролддог
 *    (network/optimizer түр асуудлыг даван туулна).
 *  - 2 retry-ийн дараа ч ачаалагдахгүй бол ЦАГААН хоосон биш, тодорхой
 *    "зураггүй" fallback (icon) харуулна — UX-д гацсан мэдрэмж төрүүлэхгүй.
 *  - blur placeholder default-аар орно (CLS багасгана).
 *
 * fill эсвэл width/height аль алийг дэмжинэ (next/image-тэй ижил API).
 */
type SmartImageProps = Omit<ImageProps, 'onError' | 'placeholder'> & {
  /** Fallback (ачаалж чадаагүй) үед харуулах wrapper className */
  fallbackClassName?: string;
  /** retry-ийн дээд тоо (default 2) */
  maxRetries?: number;
};

export function SmartImage({
  src,
  alt,
  className,
  fallbackClassName,
  maxRetries = 2,
  fill,
  width,
  height,
  sizes,
  priority,
  ...rest
}: SmartImageProps) {
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);

  const handleError = useCallback(() => {
    setRetry((r) => {
      if (r < maxRetries) return r + 1;
      setFailed(true);
      return r;
    });
  }, [maxRetries]);

  // Fallback — бүх retry амжилтгүй болсон
  if (failed || !src) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted text-muted-foreground',
          fill ? 'absolute inset-0 h-full w-full' : '',
          fallbackClassName,
          className,
        )}
        style={!fill && width && height ? { width, height } : undefined}
        role="img"
        aria-label={typeof alt === 'string' ? alt : 'Зураг ачаалж чадсангүй'}
      >
        <ImageOff className="h-1/4 max-h-8 min-h-5 w-auto opacity-40" />
      </div>
    );
  }

  // retry > 0 үед cache-busting query нэмж дахин fetch хийлгэнэ.
  // (string src дээр л — StaticImport дээр алгасна)
  const resolvedSrc =
    retry > 0 && typeof src === 'string'
      ? `${src}${src.includes('?') ? '&' : '?'}r=${retry}`
      : src;

  return (
    <Image
      // retry бүрд key солигдож зургийг бүрэн дахин mount хийнэ
      key={retry}
      src={resolvedSrc}
      alt={alt}
      className={className}
      placeholder="blur"
      blurDataURL={BLUR_DATA_URL}
      onError={handleError}
      {...(fill ? { fill: true } : { width, height })}
      sizes={sizes}
      priority={priority}
      {...rest}
    />
  );
}
