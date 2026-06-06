'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

/**
 * Жагсаалтын карт дээрх видеог LAZY ачаална: зөвхөн дэлгэц дээр харагдах үед л
 * (IntersectionObserver) видеог ачаалж тоглуулна. Жагсаалтад 16-24 карт байх тул
 * бүгдийг зэрэг autoplay хийвэл bandwidth/CPU/battery (ялангуяа mobile) хүндэрнэ.
 * Харагдахгүй байх үед poster (thumbnail) зураг харуулна.
 */
export function LazyCardVideo({
  videoUrl,
  posterUrl,
  alt,
}: {
  videoUrl: string;
  posterUrl?: string | null;
  alt: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* Poster зураг — видео ачааллахаас өмнө/харагдахгүй үед (CLS-гүй) */}
      {posterUrl && !visible && (
        <Image src={posterUrl} alt={alt} fill className="object-cover" sizes="(max-width: 768px) 50vw, 20vw" />
      )}
      <video
        ref={ref}
        src={visible ? videoUrl : undefined}
        poster={posterUrl ?? undefined}
        muted
        loop
        playsInline
        preload="none"
        className="h-full w-full object-cover"
      />
    </>
  );
}
