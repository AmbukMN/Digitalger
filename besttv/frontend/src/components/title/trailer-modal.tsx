'use client';

import { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { VideoPlayer } from '@/components/video-player';

export function TrailerModal({
  titleId,
  /**
   * ⚠️ YouTube трейлерийн key — МАНАЙ HLS трейлер БАЙХГҮЙ үед л backend
   * үүнийг илгээнэ (хоёулаа байвал HLS давуу: өөрийн CDN, зар байхгүй).
   */
  youtubeKey,
  onClose,
}: {
  titleId: string;
  youtubeKey?: string | null;
  onClose: () => void;
}) {
  /**
   * ⚠️⚠️ iOS: ХААХААС ӨМНӨ POINTER EVENT-ИЙГ ТАСЛАНА.
   *
   * БОДИТ АЛДАА (ErrorLog, 93 удаа, 100% iPhone): модал хаагдахад
   * React плеерийг ШУУД устгадаг ч WebKit нь `pointercancel`/
   * `touchend`-ийг ТҮҮНИЙ ДАРАА илгээж, Vidstack-ийн slider устсан
   * props руу хандан `t is not a function` гэж унадаг.
   *
   * `video-player.tsx`-ийн unmount дахь `pause()` нь давтамжийг
   * бууруулсан ч арилгаагүй — тэр нь Rеact устгаж ЭХЭЛСЭН хойно
   * ажилладаг тул хэт ОРОЙТДОГ.
   *
   * Энд харин хаах ШИЙДВЭР гармагц (React мэдэхээс ӨМНӨ) савны
   * pointer event-ийг таслана — хоцорсон touch дотогш ОРОХГҮЙ.
   */
  const boxRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    const el = boxRef.current;
    if (el) el.style.pointerEvents = 'none';
    onClose();
  }, [onClose]);

  useEffect(() => {
    /* ⚠️ `e.key` БАЙХГҮЙ БАЙЖ БОЛНО — өргөтгөл/автобөглөх нь `key`-гүй
       хиймэл KeyboardEvent илгээдэг (`content-protection.tsx` тайлбар) */
    const onKey = (e: KeyboardEvent) => {
      if (typeof e.key === 'string' && e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [close]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Трейлер"
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4"
      onClick={close}
    >
      <button
        onClick={close}
        aria-label="Хаах"
        className="absolute right-4 top-4 rounded-full bg-foreground/10 p-2 text-foreground hover:bg-foreground/20"
      >
        <X size={22} />
      </button>
      <div ref={boxRef} className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        {youtubeKey ? (
          /*
            ⚠️ YOUTUBE НӨӨЦ ХУВИЛБАР — манай HLS трейлер байхгүй үед.
            ⚠️ `youtube-nocookie.com` — хэрэглэгчийг мөрдөх cookie тавихгүй
               (GDPR-д ээлтэй, YouTube-ийн албан ёсны private горим).
            ⚠️ `aspect-video` — модал доторх өндөр тогтмол байлгана,
               эс бөгөөс iframe 0px өндөртэй гарч ХООСОН харагдана.
          */
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&rel=0&modestbranding=1`}
              title="Трейлер"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <VideoPlayer src={`/api/stream/trailer/${titleId}/playlist.m3u8`} />
        )}
      </div>
    </div>
  );
}
