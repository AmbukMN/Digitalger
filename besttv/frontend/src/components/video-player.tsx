'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
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
  title,
  backHref,
}: {
  src: string; // '/api/stream/movie/{id}/playlist.m3u8' гэх мэт
  poster?: string;
  onProgress?: (positionSec: number, durationSec: number) => void;
  onEnded?: () => void;
  startAt?: number; // үргэлжлүүлэн үзэх — секундээр
  /** Дээд мөрөнд харуулах гарчиг (fullscreen үед ялангуяа чухал) */
  title?: string;
  /** Буцах холбоос — player дотроос шууд гарах зам */
  backHref?: string;
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
  /**
   * Ачаалагдсан (buffered) хэсгийн төгсгөл — YouTube/Netflix шиг progress
   * bar дээр цайвар зураасаар харуулна. Хэрэглэгч "хаана хүртэл бэлэн бэ,
   * seek хийвэл хүлээх үү" гэдгийг ХАРЖ мэдэх боломжтой болно.
   */
  const [buffered, setBuffered] = useState(0);
  /** Progress bar дээр хулгана хөдлөхөд гарах урьдчилсан харагдац */
  const [hover, setHover] = useState<{ time: number; x: number } | null>(null);
  /** Хулганаар чирч seek хийж байгаа эсэх */
  const [scrubbing, setScrubbing] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  /** Thumbnail харуулах нуугдмал видео (тусдаа элемент — гол тоглолтод нөлөөлөхгүй) */
  const thumbVideoRef = useRef<HTMLVideoElement>(null);
  /**
   * ⚠️ Хүрэлцэх (мобайл) төхөөрөмж дээр thumbnail ОГТ ХЭРЭГГҮЙ:
   *   - "hover" гэж байхгүй — хуруу дарахад л seek хийнэ
   *   - Хоёр дахь HLS урсгал нь гар утасны сүлжээ/батарейг дэмий иднэ
   *     (гол видео нь удаан ачаалах шалтгаан болно)
   *   - Жижиг дэлгэцэнд хайрцаг видеон дээр бүрхэж, хальж гардаг
   */
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(window.matchMedia('(hover: none), (pointer: coarse)').matches);
  }, []);
  /**
   * Тоглолтын явцад буфер дуусч ГАЦСАН эсэх.
   * ⚠️ `loading` нь ЗӨВХӨН эхний ачаалалтад үнэн байдаг тул дунд нь
   * сүлжээ удаашрахад хэрэглэгч ямар ч тэмдэг харахгүй, "эвдэрсэн юм уу"
   * гэж бодоод хаадаг байв.
   */
  const [buffering, setBuffering] = useState(false);
  /**
   * Удирдлага харагдаж байгаа эсэх. ⚠️ `group-hover` дангаараа хангалтгүй
   * байв — хулгана player дээр байвал удирдлага ҮРГЭЛЖ харагдаж, кино
   * бүрхэгддэг. Одоо 2 секунд хөдөлгөөнгүй байвал нуугдана.
   */
  const [controlsVisible, setControlsVisible] = useState(true);

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
          /**
           * ⚠️⚠️ ЭХЛЭХ ХУРД — "их удаан уншдаг" гэсэн гомдлын засвар.
           *
           * Өмнө нь `startLevel: -1` (авто) байсан нь ЭХНИЙ сегментийг
           * татаж дуустал bandwidth-ыг мэддэггүй тул ихэвчлэн ХАМГИЙН ӨНДӨР
           * чанараар эхэлдэг → гар утсанд 5-15 секунд хүлээнэ.
           *
           * `startLevel: 0` — хамгийн бага чанараар ТҮРГЭН эхэлж, ABR
           * хэдхэн секундын дараа автоматаар өндөр чанар руу шилжинэ
           * (YouTube/Netflix яг ингэдэг).
           */
          startLevel: 0,
          /** Гар утасны сүлжээнд буферыг богино барина (эхлэх хурд чухал) */
          maxBufferLength: 30,
          /** ⚠️ Эхлэхэд шаардах буфер — бага байх тусам түргэн эхэлнэ */
          maxBufferSize: 30 * 1000 * 1000,
          /** Дэлгэцийн хэмжээнээс өндөр чанар татахгүй — дэмий трафик */
          capLevelToPlayerSize: true,
          /**
           * ⚠️ Сегмент татахад хугацаа хэтэрвэл ХУРДАН бууруулна —
           * анхдагч утга удаан сүлжээнд хэт тэвчээртэй, хэрэглэгч гацдаг.
           */
          fragLoadingMaxRetry: 4,
          fragLoadingRetryDelay: 500,
          /** Удаан эхлэхээс сэргийлж ABR-ыг илүү мэдрэмтгий болгоно */
          abrEwmaFastLive: 2,
          abrEwmaFastVoD: 2,
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
    /**
     * Одоогийн байрлалыг АГУУЛСАН buffered мужийн төгсгөл.
     * ⚠️ `buffered` нь олон тасархай муж агуулж болно (хэрэглэгч seek хийхэд).
     * Сүүлчийнхийг нь биш, ЯГ одоо тоглож буй хэсгийн төгсгөлийг авах ёстой —
     * тэгэхгүй бол "бүх зүйл ачаалагдсан" мэт худал харагдана.
     */
    const readBuffered = () => {
      const b = video.buffered;
      const t = video.currentTime;
      for (let i = 0; i < b.length; i++) {
        if (t >= b.start(i) - 0.5 && t <= b.end(i) + 0.5) return b.end(i);
      }
      return b.length ? b.end(b.length - 1) : 0;
    };

    const onTime = () => {
      setProgress(video.currentTime);
      setDuration(video.duration || 0);
      setBuffered(readBuffered());
      onProgress?.(video.currentTime, video.duration || 0);
    };
    // ⚠️ `progress` эвент — түр зогсоосон/гацсан үед ч ачаалал үргэлжилдэг тул
    // `timeupdate` дангаараа хангалтгүй (тоглохгүй үед огт дуудагддаггүй).
    const onBuffer = () => setBuffered(readBuffered());
    const onEndedInternal = () => onEnded?.();
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    /**
     * Буфер дуусч гацсан — spinner харуулна.
     * `waiting`/`stalled` = гацсан, `playing`/`canplay` = үргэлжилсэн.
     */
    const onWaiting = () => setBuffering(true);
    const onResume = () => setBuffering(false);

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('progress', onBuffer);
    video.addEventListener('seeked', onBuffer);
    video.addEventListener('ended', onEndedInternal);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('stalled', onWaiting);
    video.addEventListener('seeking', onWaiting);
    video.addEventListener('playing', onResume);
    video.addEventListener('canplay', onResume);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('progress', onBuffer);
      video.removeEventListener('seeked', onBuffer);
      video.removeEventListener('ended', onEndedInternal);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('stalled', onWaiting);
      video.removeEventListener('seeking', onWaiting);
      video.removeEventListener('playing', onResume);
      video.removeEventListener('canplay', onResume);
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

  /** Progress bar дээрх x координатыг видеоны секунд болгоно */
  const timeAtX = useCallback(
    (clientX: number) => {
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect || !duration) return 0;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  const seekTo = useCallback((time: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = time;
  }, []);

  /**
   * Хулгана progress bar дээгүүр хөдлөхөд тухайн агшны ХУГАЦАА + ЖИЖИГ ЗУРАГ
   * (thumbnail) харуулна — YouTube/Netflix-ийн нэгэн адил.
   *
   * ⚠️ Thumbnail-ыг тусдаа нуугдмал <video>-оос авна. Гол тоглогчийн
   * `currentTime`-ыг хөндвөл тоглолт тасалдана.
   */
  const onBarMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || isTouch) return; // мобайлд hover гэж байхгүй
    const time = timeAtX(e.clientX);
    const rect = barRef.current?.getBoundingClientRect();
    setHover({ time, x: rect ? e.clientX - rect.left : 0 });
    if (scrubbing) seekTo(time);
  };

  /**
   * ⚠️⚠️ THUMBNAIL SEEK — ХУЛГАНА ХӨДЛӨХӨД ГАЦДАГ БАЙСНЫ ЗАСВАР.
   *
   * Өмнө нь `useEffect([hover])` дотор `setTimeout` ашигладаг байсан:
   * hover өөрчлөгдөх бүрт effect дахин ажиллаж, cleanup нь өмнөх timer-ыг
   * ЦУЦАЛДАГ. Хулгана тасралтгүй хөдөлж байвал timer хэзээ ч дуусахгүй →
   * seek ОГТ хийгдэхгүй. Production хэмжилтээр thumbnail `currentTime`
   * 3205.6с дээр гацсан байв — хэрэглэгч "тухайн agшны зураг харагдахгүй"
   * гэж мэдэрдэг гол шалтгаан.
   *
   * Одоо: хүссэн хугацааг ref-д бичээд, timer-ыг ЗӨВХӨН НЭГ удаа
   * тавина (аль хэдийн ажиллаж байвал шинээр тавихгүй). Тэр timer
   * дуусахдаа ХАМГИЙН СҮҮЛИЙН утгыг уншина.
   */
  const wantTimeRef = useRef(0);
  const seekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hover === null || isTouch) return;
    wantTimeRef.current = hover.time;
    if (seekTimerRef.current) return; // аль хэдийн товлогдсон

    seekTimerRef.current = setTimeout(() => {
      seekTimerRef.current = null;
      const tv = thumbVideoRef.current;
      if (!tv) return;
      /**
       * ⚠️ `readyState` ШАЛГАХГҮЙ.
       *
       * Seek хийж байх агшинд `readyState` түр 0 болдог тул шалгавал
       * дараагийн seek АЛГАСАГДАНА (хэмжилт: эхнийх ✅, дараах бүгд ❌).
       * `duration` мэдэгдэж байвал `currentTime` оноох нь аюулгүй —
       * hls.js тухайн байрлалын сегментийг өөрөө татна.
       */
      if (Number.isFinite(tv.duration) && tv.duration > 0) {
        tv.currentTime = Math.min(wantTimeRef.current, tv.duration - 0.5);
      }
    }, 150);
  }, [hover, isTouch]);

  // Компонент устахад товлогдсон seek-ийг цуцална
  useEffect(
    () => () => {
      if (seekTimerRef.current) clearTimeout(seekTimerRef.current);
    },
    [],
  );

  /**
   * ⚠️⚠️ CANVAS ХЭРЭГЛЭХГҮЙ — ХАР ХАЙРЦАГ ГАРЧ БАЙВ.
   *
   * Эхлээд `ctx.drawImage(video)`-ээр canvas руу зурдаг байсан нь
   * production-д ХООСОН ХАР хайрцаг харуулж байлаа: HLS segment-үүд нь
   * R2-ийн presigned URL (өөр origin) тул canvas "tainted" болж
   * `drawImage` чимээгүй бүтэлгүйтдэг. `crossOrigin="anonymous"` нэмэх нь
   * ч тус болохгүй — presigned гарын үсэг CORS header шаарддаг.
   *
   * Шийдэл: нуугдмал видеог ӨӨРИЙГ НЬ жижигрүүлж харуулна. Ямар ч
   * canvas/CORS хамааралгүй, найдвартай.
   */

  /**
   * Thumbnail видеог HLS-ээр ачаална (гол видеотой ижил эх сурвалж).
   *
   * ⚠️ ХАМГИЙН БАГА ЧАНАРААР (`startLevel: 0` + `capLevelToPlayerSize`) —
   * 160×90 зурагт 1080p татах нь сүлжээ дэмий иддэг ба гол тоглолтын
   * bandwidth-ыг булаана.
   * ⚠️ ЗӨВХӨН хэрэглэгч progress bar дээр анх hover хийхэд ачаална
   * ⚠️⚠️ ГОЛ ВИДЕО БЭЛЭН БОЛМОГЦ ачаална (`!loading`), hover ХҮЛЭЭХГҮЙ.
   *
   * Өмнө нь `hover !== null` болтол хүлээдэг байсан нь ХООСОН ХАР хайрцаг
   * үүсгэж байв: хэрэглэгч зураас дээр очмогц HLS дөнгөж эхэлж, manifest+
   * сегмент татаж амжаагүй байхад hover дуусдаг. Одоо урьдчилж бэлдэнэ —
   * хамгийн бага чанараар, богино буфертай тул зардал бага.
   */
  const thumbReady = useRef(false);
  useEffect(() => {
    /**
     * ⚠️⚠️ ХЭРЭГЛЭГЧ ЗУРААС ДЭЭР ХҮРСНИЙ ДАРАА Л АЧААЛНА (`hover`).
     *
     * Өмнө нь гол видео бэлэн болмогц (`!loading`) ШУУД ачаалдаг байсан
     * нь кино эхлэх агшинд ХОЁР HLS УРСГАЛ зэрэг татаж, сүлжээг
     * хуваадаг байв — Playwright хэмжилтээр `playlist.m3u8`,
     * `variant.m3u8`, `v1_seg_000.ts` тус бүр 2 УДАА татагдсан.
     * Кино удаан ачаалагдах гол шалтгаан.
     *
     * Одоо hover хийх хүртэл огт хөндөхгүй — кино эхлэх хурд бүрэн
     * сэргэнэ. Hover-оос thumbnail гарах хүртэл ~1 секунд зарцуулна
     * (`preload="metadata"` + богино буфер тул хурдан).
     */
    if (isTouch || loading || hover === null || thumbReady.current) return;
    const tv = thumbVideoRef.current;
    if (!tv || !src) return;
    thumbReady.current = true;

    let hls: import('hls.js').default | null = null;
    const token = getAccessToken();

    (async () => {
      const HlsMod = (await import('hls.js')).default;
      if (HlsMod.isSupported()) {
        hls = new HlsMod({
          // Гол тоглогчтой ижил дүрэм: token ЗӨВХӨН манай API-д (presigned R2-д БИШ)
          xhrSetup: (xhr, requestUrl) => {
            if (token && requestUrl.includes('/api/stream/')) {
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
          },
          /**
           * ⚠️ ХАМГИЙН БАГА ЧАНАРААР ТҮГЖИНЭ.
           *
           * `capLevelToPlayerSize` нь thumbnail 160×90 үед ажилладаггүй
           * (hls.js дэлгэцийн хэмжээг зөв уншдаггүй) тул хэмжилтээр `v1`
           * буюу ДУНД чанар татагдаж байв — сүлжээ дэмий иднэ.
           * `startLevel` + `capLevelTo` хоёулаа 0 → ABR огт өсөхгүй.
           */
          startLevel: 0,
          autoStartLoad: true,
          /**
           * ⚠️⚠️ БУФЕР ХЭТ БАГА БАЙВАЛ SEEK ЭВДЭРНЭ.
           *
           * `maxBufferLength: 2` тавьсан нь эхний seek л ажиллаад,
           * дараагийнх нь `currentTime = 0` руу унадаг байв (production
           * хэмжилт: 15% ✅ → 50% ❌ → 80% ❌). hls.js буферээ хаяад
           * шинэ байрлалд хүрэлцэхүйц өгөгдөл бүрдүүлж чаддаггүй.
           * 10 секунд нь thumbnail-д хангалттай бага, seek-д хангалттай их.
           */
          maxBufferLength: 10,
          maxMaxBufferLength: 20,
          /** Seek хийхэд буферээс гадуур байвал шууд шинэ сегмент татна */
          maxBufferHole: 0.5,
        });
        hls.loadSource(new URL(src, window.location.origin).toString());
        hls.attachMedia(tv);
        // ⚠️ Manifest уншмагц чанарыг 0-д ТҮГЖИНЭ (ABR өсгөхийг хориглоно)
        hls.on(HlsMod.Events.MANIFEST_PARSED, () => {
          if (hls) {
            hls.currentLevel = 0;
            hls.autoLevelCapping = 0; // ABR-ыг бүрэн хаана
          }
        });
      } else if (tv.canPlayType('application/vnd.apple.mpegurl')) {
        tv.src = src; // Safari — уугуул HLS
      }
    })();

    return () => {
      hls?.destroy();
    };
  }, [hover, loading, src, isTouch]);

  // ⚠️ Өөр кино/анги руу шилжвэл thumbnail-г ДАХИН ачаалуулна
  useEffect(() => {
    thumbReady.current = false;
  }, [src]);

  /**
   * ⚠️⚠️ УДИРДЛАГА АВТОМАТААР НУУГДАХ (2 секунд).
   *
   * Өмнө нь зөвхөн `group-hover` ашигладаг байсан тул хулгана player
   * дээр байвал удирдлага ҮРГЭЛЖ харагдаж, кино харах талбарыг бүрхдэг
   * байв. Одоо YouTube/Netflix шиг: хулгана хөдлөхөд гарч ирээд,
   * 2 секунд хөдлөхгүй бол алга болно.
   *
   * ⚠️ Түр зогсоосон (`paused`) эсвэл цэс нээлттэй үед НУУХГҮЙ —
   * хэрэглэгч тэр үед удирдлагатай харьцаж байгаа.
   */
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2000);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = () => showControls();
    const onLeave = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setControlsVisible(false);
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    // Хүрэлцэх төхөөрөмжид: дэлгэц дарахад гарч ирнэ
    el.addEventListener('touchstart', onMove, { passive: true });
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('touchstart', onMove);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [showControls]);

  /**
   * Удирдлага харагдах эцсийн нөхцөл.
   * ⚠️ Түр зогсоосон / цэс нээлттэй / чирч байгаа үед ЗААВАЛ харагдана —
   * тэр үед хэрэглэгч удирдлагатай харьцаж байгаа тул нуувал эвгүй.
   */
  const showUi =
    controlsVisible ||
    !playing ||
    speedMenuOpen ||
    qualityMenuOpen ||
    scrubbing ||
    /**
     * ⚠️ Progress bar дээр hover хийж байхад НУУХГҮЙ.
     *
     * Нуувал доод блок `opacity-0` болж, доторх thumbnail <video> нь
     * үзэгдэхээ болиод browser нь HLS-ийг УСТГАДАГ (production
     * хэмжилтээр: 1.5с-д `ready=4, w=854` байсан нь 3с-д `ready=0, w=0`
     * болсон). Хэрэглэгч зураас дээр хулгана барьж байхад thumbnail
     * алга болдог гол шалтгаан.
     */
    hover !== null;

  /**
   * Чирч seek хийх (scrubbing). ⚠️ Эвентийг WINDOW дээр сонсоно — хулгана
   * bar-аас гарсан ч чирэлт үргэлжлэх ёстой (жинхэнэ player-ийн зан).
   */
  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (e: MouseEvent) => seekTo(timeAtX(e.clientX));
    const onUp = () => setScrubbing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [scrubbing, timeAtX, seekTo]);

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
      /**
       * ⚠️⚠️ `aspect-video` ДАНГААРАА ХАНГАЛТГҮЙ — МОБАЙЛД ХАЛЬЖ ГАРДАГ.
       *
       * `aspect-video` нь ЗӨВХӨН ӨРГӨНӨӨС өндрийг тооцдог. Утсыг хэвтээ
       * болгоход (эсвэл өндөр нарийн дэлгэцэнд) видео дэлгэцээс давж,
       * удирдлагын товчнууд харагдахаа больдог байв.
       *
       * `max-h-[80svh]` — динамик viewport (`svh`) ашиглана: мобайл
       * browser-ийн хаяг/доод самбар гарч ороход ч зөв ажиллана (`vh`
       * бол тэдгээрийг тооцдоггүй). `mx-auto` — өндрөөр хязгаарлагдахад
       * хэвтээ голлоно.
       */
      className="group relative mx-auto aspect-video max-h-[80svh] w-full overflow-hidden bg-black outline-none"
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
        /* ⚠️ `object-contain` — контейнер хязгаарлагдахад дүрс СУНАХГҮЙ */
        className="h-full w-full object-contain"
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

      {/*
        ⚠️ ТОГЛОЛТЫН ЯВЦАД гацсаныг харуулна (buffering).
        `loading` нь зөвхөн ЭХНИЙ ачаалалтад үнэн тул дунд нь сүлжээ
        удаашрахад хэрэглэгч ямар ч тэмдэг харахгүй, "эвдэрсэн" гэж
        бодоод хаадаг байв. Дэвсгэр ил тод — кино харагдсаар байна.
      */}
      {!loading && !error && buffering && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/55 p-3 backdrop-blur-sm">
            <Loader2 className="animate-spin text-white" size={32} aria-label="Ачааллаж байна" />
          </span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black text-white/70">
          {error}
        </div>
      )}

      {/*
        ⚠️ ДЭЭД МӨР — буцах товч + гарчиг.
        Өмнө нь буцах холбоос зөвхөн видеоны ДООР байсан тул дэлгэц дүүрэн
        (fullscreen) үзэж байхад ГАРАХ ЗАМ ОГТ ХАРАГДАХГҮЙ байв — хэрэглэгч
        Esc товч мэдэхгүй бол гацна. Одоо удирдлагатай хамт гарч ирнэ.
      */}
      {!error && (backHref || title) && (
        <div className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-3 bg-linear-to-b from-black/80 to-transparent p-3 transition-opacity duration-200 sm:p-4",
            showUi ? "opacity-100" : "opacity-0",
          )}>
          {backHref && (
            <a
              href={backHref}
              onClick={(e) => {
                // Fullscreen үед хуудас солих нь эвгүй — эхлээд гарна
                if (document.fullscreenElement) {
                  e.preventDefault();
                  document.exitFullscreen?.().then(() => {
                    window.location.href = backHref;
                  });
                }
              }}
              className="pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-black/70"
              aria-label="Буцах"
            >
              <ArrowLeft size={17} />
              <span className="hidden sm:inline">Буцах</span>
            </a>
          )}
          {title && (
            <p className="truncate text-sm font-semibold text-white/90 drop-shadow sm:text-base">
              {title}
            </p>
          )}
        </div>
      )}

      {!loading && !error && (
        <div className={cn(
            "absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 to-transparent p-4 transition-opacity duration-200",
            showUi ? "opacity-100" : "pointer-events-none opacity-0",
          )}>
          {/* ── Явцын зураас: ачаалагдсан хэсэг + hover thumbnail + чирэлт ── */}
          <div
            ref={barRef}
            onMouseDown={(e) => {
              setScrubbing(true);
              seekTo(timeAtX(e.clientX));
            }}
            onMouseMove={onBarMove}
            onMouseLeave={() => setHover(null)}
            role="slider"
            tabIndex={0}
            aria-label="Видеоны явц"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={progress}
            /* ⚠️ Дарах талбарыг өндөр (py-2) болгов — 1.5px зураасыг оносон
               эсэхээ хэрэглэгч тааварлах ёсгүй. Харагдац нь нимгэн хэвээр. */
            className="group/bar relative mb-3 cursor-pointer py-2"
          >
            <div className="relative h-1.5 rounded-full bg-white/25 transition-all group-hover/bar:h-2">
              {/* Ачаалагдсан (buffered) хэсэг — цайвар */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/40"
                style={{ width: duration ? `${Math.min(100, (buffered / duration) * 100)}%` : 0 }}
              />
              {/* Тоглосон хэсэг */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: duration ? `${(progress / duration) * 100}%` : 0 }}
              />
              {/* Бариул — hover/чирэлтийн үед л харагдана */}
              <div
                className={cn(
                  'absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow transition-opacity',
                  scrubbing ? 'opacity-100' : 'opacity-0 group-hover/bar:opacity-100',
                )}
                style={{ left: duration ? `${(progress / duration) * 100}%` : 0 }}
              />
            </div>

            {/*
              Урьдчилсан харагдац — зураг + хугацаа.
              ⚠️ Мобайлд ОГТ харуулахгүй (`isTouch`) — hover гэж байхгүй,
                 дэлгэц бүрхэж, нэмэлт HLS урсгал сүлжээ иднэ.
            */}
            {/*
              ⚠️⚠️ ХАЙРЦГИЙГ ҮРГЭЛЖ DOM-Д БАЙЛГАНА, зөвхөн ХАРАГДАЦЫГ нь
              сольно (`opacity`/`visibility`).

              Өмнө нь `hover && (...)` буюу нөхцөлт render хийж байсан нь
              production-д ХООСОН ХАР хайрцаг үүсгэж байв: hover болмогц
              <video> шинээр үүсч, HLS-ээ тэглээд эхнээс ачаална → хүрэлцэх
              хугацаа алга. Хулгана холдоход DOM-оос устаж, дараагийн hover-т
              БҮГД ДАХИН эхэлдэг тул хэзээ ч зураг гарч ирдэггүй байлаа.
            */}
            {!isTouch && (
              <div
                /**
                 * ⚠️ `invisible` (visibility:hidden) ХЭРЭГЛЭХГҮЙ — browser
                 * үүнийг "харагдахгүй" гэж үзээд доторх <video>-ийн HLS-ийг
                 * устгадаг (хэмжилтээр `ready=4` → `ready=0`). Зөвхөн
                 * `opacity`-оор нуувал видео амьд үлдэж, дараагийн hover-т
                 * ТҮРГЭН зураг гарна.
                 */
                className={cn(
                  'pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 overflow-hidden rounded-lg border border-white/20 bg-black shadow-2xl transition-opacity duration-150',
                  hover && duration > 0 ? 'opacity-100' : 'opacity-0',
                )}
                style={{
                  // ⚠️ Хажуу тал руу хальж гарахаас сэргийлж хязгаарлана
                  left: `clamp(84px, ${hover?.x ?? 0}px, calc(100% - 84px))`,
                }}
              >
                {/*
                  ⚠️ CANVAS БИШ, ВИДЕО ӨӨРӨӨ. `canvas.drawImage(video)` нь
                  presigned R2 (өөр origin) сегментээс болж "tainted" болоод
                  чимээгүй бүтэлгүйтдэг → хоосон хар дөрвөлжин.
                */}
                <video
                  ref={thumbVideoRef}
                  muted
                  playsInline
                  preload="metadata"
                  aria-hidden
                  tabIndex={-1}
                  className="block h-22.5 w-40 bg-black object-cover"
                />
                <div className="py-1 text-center text-xs font-medium tabular-nums text-white">
                  {formatTime(hover?.time ?? 0)}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 text-white">
            <button
              onClick={toggle}
              className="transition-transform hover:scale-110 active:scale-95"
              aria-label={playing ? 'Түр зогсоох' : 'Тоглуулах'}
            >
              {playing ? <Pause size={22} /> : <Play size={22} />}
            </button>
            {/*
              ⚠️ 10 секунд ухраах/урагшлах ТОВЧ ХАСАГДСАН (хэрэглэгчийн
              шаардлага). Тэр үйлдэл ХЭВЭЭР боломжтой:
                - Гар: ← / → товч
                - Хулгана: видеон дээр 2 удаа дарах (зүүн/баруун тал)
              Товчийг хасснаар удирдлагын мөр цэвэрхэн, кино харах талбар
              илүү нээлттэй болно.
            */}

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
