'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Play, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { helpApi, type HelpVideoItem } from '@/lib/api';
import { getSessionId as getAnalyticsSessionId } from '@/lib/analytics';

// YouTube ID задлах
function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// R2 видео — .m3u8 (HLS) бол hls.js, mp4 шууд. Чанар хадгална (segment stream).
// ⚠️ aspect ХАТУУ заахгүй — босоо (mobile) ба хэвтээ (desktop) видео бодит
// харьцаагаараа харагдана (object-contain). maxHeight-ийг lightbox өгнө.
function HlsVideo({ src, poster, title }: { src: string; poster?: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const isHls = /\.m3u8($|\?)/i.test(src);
  useEffect(() => {
    const video = ref.current;
    if (!video || !isHls) return;
    if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = src; return; }
    let hls: import('hls.js').default | null = null;
    let cancelled = false;
    import('hls.js').then((mod) => {
      if (cancelled) return;
      const Hls = mod.default;
      if (Hls.isSupported()) { hls = new Hls({ enableWorker: true }); hls.loadSource(src); hls.attachMedia(video); }
      else video.src = src;
    });
    return () => { cancelled = true; if (hls) hls.destroy(); };
  }, [src, isHls]);
  return (
    <video
      ref={ref} src={isHls ? undefined : src} poster={poster} controls autoPlay playsInline
      controlsList="nodownload noplaybackrate" disablePictureInPicture
      className="max-h-[85dvh] w-full rounded-xl bg-black object-contain"
      title={title}
    />
  );
}

// Видео тоглуулагч (lightbox дотор) — эх сурвалжаар iframe/video
function VideoInner({ video }: { video: HelpVideoItem }) {
  if (video.videoStreamId) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe src={`https://iframe.videodelivery.net/${video.videoStreamId}?autoplay=true`}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen title={video.title} />
      </div>
    );
  }
  if (video.videoUrl) {
    const yt = youtubeId(video.videoUrl);
    if (yt) {
      return (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          <iframe src={`https://www.youtube.com/embed/${yt}?autoplay=1&rel=0`}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={video.title} />
        </div>
      );
    }
    return <a href={video.videoUrl} target="_blank" rel="noopener noreferrer"
      className="flex aspect-video w-full items-center justify-center rounded-xl bg-muted text-sm text-primary underline">Видео нээх &#8599;</a>;
  }
  if (video.videoKey) return <HlsVideo src={video.videoKey} poster={video.posterKey ?? undefined} title={video.title} />;
  return null;
}

/**
 * Бүтээгдэхүүний хуудасны заавар видео — thumbnail card, дарахад БҮТЭН ДЭЛГЭЦ
 * lightbox-д том player нээгдэнэ (background/X/Esc хаах). Үзэлт track хийнэ.
 */
export function ProductHelpVideo({ video, userId }: { video: HelpVideoItem; userId?: string }) {
  const [open, setOpen] = useState(false);
  const trackedRef = useRef(false);
  // Thumbnail: poster, эс бол видео эхний frame
  const thumb = video.posterKey;
  const videoSrc = video.videoKey || video.videoUrl;

  const play = () => {
    setOpen(true);
    if (!trackedRef.current) {
      trackedRef.current = true;
      helpApi.trackVideoView(video.id, getAnalyticsSessionId() || undefined, userId, 'product');
    }
  };

  // Esc хаах
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* Thumbnail card */}
      <button onClick={play}
        className="group relative flex aspect-video w-full max-w-md items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border transition-shadow hover:shadow-lg">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={video.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : videoSrc ? (
          <video src={`${videoSrc}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ background: 'rgba(2,33,121,0.10)' }} />
        )}
        {/* Play товч (төвд) */}
        <span className="absolute inset-0 flex items-center justify-center transition-colors" style={{ background: 'rgba(0,0,0,0.25)' }}>
          <span className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg" style={{ background: '#022179' }}>
            <Play className="ml-1 h-6 w-6 fill-white" />
          </span>
        </span>
        {video.durationLabel && (
          <span className="absolute bottom-2 right-2 rounded px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ background: 'rgba(0,0,0,0.7)' }}>
            {video.durationLabel}
          </span>
        )}
      </button>

      {/* Lightbox — БҮТЭН ДЭЛГЭЦ том player */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <button onClick={() => setOpen(false)} aria-label="Хаах"
              className="absolute right-4 top-4 z-10 rounded-full p-2 text-white" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <X className="h-6 w-6" />
            </button>
            {/* ⚠️ Mobile (босоо видео) — нарийн өргөн, өндөр 90dvh давамгай.
                Desktop — ТОМ (max-w-5xl, дэлгэцээс хамаарч). Видео object-contain
                тул босоо/хэвтээ аль ч харьцаа бүтэн багтана. */}
            <motion.div
              className="flex max-h-[92dvh] w-full max-w-[min(95vw,28rem)] flex-col md:max-w-5xl"
              initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <VideoInner video={video} />
              <p className="mt-3 shrink-0 text-center text-base font-semibold text-white md:text-left">{video.title}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
