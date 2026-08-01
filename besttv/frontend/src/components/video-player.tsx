'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Gauge,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn } from '@besttv/shared';
import { getAccessToken } from '@/lib/api';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * BestTV HLS player — m3u8 манай stream gate endpoint-оос (Bearer auth),
 * segment-үүд R2-оос шууд (presigned URL, backend-ээр дамжихгүй).
 * Enterprise онцлог: keyboard shortcuts, playback speed, volume slider.
 */
export function VideoPlayer({
  src,
  poster,
  onProgress,
  onEnded,
  startAt,
}: {
  src: string; // '/api/stream/movie/{id}/playlist.m3u8' гэх мэт
  poster?: string;
  onProgress?: (positionSec: number, durationSec: number) => void;
  onEnded?: () => void;
  startAt?: number; // үргэлжлүүлэн үзэх — секундээр
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [seekFlash, setSeekFlash] = useState<'fwd' | 'back' | null>(null);

  useEffect(() => {
    let hls: import('hls.js').default | null = null;
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);

    const token = getAccessToken();
    const url = new URL(src, window.location.origin);

    (async () => {
      const HlsMod = (await import('hls.js')).default;
      if (HlsMod.isSupported()) {
        hls = new HlsMod({
          xhrSetup: (xhr) => {
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          },
        });
        hls.loadSource(url.toString());
        hls.attachMedia(video);
        hls.on(HlsMod.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          if (startAt && startAt > 0) video.currentTime = startAt;
        });
        hls.on(HlsMod.Events.ERROR, (_evt, data) => {
          if (data.fatal) setError('Видео тоглуулж чадсангүй');
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url.toString();
        video.addEventListener(
          'loadedmetadata',
          () => {
            setLoading(false);
            if (startAt && startAt > 0) video.currentTime = startAt;
          },
          { once: true },
        );
      }
    })();

    return () => hls?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      setProgress(video.currentTime);
      setDuration(video.duration || 0);
      onProgress?.(video.currentTime, video.duration || 0);
    };
    const onEndedInternal = () => onEnded?.();
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('ended', onEndedInternal);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('ended', onEndedInternal);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [onProgress, onEnded]);

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  };

  const skip = useCallback((deltaSec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + deltaSec));
    setSeekFlash(deltaSec > 0 ? 'fwd' : 'back');
    setTimeout(() => setSeekFlash(null), 500);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen?.();
    }
  }, []);

  const changeSpeed = (s: number) => {
    const v = videoRef.current;
    if (v) v.playbackRate = s;
    setSpeed(s);
    setSpeedMenuOpen(false);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    v.currentTime = ratio * duration;
  };

  // ── Keyboard shortcuts: space=play/pause, ←/→=10с, ↑/↓=volume, f=fullscreen, m=mute ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          toggle();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(Math.min(1, v.volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(Math.max(0, v.volume - 0.1));
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          toggleMute();
          break;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toggle, skip, toggleFullscreen, toggleMute]);

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden bg-black outline-none"
      tabIndex={0}
      role="region"
      aria-label="Видео тоглуулагч"
    >
      {/*
        ⚠️ Хамгаалалт: браузерын өөрийн "Save video as / Copy video address /
        Picture in picture" цэсийг хаана. Эдгээр нь ХЯЛБАР татах зам байсан.
        (Жинхэнэ хамгаалалт нь private R2 + presigned segment хэвээр.)
      */}
      <video
        ref={videoRef}
        poster={poster}
        onClick={toggle}
        onDoubleClick={toggleFullscreen}
        onContextMenu={(e) => e.preventDefault()}
        className="h-full w-full"
        playsInline
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
      />

      {/* Skip flash indicator */}
      {seekFlash && (
        <div
          className={cn(
            'pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-4 text-white',
            seekFlash === 'fwd' ? 'right-1/4' : 'left-1/4',
          )}
        >
          {seekFlash === 'fwd' ? <RotateCw size={28} /> : <RotateCcw size={28} />}
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <Loader2 className="animate-spin text-white/70" size={40} aria-label="Ачааллаж байна" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black text-white/70">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <div
            onClick={seek}
            role="slider"
            aria-label="Видеоны явц"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={progress}
            className="mb-3 h-1.5 cursor-pointer rounded-full bg-white/25"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: duration ? `${(progress / duration) * 100}%` : 0 }}
            />
          </div>
          <div className="flex items-center gap-4 text-white">
            <button onClick={toggle} aria-label={playing ? 'Түр зогсоох' : 'Тоглуулах'}>
              {playing ? <Pause size={22} /> : <Play size={22} />}
            </button>
            <button onClick={() => skip(-10)} aria-label="10 секунд ухраах">
              <RotateCcw size={18} />
            </button>
            <button onClick={() => skip(10)} aria-label="10 секунд урагшлах">
              <RotateCw size={18} />
            </button>

            <div className="group/vol flex items-center gap-1.5">
              <button onClick={toggleMute} aria-label={muted ? 'Дуу нээх' : 'Дуу хаах'}>
                <VolumeIcon size={20} />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                aria-label="Дууны түвшин"
                className="w-0 accent-primary opacity-0 transition-all group-hover/vol:w-16 group-hover/vol:opacity-100"
              />
            </div>

            <span className="text-xs tabular-nums text-white/70">
              {formatTime(progress)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            <div className="relative">
              <button
                onClick={() => setSpeedMenuOpen((v) => !v)}
                aria-label="Тоглуулах хурд"
                aria-haspopup="menu"
                aria-expanded={speedMenuOpen}
                className="flex items-center gap-1 text-xs font-medium"
              >
                <Gauge size={16} /> {speed}x
              </button>
              {speedMenuOpen && (
                <div
                  role="menu"
                  className="absolute bottom-8 right-0 rounded-md bg-black/90 py-1 text-sm shadow-xl"
                >
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      role="menuitem"
                      onClick={() => changeSpeed(s)}
                      className={cn(
                        'block w-full px-4 py-1.5 text-left hover:bg-white/10',
                        s === speed && 'text-primary',
                      )}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={toggleFullscreen} aria-label={fullscreen ? 'Дэлгэцнээс гарах' : 'Дэлгэц дүүргэх'}>
              {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
