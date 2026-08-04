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
  Settings,
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
  /**
   * ⚠️ ABR — чанарын түвшнүүд (1080p/720p/480p).
   * `hlsRef` нь level солиход хэрэгтэй; `levels` хоосон бол хуучин НЭГ
   * түвшинтэй видео гэсэн үг → цэс огт харагдахгүй (нийцтэй байдал).
   */
  const hlsRef = useRef<import('hls.js').default | null>(null);
  /**
   * ⚠️ Дуу АВТОМАТААР хаагдсан эсэх (browser autoplay бодлого).
   * Хэрэглэгчийн ЭХНИЙ даралтад дууг буцааж нээхэд ашиглана — тэгэхгүй бол
   * кино дуугүй тоглосоор, хэрэглэгч шалтгааныг ойлгохгүй.
   */
  const autoMutedRef = useRef(false);
  const [levels, setLevels] = useState<{ index: number; height: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = Auto
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
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
          /**
           * ⚠️⚠️ ВИДЕО ТОГЛОГДОХГҮЙ БАЙСНЫ ГОЛ ШАЛТГААН:
           * Өмнө нь `Authorization`-ийг БҮХ хүсэлтэд тавьдаг байсан. Гэтэл
           * m3u8 доторх segment-үүд нь R2-ийн PRESIGNED URL:
           *   1) `Authorization` бол simple header БИШ → browser preflight хийнэ
           *   2) Presigned гарын үсэг тэр header-ийг тооцоогүй → R2 ТАТГАЛЗАНА
           *   3) Segment ачаалагдахгүй → play дарсан ч юу ч тоглохгүй
           * Тиймээс ЗӨВХӨН манай API руу явах m3u8-д л token тавина.
           */
          xhrSetup: (xhr, requestUrl) => {
            if (token && requestUrl.includes('/api/stream/')) {
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
          },
          // Гар утасны сүлжээнд буферыг богино барина (эхлэх хурд чухал)
          maxBufferLength: 30,
          startLevel: -1, // bandwidth-аар автоматаар чанар сонгоно
        });
        hlsRef.current = hls;
        hls.loadSource(url.toString());
        hls.attachMedia(video);
        hls.on(HlsMod.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          /**
           * ⚠️ ABR түвшнүүдийг цуглуулна. Нэг л түвшин бол цэс ХАРУУЛАХГҮЙ
           * (хуучин видео) — хэрэглэгчид сонгох зүйлгүй цэс утгагүй.
           */
          const lv = (hls?.levels ?? [])
            .map((l, i) => ({ index: i, height: l.height }))
            .filter((l) => l.height > 0)
            .sort((a, b) => b.height - a.height);
          setLevels(lv.length > 1 ? lv : []);
          setCurrentLevel(-1);
          if (startAt && startAt > 0) video.currentTime = startAt;
          /**
           * ⚠️ AUTOPLAY — хэрэглэгч кино дээр дарж ирсэн тул шууд эхэлнэ.
           * Дуутай autoplay-г browser блоклодог тул амжилтгүй бол чимээгүй
           * болгож дахин оролдоно.
           *
           * ⚠️ ДУУ АВТОМАТААР ХААГДСАН гэдгийг тэмдэглэнэ (`autoMuted`) —
           * хэрэглэгч эхний удаа дэлгэц дээр дармагц ДУУГ БУЦААЖ НЭЭНЭ.
           * Өмнө нь чимээгүй үлдээд, хэрэглэгч өөрөө олж дарахгүй бол
           * кино дуугүй тоглосоор байв.
           */
          video.play().catch(() => {
            video.muted = true;
            setMuted(true);
            autoMutedRef.current = true;
            video.play().catch(() => {
              /* хэрэглэгч гараар дарна */
            });
          });
        });
        hls.on(HlsMod.Events.ERROR, (_evt, data) => {
          if (!data.fatal) return;
          /**
           * ⚠️ Fatal алдааг ЗААВАЛ сэргээхийг оролдоно — өмнө нь шууд
           * "тоглуулж чадсангүй" гээд бууж өгдөг байсан тул сүлжээ түр
           * тасрахад л видео мөнхөд зогсдог байв.
           */
          if (data.type === HlsMod.ErrorTypes.NETWORK_ERROR) {
            hls?.startLoad();
            return;
          }
          if (data.type === HlsMod.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
            return;
          }
          setLoading(false);
          setError(
            data.response?.code === 403
              ? 'Энэ контентыг үзэх эрх шаардлагатай'
              : data.response?.code === 404
                ? 'Видео олдсонгүй — хөрвүүлэлт дуусаагүй байж болзошгүй'
                : 'Видео тоглуулж чадсангүй',
          );
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari / iOS — HLS-ийг өөрөө дэмжинэ
        video.src = url.toString();
        video.addEventListener(
          'loadedmetadata',
          () => {
            setLoading(false);
            if (startAt && startAt > 0) video.currentTime = startAt;
            video.play().catch(() => {
              video.muted = true;
              setMuted(true);
              video.play().catch(() => {});
            });
          },
          { once: true },
        );
        video.addEventListener(
          'error',
          () => {
            setLoading(false);
            setError('Видео тоглуулж чадсангүй');
          },
          { once: true },
        );
      } else {
        setLoading(false);
        setError('Энэ браузер видео дэмжихгүй байна');
      }
    })();

    return () => {
      hls?.destroy();
      hlsRef.current = null;
      setLevels([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  /**
   * Чанар солих. -1 = Auto (сүлжээгээр автоматаар).
   * ⚠️ `nextLevel` ашиглана (`currentLevel` БИШ) — одоо буферт байгаа
   * хэсгийг хаяхгүй, дараагийн segment-ээс шилжинэ (зураг үсрэхгүй).
   */
  const changeQuality = useCallback((index: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.nextLevel = index;
    setCurrentLevel(index);
    setQualityMenuOpen(false);
  }, []);

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
    /**
     * ⚠️ Browser-ийн autoplay бодлогоор дуу АВТОМАТААР хаагдсан бол
     * хэрэглэгчийн ЭХНИЙ даралтад буцааж нээнэ. Энэ даралт нь "хэрэглэгчийн
     * үйлдэл" тул browser дуу зөвшөөрнө. Тэгэхгүй бол кино дуугүй тоглосоор,
     * хэрэглэгч шалтгааныг ойлгохгүй үлддэг байв.
     */
    if (autoMutedRef.current) {
      autoMutedRef.current = false;
      v.muted = false;
      setMuted(false);
      if (v.paused) v.play();
      return; // энэ даралт нь дуу нээхэд зарцуулагдана — pause хийхгүй
    }
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

            {/*
              ⚠️ ЧАНАРЫН цэс — зөвхөн ABR видеонд (levels.length > 1).
              Хуучин нэг түвшинтэй видеонд огт харагдахгүй.
            */}
            {levels.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setQualityMenuOpen((v) => !v)}
                  aria-label="Дүрсний чанар"
                  aria-haspopup="menu"
                  aria-expanded={qualityMenuOpen}
                  className="flex items-center gap-1 text-xs font-medium"
                >
                  <Settings size={16} />
                  {currentLevel === -1
                    ? 'Авто'
                    : `${levels.find((l) => l.index === currentLevel)?.height ?? ''}p`}
                </button>
                {qualityMenuOpen && (
                  <div
                    role="menu"
                    className="absolute bottom-8 right-0 min-w-24 rounded-md bg-black/90 py-1 text-sm shadow-xl"
                  >
                    <button
                      role="menuitem"
                      onClick={() => changeQuality(-1)}
                      className={cn(
                        'block w-full px-4 py-1.5 text-left hover:bg-white/10',
                        currentLevel === -1 && 'text-primary',
                      )}
                    >
                      Авто
                    </button>
                    {levels.map((l) => (
                      <button
                        key={l.index}
                        role="menuitem"
                        onClick={() => changeQuality(l.index)}
                        className={cn(
                          'block w-full px-4 py-1.5 text-left hover:bg-white/10',
                          currentLevel === l.index && 'text-primary',
                        )}
                      >
                        {l.height}p
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

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
