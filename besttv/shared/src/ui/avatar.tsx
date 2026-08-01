'use client';

import { useState } from 'react';
import { cn } from '../lib/utils';

/**
 * Avatar — хэрэглэгчийн профайл зураг найдвартай харуулах нэгдсэн компонент.
 *
 * ⚠️ Яагаад next/image БИШ raw <img>:
 *  - Avatar URL нь OAuth CDN (Google lh3, Facebook fbcdn) эсвэл R2 — эдгээрийг
 *    next/image optimizer (/_next/image) сервер дээр дахин fetch+optimize хийхэд
 *    хуучин/удаан утсан дээр, ялангуяа Facebook in-app browser-д timeout болж
 *    ЦАГААН/БӨӨРӨНХИЙ ХООСОН дүрс үлддэг (SS3-ийн алдаа).
 *  - Жижиг (32-40px) зурагт optimize бараг ач холбогдолгүй.
 *
 * Найдвартай байдал:
 *  - src байхгүй ЭСВЭЛ ачаалж чадаагүй (onError) → нэрийн эхний үсэгтэй fallback.
 *  - referrerPolicy="no-referrer" — Google/FB зарим avatar referrer шалгаж 403
 *    буцаадаг тул заавал хэрэгтэй.
 *  - loading="lazy" + decoding="async" — scroll доорх avatar хойшлуулна.
 */
export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  /** Пиксел хэмжээ (өргөн=өндөр). default 40 */
  size?: number;
  className?: string;
  /** Дээд талд (header) бол eager ачаална */
  priority?: boolean;
}

export function Avatar({ src, name, size = 40, className, priority }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initial = (name?.trim()?.charAt(0) || 'U').toUpperCase();
  const showImg = src && !failed;

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold',
        className,
      )}
      // ⚠️ Өнгийг INLINE HEX-ээр өгнө (Tailwind-ийн bg-primary/15 opacity нь
      // хуучин iOS Safari дээр унаж, navy дугуй дээр navy үсэг = ҮЛ ҮЗЭГДЭХ
      // "хоосон цэнхэр дугуй" болдог байсан). Gold дэвсгэр + navy үсэг —
      // ямар ч браузерт уншигдана, brand өнгөтэй.
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.4)),
        backgroundColor: '#ffe9a6',
        color: '#022179',
      }}
      aria-hidden={!name}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? 'User'}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}
