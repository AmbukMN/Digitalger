'use client';

/**
 * АНГИЙН THUMBNAIL — эвдэрсэн үед ӨӨРӨӨ СЭРГЭЭНЭ.
 *
 * ⚠️⚠️ БОДИТ АЛДАА: хөрвүүлэлтийн үед постер нь R2 руу байршиж
 * чадаагүй тохиолдол гардаг (сүлжээ тасрах, түр алдаа). DB-д зам
 * үлдсэн ч файл БАЙХГҮЙ тул хэрэглэгчид эвдэрсэн зураг харагдана
 * (Spartacus E01, «Аймаар хайр» E01 — бодитоор олдсон).
 *
 * Админ гараар `posters/backfill` ажиллуулах хүртэл эвдэрхий байдаг
 * байв. Одоо: зураг унамагц backend-ээс сэргээхийг хүсээд, шинэ
 * зургийг тавина — хэрэглэгч юу ч хийхгүйгээр засагдана.
 *
 * ⚠️ НЭГ Л УДАА оролдоно. Дахин унавал дугаар харуулна — эс бөгөөс
 * эвдэрсэн ангид хандах бүрд ffmpeg дуудагдана.
 */

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@besttv/shared';
import { api } from '@/lib/api';

export function EpisodeThumb({
  episodeId,
  posterUrl,
  number,
  dim,
  className,
}: {
  episodeId: string;
  posterUrl?: string | null;
  number: number;
  /** Түгжээтэй ангид бүдгэрүүлнэ */
  dim?: boolean;
  className?: string;
}) {
  const [src, setSrc] = useState(posterUrl ?? null);
  const [tried, setTried] = useState(false);
  const [failed, setFailed] = useState(false);

  const repair = async () => {
    /* ⚠️ Нэг л удаа — давтвал ffmpeg дэмий ажиллана */
    if (tried) {
      setFailed(true);
      return;
    }
    setTried(true);
    try {
      const r = await api<{ status: string; posterUrl?: string }>(
        `/stream/episode/${episodeId}/poster/repair`,
        { method: 'POST' },
      );
      if (r.posterUrl) {
        setSrc(r.posterUrl);
        setFailed(false);
        return;
      }
      setFailed(true);
    } catch {
      /* ⚠️ Сэргээж чадаагүй ч UI эвдрэхгүй — дугаар харуулна */
      setFailed(true);
    }
  };

  /* Зураггүй / сэргээж чадаагүй → дугаар (аль анги болох нь мэдэгдэнэ) */
  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-foreground/10 text-sm font-bold text-foreground/45',
          className,
        )}
      >
        {number}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={`${number}-р анги`}
      fill
      sizes="112px"
      /* ⚠️ Түлхүүр — `src` солигдоход React элементийг ДАХИН үүсгэнэ.
         Эс бөгөөс browser хуучин алдааны төлөвөө хадгална. */
      key={src}
      onError={repair}
      className={cn('object-cover', dim && 'brightness-75', className)}
    />
  );
}
