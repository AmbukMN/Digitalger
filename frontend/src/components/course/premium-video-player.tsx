'use client';

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronRight,
  Gauge,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCw,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type HlsType from 'hls.js';
import { cn } from '@digitalger/shared';

/**
 * Premium custom video player (DigitalGer).
 *
 * Дэмжих эх сурвалж:
 *  - type='stream'   → Cloudflare HLS manifest (signed) → hls.js (dynamic import)
 *  - type='r2'       → presigned mp4 → <video src> шууд
 *  - type='external' → YouTube/Vimeo → responsive iframe (тэдний player)
 *
 * Зөвхөн stream/r2 үед custom controls (seek/volume/speed/fullscreen/PiP/keyboard)
 * ажиллана. External үед энгийн embed.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Секундийг "12:32" эсвэл "1:02:05" болгож хувиргах */
function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/** YouTube/Vimeo URL → embed URL (external player) */
function getEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s?]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const SAVE_THROTTLE_SEC = 10;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PremiumVideoSource {
  type: 'stream' | 'r2' | 'external';
  url?: string;
  hlsUrl?: string;
  iframeUrl?: string;
}

export interface PremiumVideoPlayerProps {
  source: PremiumVideoSource;
  poster?: string;
  /** Continue watching — энэ секундээс үргэлжлүүлэх */
  resumeFrom?: number;
  title?: string;
  /** 10 сек тутам + pause/seek/ended үед дуудагдана */
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onReady?: (duration: number) => void;
  /** Next lesson autoplay toggle (UI-д харагдана) */
  autoPlayNext?: boolean;
  /** Дараагийн хичээл рүү шилжих */
  onNext?: () => void;
}

// Vendor-prefixed (iOS Safari, webkit fullscreen) хэлбэрүүд
interface WebkitVideo extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
  webkitSetPresentationMode?: (mode: string) => void;
}
interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
}
interface WebkitFullscreenContainer extends HTMLDivElement {
  webkitRequestFullscreen?: () => void;
}

// ─── Custom range (seek / volume) ─────────────────────────────────────────────
// shadcn Slider байхгүй тул хөнгөн, fully-controlled custom range ашиглав.

interface RangeProps {
  value: number; // 0..1
  buffered?: number; // 0..1 (seek bar дээр buffered давхарга)
  onChange: (v: number) => void;
  onScrub?: (active: boolean) => void;
  onHover?: (v: number | null) => void;
  className?: string;
  trackClassName?: string;
  ariaLabel: string;
}

function CustomRange({
  value,
  buffered = 0,
  onChange,
  onScrub,
  onHover,
  className,
  trackClassName,
  ariaLabel,
}: RangeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const pct = Math.max(0, Math.min(1, value));
  const bufPct = Math.max(0, Math.min(1, buffered));

  const valueFromEvent = useCallback((clientX: number): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      onScrub?.(true);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      onChange(valueFromEvent(e.clientX));
    },
    [onChange, onScrub, valueFromEvent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const v = valueFromEvent(e.clientX);
      if (draggingRef.current) onChange(v);
      onHover?.(v);
    },
    [onChange, onHover, valueFromEvent],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      onScrub?.(false);
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    },
    [onScrub],
  );

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
      tabIndex={-1}
      className={cn(
        'group/range relative flex h-4 cursor-pointer items-center touch-none select-none',
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => onHover?.(null)}
    >
      <div
        className={cn(
          'relative h-1 w-full overflow-hidden rounded-full bg-white/25 transition-all group-hover/range:h-1.5',
          trackClassName,
        )}
      >
        {/* buffered давхарга */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/30"
          style={{ width: `${bufPct * 100}%` }}
        />
        {/* played давхарга (brand gold) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#ffbe00]"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      {/* thumb */}
      <div
        className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffbe00] opacity-0 shadow ring-2 ring-black/20 transition-opacity group-hover/range:opacity-100"
        style={{ left: `${pct * 100}%` }}
      />
    </div>
  );
}

// ─── External (YouTube/Vimeo) embed ───────────────────────────────────────────

function ExternalPlayer({ url, title }: { url: string; title?: string }) {
  const embed = getEmbedUrl(url);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
      {embed ? (
        <iframe
          src={embed}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title ?? 'video'}
        />
      ) : (
        // Embed таних боломжгүй external mp4 → энгийн <video>
        <video
          src={url}
          className="absolute inset-0 h-full w-full"
          controls
          playsInline
          controlsList="nodownload"
          onContextMenu={(e) => e.preventDefault()}
        />
      )}
    </div>
  );
}

