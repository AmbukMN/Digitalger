'use client';

import { useEffect, useState } from 'react';
import { cn } from '@besttv/shared';

/**
 * Хэрэглэгчийн аватар — зураг байвал зураг, үгүй бол нэрийн эхний үсэг.
 *
 * ⚠️⚠️ ЯАГААД ТУСДАА КОМПОНЕНТ ВЭ: аватар нь хэрэглэгчийн жагсаалт,
 * дэлгэрэнгүй модал, чат гэсэн 3 газарт харагдана. Тус тусад нь бичвэл
 * нэг нь `onError` барихаа мартаад ХУГАРСАН ЗУРГИЙН дүрс гаргана.
 *
 * ⚠️ `onError` ЗААВАЛ: presigned URL нь ХУГАЦААТАЙ (2 цаг), FB/IG-ийн
 * `profile_pic` мөн адил. Хугацаа дуусахад зөөлөн байдлаар үсэг рүү
 * буулгана — хэрэглэгч эвдэрсэн мэт харахгүй.
 *
 * ⚠️ `next/image` ХЭРЭГЛЭХГҮЙ: эх сурвалж нь R2 presigned болон FB CDN
 * гэсэн ДИНАМИК домэйн тул `next.config` дээр бүртгэх боломжгүй.
 */
export function UserAvatar({
  src,
  name,
  email,
  size = 32,
  className,
}: {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  /* ⚠️ Хэрэглэгч солигдоход алдааны төлөв ЦЭВЭРЛЭГДЭНЭ — эс бөгөөс
     нэг зураг унасны дараа бусад бүх хэрэглэгч үсгээр харагдана
     (жагсаалтад нэг компонент дахин ашиглагдана) */
  useEffect(() => setFailed(false), [src]);

  const letter = (name?.[0] ?? email?.[0] ?? '?').toUpperCase();

  if (!src || failed) {
    return (
      <span
        style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary',
          className,
        )}
      >
        {letter}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name ?? email ?? 'Хэрэглэгч'}
      width={size}
      height={size}
      loading="lazy"
      /* ⚠️ FB CDN нь Referer шалгадаг — no-referrer байхгүй бол 403 */
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className={cn('shrink-0 rounded-full object-cover', className)}
    />
  );
}
