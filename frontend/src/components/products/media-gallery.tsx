'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Play, ImageIcon, X, Maximize2 } from 'lucide-react';

interface MediaItem {
  id: string;
  url: string;
  alt: string | null;
  videoUrl?: string | null;
  isPrimary: boolean;
}

interface MediaGalleryProps {
  items: MediaItem[];
  title: string;
  thumbnailUrl?: string | null;
  mainVideoUrl?: string | null;
}

function isYouTube(url: string) {
  return /youtube\.com|youtu\.be/.test(url);
}

function isVimeo(url: string) {
  return /vimeo\.com/.test(url);
}

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return m ? m[1] : null;
}

function getVimeoId(url: string) {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

function VideoEmbed({ videoUrl, autoPlay, onEnded }: { videoUrl: string; autoPlay?: boolean; onEnded?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (autoPlay && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [autoPlay, videoUrl]);

  if (isYouTube(videoUrl)) {
    const id = getYouTubeId(videoUrl);
    if (id) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${id}?rel=0${autoPlay ? '&autoplay=1' : ''}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      );
    }
  }
  if (isVimeo(videoUrl)) {
    const id = getVimeoId(videoUrl);
    if (id) {
      return (
        <iframe
          src={`https://player.vimeo.com/video/${id}${autoPlay ? '?autoplay=1' : ''}`}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      );
    }
  }
  return (
    <video
      ref={videoRef}
      key={videoUrl}
      controls
      controlsList="nodownload nofullscreen noremoteplayback"
      disablePictureInPicture
      className="h-full w-full object-contain bg-black"
      onEnded={onEnded}
      playsInline
    >
      <source src={videoUrl} />
    </video>
  );
}

function ThumbnailItem({
  item,
  active,
  onClick,
}: {
  item: MediaItem;
  active: boolean;
  onClick: () => void;
}) {
  const isVideo = Boolean(item.videoUrl);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
        active
          ? 'border-primary shadow-sm scale-[1.03]'
          : 'border-border hover:border-primary/50'
      }`}
    >
      {isVideo && item.videoUrl ? (
        <div className="relative flex h-full w-full items-center justify-center bg-black">
          <video
            src={`${item.videoUrl}#t=0.1`}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Play className="h-4 w-4 text-white fill-white/80 drop-shadow" />
          </div>
        </div>
      ) : item.url ? (
        <Image
          src={item.url}
          alt={item.alt ?? ''}
          fill
          className="object-cover"
          sizes="80px"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </button>
  );
}

function Lightbox({
  items,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const item = items[index];
  const isVideo = Boolean(item?.videoUrl);
  const count = items.length;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Media viewer */}
      <div
        className="relative flex max-h-[90vh] max-w-[90vw] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo && item.videoUrl ? (
          <div className="h-[80vh] w-[85vw] max-w-4xl">
            <VideoEmbed videoUrl={item.videoUrl} onEnded={onNext} />
          </div>
        ) : item?.url ? (
          <div className="relative max-h-[85vh] max-w-[85vw]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={item.alt ?? ''}
              className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl"
            />
          </div>
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-xl bg-muted">
            <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Хаах"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Prev / Next */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Өмнөх"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Дараах"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Counter */}
      {count > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {items.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MediaGallery({ items, title, thumbnailUrl, mainVideoUrl }: MediaGalleryProps) {
  const allItems: MediaItem[] = (() => {
    if (items.length > 0) return items;
    const fallbacks: MediaItem[] = [];
    if (mainVideoUrl) {
      fallbacks.push({ id: '__video__', url: '', alt: title, videoUrl: mainVideoUrl, isPrimary: false });
    }
    if (thumbnailUrl) {
      fallbacks.push({ id: '__thumb__', url: thumbnailUrl, alt: title, videoUrl: null, isPrimary: true });
    }
    return fallbacks;
  })();

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const count = allItems.length;

  const prev = useCallback(() => setActiveIndex((i) => (i - 1 + count) % count), [count]);
  const next = useCallback(() => setActiveIndex((i) => (i + 1) % count), [count]);

  const openLightbox = useCallback((idx: number) => {
    setActiveIndex(idx);
    setLightboxOpen(true);
  }, []);

  if (count === 0) {
    if (thumbnailUrl) {
      return (
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-muted">
          <Image src={thumbnailUrl} alt={title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 60vw" />
        </div>
      );
    }
    return null;
  }

  const active = allItems[activeIndex];
  const isActiveVideo = Boolean(active?.videoUrl);

  return (
    <>
      <div className="space-y-3">
        {/* Main viewer */}
        <div className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-muted">
          {isActiveVideo && active.videoUrl ? (
            <VideoEmbed videoUrl={active.videoUrl} autoPlay onEnded={next} />
          ) : active?.url ? (
            <Image
              src={active.url}
              alt={active.alt ?? title}
              fill
              className="object-cover cursor-zoom-in"
              priority
              sizes="(max-width: 768px) 100vw, 60vw"
              onClick={() => openLightbox(activeIndex)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-12 w-12 opacity-30" />
            </div>
          )}

          {/* Fullscreen button (images only) */}
          {!isActiveVideo && active?.url && (
            <button
              type="button"
              onClick={() => openLightbox(activeIndex)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 opacity-0 shadow backdrop-blur-sm transition-all group-hover:opacity-100 hover:bg-background"
              aria-label="Томруулах"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 shadow backdrop-blur-sm transition-colors hover:bg-background"
                aria-label="Өмнөх"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 shadow backdrop-blur-sm transition-colors hover:bg-background"
                aria-label="Дараах"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {allItems.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === activeIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/60'
                    }`}
                    aria-label={`${i + 1}-р зураг`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail grid */}
        {count > 1 && (
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {allItems.map((item, i) => (
              <ThumbnailItem
                key={item.id}
                item={item}
                active={i === activeIndex}
                onClick={() => setActiveIndex(i)}
              />
            ))}
          </div>
        )}
      </div>

      {lightboxOpen && (
        <Lightbox
          items={allItems}
          index={activeIndex}
          onClose={() => setLightboxOpen(false)}
          onPrev={() => setActiveIndex((i) => (i - 1 + count) % count)}
          onNext={() => setActiveIndex((i) => (i + 1) % count)}
        />
      )}
    </>
  );
}