// ─── Toolbar icon button ──────────────────────────────────────────────────────

function IconBtn({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbe00]',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ─── Main player ──────────────────────────────────────────────────────────────

function PremiumVideoPlayerBase({
  source,
  poster,
  resumeFrom = 0,
  title,
  onProgress,
  onEnded,
  onReady,
  autoPlayNext = false,
  onNext,
}: PremiumVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(0);
  const resumeRef = useRef(resumeFrom);
  resumeRef.current = resumeFrom;

  // Callback-уудыг ref-ээр барина — listener-уудыг parent бүр render-д дахин
  // холбохгүйгээр хамгийн сүүлийн утгыг дуудна (stale closure-аас сэргийлнэ).
  const cbRef = useRef({ onProgress, onEnded, onReady });
  cbRef.current = { onProgress, onEnded, onReady };

  // External бол custom controls хэрэггүй
  const isExternal = source.type === 'external';

  // Playback state
  const [started, setStarted] = useState(false); // poster дарж эхэлсэн эсэх (lazy)
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false); // эх сурвалж ачаалж байна
  const [buffering, setBuffering] = useState(false); // waiting (re-buffer)
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [autoNext, setAutoNext] = useState(autoPlayNext);
  const [showResumeToast, setShowResumeToast] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);

  // ── PiP дэмжих эсэх (client дээр) ──
  useEffect(() => {
    if (typeof document !== 'undefined') {
      setPipSupported(!!(document as Document).pictureInPictureEnabled);
    }
  }, []);

  // ── Эх сурвалж ачаалах (hls.js dynamic import эсвэл шууд src) ──
  useEffect(() => {
    if (isExternal || !started) return;
    const video = videoRef.current;
    if (!video) return;

    let destroyed = false;
    setLoading(true);

    async function attach() {
      if (!video) return;
      // type='r2' эсвэл (stream боловч browser native HLS дэмждэг) → шууд src
      const nativeHls =
        video.canPlayType('application/vnd.apple.mpegurl') !== '';

      if (source.type === 'r2' && source.url) {
        video.src = source.url;
        return;
      }

      if (source.type === 'stream' && source.hlsUrl) {
        // Safari/iOS — native HLS
        if (nativeHls) {
          video.src = source.hlsUrl;
          return;
        }
        // бусад browser — hls.js (SSR-д import хийхгүй)
        const mod = await import('hls.js');
        const Hls = mod.default;
        if (destroyed) return;
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          hlsRef.current = hls;
          hls.loadSource(source.hlsUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (!data.fatal) return;
            // Fatal алдааны үед сэргээх оролдлого
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                hlsRef.current = null;
            }
          });
        } else if (nativeHls) {
          video.src = source.hlsUrl;
        }
      }
    }

    attach();

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [started, isExternal, source.type, source.url, source.hlsUrl]);

  // ── Video element-ийн event-үүд ──
  useEffect(() => {
    if (isExternal || !started) return;
    const video = videoRef.current;
    if (!video) return;

    const emitProgress = (force = false) => {
      const now = video.currentTime;
      if (force || now - lastSavedRef.current >= SAVE_THROTTLE_SEC) {
        lastSavedRef.current = now;
        cbRef.current.onProgress?.(
          Math.floor(now),
          Number.isFinite(video.duration) ? Math.floor(video.duration) : 0,
        );
      }
    };

    const onLoadedMeta = () => {
      setLoading(false);
      const dur = Number.isFinite(video.duration) ? video.duration : 0;
      setDuration(dur);
      cbRef.current.onReady?.(Math.floor(dur));
      // Continue watching seek
      const rf = resumeRef.current;
      if (rf > 2 && rf < dur - 2) {
        video.currentTime = rf;
        setShowResumeToast(true);
        setTimeout(() => setShowResumeToast(false), 3500);
      }
    };
    const onTimeUpdate = () => {
      if (!scrubbing) setCurrent(video.currentTime);
      emitProgress(false);
    };
    const onProgressBuf = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      emitProgress(true); // pause үед хадгалах
    };
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      setLoading(false);
    };
    const onSeeked = () => emitProgress(true); // seek үед хадгалах
    const onEnd = () => {
      setPlaying(false);
      emitProgress(true);
      cbRef.current.onEnded?.();
      if (autoNext && onNext) onNext();
    };
    const onVol = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const onCanPlay = () => setLoading(false);

    video.addEventListener('loadedmetadata', onLoadedMeta);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('progress', onProgressBuf);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('ended', onEnd);
    video.addEventListener('volumechange', onVol);
    video.addEventListener('canplay', onCanPlay);

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMeta);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('progress', onProgressBuf);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('ended', onEnd);
      video.removeEventListener('volumechange', onVol);
      video.removeEventListener('canplay', onCanPlay);
      // Unmount/хаагдахад сүүлийн байрлал хадгалах
      emitProgress(true);
    };
  }, [started, isExternal, scrubbing, autoNext, onNext]);

  // ── Fullscreen өөрчлөлт сонсох ──
  useEffect(() => {
    const handler = () => {
      const doc = document as WebkitDocument;
      setIsFullscreen(!!(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  // ─── Controls ───────────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const handleStart = useCallback(() => {
    setStarted(true);
    // started=true болсны дараа useEffect attach хийнэ. Дараагийн tick-д play.
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (v) v.play().catch(() => {});
    });
  }, []);

  const seekTo = useCallback((sec: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const clamped = Math.max(0, Math.min(video.duration, sec));
    video.currentTime = clamped;
    setCurrent(clamped);
  }, []);

  const seekByFraction = useCallback(
    (frac: number) => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration)) return;
      seekTo(frac * video.duration);
    },
    [seekTo],
  );

  const skip = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      seekTo(video.currentTime + delta);
    },
    [seekTo],
  );

  const setVol = useCallback((v: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, v));
    video.volume = clamped;
    video.muted = clamped === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) {
      video.volume = 0.5;
    }
  }, []);

  const changeSpeed = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setSpeed(rate);
    setSpeedMenuOpen(false);
  }, []);

  const cycleSpeed = useCallback(
    (dir: 1 | -1) => {
      const idx = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
      const safeIdx = idx === -1 ? SPEEDS.indexOf(1) : idx;
      const next = Math.max(0, Math.min(SPEEDS.length - 1, safeIdx + dir));
      changeSpeed(SPEEDS[next]);
    },
    [speed, changeSpeed],
  );

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current as WebkitFullscreenContainer | null;
    const video = videoRef.current as WebkitVideo | null;
    const doc = document as WebkitDocument;
    const isFs = !!(document.fullscreenElement || doc.webkitFullscreenElement);

    if (isFs) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      return;
    }
    if (container?.requestFullscreen) {
      container.requestFullscreen().catch(() => {});
    } else if (container?.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    } else if (video?.webkitEnterFullscreen) {
      // iOS Safari — зөвхөн video element fullscreen
      video.webkitEnterFullscreen();
    }
  }, []);

  const togglePip = useCallback(async () => {
    const video = videoRef.current as WebkitVideo | null;
    if (!video) return;
    try {
      const doc = document as Document;
      if (doc.pictureInPictureElement) {
        await doc.exitPictureInPicture();
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      } else if (video.webkitSetPresentationMode) {
        video.webkitSetPresentationMode('picture-in-picture');
      }
    } catch {
      /* PiP боломжгүй — чимээгүй өнгөрөөнө */
    }
  }, []);

  // ─── Controls auto-hide ───────────────────────────────────────────────────────

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      // Тоглож байгаа, scrub/menu нээлттэй биш үед л нуух
      if (videoRef.current && !videoRef.current.paused) {
        setControlsVisible(false);
        setSpeedMenuOpen(false);
        setVolumeOpen(false);
      }
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Scrub/menu нээлттэй бол controls үргэлж харагдах
  const forceShow = scrubbing || speedMenuOpen || volumeOpen || !playing;
  const effectiveVisible = controlsVisible || forceShow;

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────────

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Input/textarea фокуст байвал алгасах (player л фокуст)
      const key = e.key;
      let handled = true;
      switch (key) {
        case ' ':
        case 'k':
          togglePlay();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          toggleMute();
          break;
        case 'ArrowLeft':
          skip(-10);
          break;
        case 'ArrowRight':
          skip(10);
          break;
        case 'ArrowUp':
          setVol((videoRef.current?.volume ?? 0) + 0.1);
          break;
        case 'ArrowDown':
          setVol((videoRef.current?.volume ?? 0) - 0.1);
          break;
        case '>':
        case '.':
          cycleSpeed(1);
          break;
        case '<':
        case ',':
          cycleSpeed(-1);
          break;
        default:
          if (/^[0-9]$/.test(key)) {
            seekByFraction(Number(key) / 10);
          } else {
            handled = false;
          }
      }
      if (handled) {
        e.preventDefault();
        showControls();
      }
    },
    [
      togglePlay,
      toggleFullscreen,
      toggleMute,
      skip,
      setVol,
      cycleSpeed,
      seekByFraction,
      showControls,
    ],
  );

  // ─── Derived display ──────────────────────────────────────────────────────────

  const playedFrac = duration > 0 ? current / duration : 0;
  const bufferedFrac = duration > 0 ? buffered / duration : 0;
  const hoverTime = hoverPct != null && duration > 0 ? hoverPct * duration : null;

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const fadeProps = useMemo(
    () => ({
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.2 },
    }),
    [],
  );

  // ─── External бол энгийн embed ──
  if (isExternal && source.url) {
    return <ExternalPlayer url={source.url} title={title} />;
  }

  // ─── Stream / R2 → custom player ──
  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseMove={showControls}
      onMouseLeave={() => {
        if (playing && !forceShow) setControlsVisible(false);
      }}
      onTouchStart={showControls}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'group relative aspect-video w-full select-none overflow-hidden rounded-2xl bg-black outline-none',
        'ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#ffbe00]',
        !effectiveVisible && playing && 'cursor-none',
      )}
    >
      {/* Video element (custom controls тул browser controls={false}) */}
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        controls={false}
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture={false}
        onContextMenu={(e) => e.preventDefault()}
        onClick={togglePlay}
        className="absolute inset-0 h-full w-full bg-black"
      />

      {/* Poster overlay — эхэнд (lazy: дарж эхлэх) */}
      <AnimatePresence>
        {!started && (
          <motion.button
            type="button"
            {...fadeProps}
            onClick={handleStart}
            aria-label="Тоглуулах"
            className="absolute inset-0 z-30 flex items-center justify-center bg-black"
          >
            {poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt={title ?? ''}
                className="absolute inset-0 h-full w-full object-cover opacity-80"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />
            <span className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-[#ffbe00] text-[#022179] shadow-2xl transition-transform hover:scale-110">
              <Play className="ml-1 h-9 w-9 fill-current" />
            </span>
            {title && (
              <span className="absolute bottom-6 left-6 right-6 z-10 text-left text-lg font-semibold text-white drop-shadow-lg">
                {title}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Loading / buffering spinner */}
      <AnimatePresence>
        {started && (loading || buffering) && (
          <motion.div
            {...fadeProps}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          >
            <Loader2 className="h-12 w-12 animate-spin text-[#ffbe00]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue watching toast */}
      <AnimatePresence>
        {showResumeToast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-lg bg-black/80 px-3 py-2 text-sm text-white backdrop-blur"
          >
            <RotateCw className="h-4 w-4 text-[#ffbe00]" />
            {formatTime(resumeFrom)}-оос үргэлжлүүлж байна
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center big play/pause (started + paused үед) */}
      <AnimatePresence>
        {started && !playing && !loading && !buffering && (
          <motion.button
            type="button"
            {...fadeProps}
            onClick={togglePlay}
            aria-label="Тоглуулах"
            className="absolute inset-0 z-20 flex items-center justify-center"
          >
            <span className="flex h-18 w-18 items-center justify-center rounded-full bg-black/50 p-5 text-white backdrop-blur transition-transform hover:scale-110">
              <Play className="ml-1 h-8 w-8 fill-current" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Controls bar */}
      <AnimatePresence>
        {started && effectiveVisible && (
          <motion.div
            {...fadeProps}
            className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2 pt-10 sm:px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Seek bar + hover preview */}
            <div className="relative mb-1">
              {hoverTime != null && (
                <div
                  className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-black/90 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white"
                  style={{ left: `${(hoverPct ?? 0) * 100}%` }}
                >
                  {formatTime(hoverTime)}
                </div>
              )}
              <CustomRange
                ariaLabel="Видео байрлал"
                value={playedFrac}
                buffered={bufferedFrac}
                onChange={(v) => {
                  setScrubbing(true);
                  setCurrent(v * duration);
                  seekByFraction(v);
                }}
                onScrub={(active) => {
                  setScrubbing(active);
                  if (!active) showControls();
                }}
                onHover={setHoverPct}
              />
            </div>

            {/* Buttons row */}
            <div className="flex items-center gap-1">
              <IconBtn label={playing ? 'Түр зогсоох' : 'Тоглуулах'} onClick={togglePlay}>
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
              </IconBtn>

              {onNext && (
                <IconBtn label="Дараагийн хичээл" onClick={onNext}>
                  <SkipForward className="h-5 w-5" />
                </IconBtn>
              )}

              {/* Volume (hover дээр slider гарах) */}
              <div
                className="flex items-center"
                onMouseEnter={() => setVolumeOpen(true)}
                onMouseLeave={() => setVolumeOpen(false)}
              >
                <IconBtn label={muted ? 'Дуу нээх' : 'Дуу хаах'} onClick={toggleMute}>
                  <VolumeIcon className="h-5 w-5" />
                </IconBtn>
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-200',
                    volumeOpen ? 'w-20 opacity-100' : 'w-0 opacity-0',
                  )}
                >
                  <CustomRange
                    ariaLabel="Дууны түвшин"
                    className="w-20 px-1"
                    value={muted ? 0 : volume}
                    onChange={setVol}
                  />
                </div>
              </div>

              {/* Цаг */}
              <span className="ml-1 select-none text-xs font-medium tabular-nums text-white/90 sm:text-sm">
                {formatTime(current)} / {formatTime(duration)}
              </span>

              <div className="flex-1" />

              {/* Autoplay next toggle */}
              {onNext && (
                <button
                  type="button"
                  onClick={() => setAutoNext((v) => !v)}
                  className="mr-1 hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/15 sm:flex"
                  title="Дараагийн хичээлийг автоматаар тоглуулах"
                >
                  <span
                    className={cn(
                      'flex h-4 w-7 items-center rounded-full p-0.5 transition-colors',
                      autoNext ? 'bg-[#ffbe00]' : 'bg-white/30',
                    )}
                  >
                    <span
                      className={cn(
                        'h-3 w-3 rounded-full bg-white transition-transform',
                        autoNext && 'translate-x-3',
                      )}
                    />
                  </span>
                  Авто
                </button>
              )}

              {/* Playback speed */}
              <div className="relative">
                <button
                  type="button"
                  aria-label="Тоглуулах хурд"
                  title="Тоглуулах хурд"
                  onClick={() => setSpeedMenuOpen((v) => !v)}
                  className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <Gauge className="h-4 w-4" />
                  {speed}x
                </button>
                <AnimatePresence>
                  {speedMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-11 right-0 z-40 min-w-28 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/95 py-1 shadow-2xl backdrop-blur"
                    >
                      {SPEEDS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => changeSpeed(s)}
                          className={cn(
                            'flex w-full items-center justify-between px-3 py-1.5 text-sm transition-colors hover:bg-white/10',
                            speed === s ? 'text-[#ffbe00]' : 'text-white/85',
                          )}
                        >
                          {s === 1 ? 'Хэвийн' : `${s}x`}
                          {speed === s && <Check className="h-3.5 w-3.5" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Picture-in-Picture */}
              {pipSupported && (
                <IconBtn label="Зураг доторх зураг" onClick={togglePip}>
                  <PictureInPicture2 className="h-5 w-5" />
                </IconBtn>
              )}

              {/* Fullscreen */}
              <IconBtn
                label={isFullscreen ? 'Бүтэн дэлгэцээс гарах' : 'Бүтэн дэлгэц'}
                onClick={toggleFullscreen}
              >
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </IconBtn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Гарчиг (дээд талд, controls харагдах үед) */}
      <AnimatePresence>
        {started && effectiveVisible && title && (
          <motion.div
            {...fadeProps}
            className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-3"
          >
            <p className="truncate text-sm font-semibold text-white drop-shadow sm:text-base">
              {title}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next lesson overlay (autoNext + ended дараа гарч ирэх боломжтой — энд товч хэлбэр) */}
      {onNext && started && !playing && current > 0 && duration > 0 && current >= duration - 0.5 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-2 rounded-xl bg-[#ffbe00] px-5 py-3 font-semibold text-[#022179] shadow-2xl transition-transform hover:scale-105"
          >
            Дараагийн хичээл
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

export const PremiumVideoPlayer = memo(PremiumVideoPlayerBase);
export default PremiumVideoPlayer;
