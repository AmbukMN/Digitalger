'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2 } from 'lucide-react';
import {
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  isHLSProvider,
  type MediaPlayerInstance,
  type MediaProviderAdapter,
  type MediaProviderChangeEvent,
} from '@vidstack/react';
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from '@vidstack/react/player/layouts/default';
import { getAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { PlayerMenu } from '@/components/player/player-menu';

import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

/**
 * BestTV видео player — **Vidstack** дээр (өмнө нь 1171 мөр гар бичмэл байв).
 *
 * ⚠️⚠️ ЯАГААД СОЛИСОН БЭ: гар бичмэл player нь YouTube/Vimeo-гийн түвшний
 * бодит хэрэглээг хангахгүй байв —
 *   • утсан дээр seek хийхэд thumbnail preview ХАРАГДАХГҮЙ
 *   • хуруугаар товч дарахад оносонгүй (хүрэх талбар жижиг)
 *   • видео тоглож байхад ч "ачаалж байна" дугуй ГАРСААР байдаг
 *   • дэлгэц дүүрэн / PiP / чанар солих зэрэг найдваргүй
 * Vidstack нь эдгээрийг бүгдийг СТАНДАРТААР шийддэг (гар/хулгана/гарын
 * товчлуур, a11y, iOS fullscreen, ABR цэс) бөгөөс идэвхтэй арчлагддаг.
 *
 * ⚠️ Гадаад интерфейс (props) ЯГ ХЭВЭЭР — `watch-client` болон
 * `trailer-modal` дуудалт өөрчлөгдөөгүй.
 *
 * Сүлжээний загвар нь өмнөхтэй ижил:
 *   m3u8 → манай stream gate (Bearer auth, эрх шалгана)
 *   segment → R2-оос ШУУД (presigned URL, backend-ээр дамжихгүй)
 */
export function VideoPlayer({
  src,
  poster,
  onProgress,
  onEnded,
  startAt,
  title,
  subtitles,
  backHref,
  introStartSec,
  introEndSec,
  nextLabel,
  onNext,
  outroStartSec,
}: {
  src: string; // '/api/stream/movie/{id}/playlist.m3u8' гэх мэт
  poster?: string;
  onProgress?: (positionSec: number, durationSec: number) => void;
  onEnded?: () => void;
  startAt?: number; // үргэлжлүүлэн үзэх — секундээр
  /** Дээд мөрөнд харуулах гарчиг (fullscreen үед ялангуяа чухал) */
  title?: string;
  /**
   * Хадмалууд — олон хэл. `isDefault` нь тоглуулахад автомат асна.
   * ⚠️ `src` нь МАНАЙ API зам байх ёстой (R2 хаяг БИШ) — эрх
   * шалгагдаж, орчуулга задгай татагдахгүй.
   */
  subtitles?: { lang: string; label: string; src: string; isDefault: boolean }[];
  /** Буцах холбоос — player дотроос шууд гарах зам */
  backHref?: string;
  /**
   * ИНТРО АЛГАСАХ — секундээр. ХОЁУЛАА байвал л товч гарна.
   * ⚠️ Нэг нь дутуу бол буруу газар үсрэх эрсдэлтэй тул ОГТ гаргахгүй.
   */
  introStartSec?: number | null;
  introEndSec?: number | null;
  /**
   * ДАРААГИЙН АНГИ — өгвөл титрийн үед (эсвэл дуусахад) карт гарна.
   * ⚠️ `onNext` байхгүй бол карт огт гарахгүй (сүүлийн анги).
   */
  nextLabel?: string;
  onNext?: () => void;
  /** Титр эхлэх секунд — эндээс «Дараагийн анги» карт гарч эхэлнэ */
  outroStartSec?: number | null;
}) {
  const router = useRouter();
  const playerRef = useRef<MediaPlayerInstance>(null);
  /** Хамгийн сүүлд хадгалсан байрлал — давхардсан бичилтээс сэргийлнэ */
  const lastSaved = useRef(0);
  const [ready, setReady] = useState(false);

  /**
   * ⚠️⚠️ ТОКЕН БЭЛЭН БОЛТОЛ ПЛЕЕР ЭХЛҮҮЛЭХГҮЙ — 403-ЫН ЗАСВАР.
   *
   * БОДИТ АЛДАА (2026-08-25, nginx логоор батлагдсан): `playlist.m3u8`
   * дээр 403 ба 200 нь ЯГ ТЭНЦҮҮ тоогоор (11/11) бүртгэгдсэн бөгөөд
   * цагаар нь харахад ХОСООРОО гардаг байв:
   *     07:21:32 403  ← токенгүй хүсэлт
   *     07:21:32 200  ← 1 секундын дараа дахин оролдоод амжсан
   * Ес удаа дараалан давтагдсан.
   *
   * ШАЛТГААН: `xhrSetup` нь `getAccessToken()`-ыг ТУХАЙН АГШИНД уншина.
   * Плеер `authLoading` дуусахаас өмнө эхэлбэл токен `null` тул
   * `Authorization` header ЯВАХГҮЙ → backend 403. `hls.js` нь
   * `playlistLoadPolicy.errorRetry`-ээр 1 сек дараа дахин оролдож
   * амжилттай болдог тул ИХЭНХДЭЭ ажилладаг мэт харагдана.
   *
   * ⚠️ ГЭХДЭЭ: сүлжээ удаан / retry барагдвал хэрэглэгч «үзэж
   *    болохгүй байна» гэж гомдоллоно (бодит гомдол ирсэн). Мөн
   *    эхлэх хугацаа дэмий 1 секунд уртасна.
   *
   * ⚠️ ЗОЧИНД ХҮЛЭЭЛГЭХГҮЙ: `loading` дуусмагц (нэвтрээгүй нь
   *    тодорхой болмогц) шууд эхэлнэ — үнэгүй кино/трейлер саатахгүй.
   */
  const authLoading = useAuth((s) => s.loading);
  /**
   * ⚠️ `/api/`-гүй эх сурвалж (гадаад URL, blob) нь эрх шаарддаггүй
   *    тул auth хүлээх шаардлагагүй.
   */
  const needsAuth = src.includes('/api/');
  const srcReady = !needsAuth || !authLoading;
  /**
   * ⚠️⚠️ УДИРДЛАГА ХАРАГДАЖ БАЙГАА ЭСЭХ — буцах товчийг дагуулна.
   *
   * Өмнө нь буцах товч `ready` болмогц `opacity-0` болж БҮРЭН үл
   * үзэгдэх байв. `hover:opacity-100` нь эргүүлж авчирдаг ч ҮЛ
   * ҮЗЭГДЭХ товчийг хэрэглэгч ХЭЗЭЭ Ч олохгүй — «гарах зам алга»
   * гэсэн гомдол.
   *
   * Vidstack-ийн `onControlsChange` нь удирдлага гарах/алга болох
   * бүрд дуудагдана. Ингэснээр буцах товч удирдлагатай ЯГ ХАМТ
   * ажиллана (хулгана хөдлөх / түр зогсоох → хоёулаа гарна).
   */
  const [controlsOn, setControlsOn] = useState(true);
  /** ⚠️ Плеер унасан үед хар дэлгэц биш ТАЙЛБАР харуулна */
  const [playError, setPlayError] = useState<string | null>(null);
  /**
   * ⚠️ Сэргэлт хүлээх таймер — түр зуурын сүлжээний алдааг шууд
   * үхлийн гэж үзэхгүй (дэлгэрэнгүйг `onError`-оос харна уу).
   */
  const recoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (recoverTimer.current) clearTimeout(recoverTimer.current);
    },
    [],
  );

  /**
   * SEEK PREVIEW (thumbnail).
   *
   * ⚠️⚠️ VTT-г ӨӨРСДӨӨ ТАТНА, зөвхөн URL өгөхгүй.
   *
   * ЯАГААД: Vidstack нь `thumbnails` URL-ыг энгийн `fetch`-ээр татдаг тул
   * манай `Authorization: Bearer` header ЯВАХГҮЙ → endpoint 403 буцааж,
   * preview огт гарахгүй байв (`hls.js`-ийн `xhrSetup` нь зөвхөн m3u8/
   * segment-д хамаарна). Тиймээс токентой татаад, задалсан массивыг
   * шууд дамжуулна — Vidstack нь URL болон объект хоёуланг хүлээж авдаг.
   *
   * ⚠️ Зөвхөн КИНО (`/movie/`) — трейлер/ангид sprite үүсгэдэггүй.
   * ⚠️ Алдаа гарвал ЧИМЭЭГҮЙ өнгөрнө — preview бол нэмэлт тав тух,
   *    түүнээс болж видео тоглохгүй байх ёсгүй.
   */
  /**
   * ⚠️ Vidstack-ийн хэлбэр: `coords` нь ЗӨВХӨН `{x, y}` (sprite доторх
   * байрлал), харин ХЭМЖЭЭ нь тусдаа `width`/`height` талбарт.
   * Хоёуланг `coords`-д хийвэл өргөн/өндөр алдагдаж, sprite БҮХЭЛДЭЭ
   * сунаж харагдана.
   */
  const [thumbnails, setThumbnails] = useState<
    | {
        startTime: number;
        endTime: number;
        url: string;
        width?: number;
        height?: number;
        coords?: { x: number; y: number };
      }[]
    | undefined
  >(undefined);

  useEffect(() => {
    /**
     * ⚠️⚠️ КИНО БОЛОН АНГИ ХОЁУЛАА (өмнө нь зөвхөн `/movie/`).
     *
     * БОДИТ ГОМДОЛ: «хулгана хүргэхэд thumbnail гардаг байсан, гэнэт
     * ажиллахаа болилоо». Үнэндээ ЦУВРАЛ дээр хэзээ ч гардаггүй
     * байсан — sprite нь анги бүрд үүсдэг (R2-д баталгаажсан) атлаа
     * энэ мөр ангийг алгасдаг, backend-д ч endpoint байгаагүй.
     * Blacklist орсноос хойш цуврал үзэлт өссөн тул анзаарагдсан.
     *
     * ⚠️ Трейлер (`/trailer/`) нь ХЭВЭЭР алгасна — түүнд sprite
     * үүсгэдэггүй (`video-hls.service.ts` тайлбар).
     */
    if (!src.includes('/movie/') && !src.includes('/episode/')) return;
    /* ⚠️ Токен ачаалагдтал хүлээнэ — эс бөгөөс 403 (дээрх тайлбар) */
    if (!srcReady) return;
    const url = src.replace('/playlist.m3u8', '/thumbnails.vtt');
    let cancelled = false;

    (async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) return;
        const text = await res.text();

        /**
         * WebVTT задлалт — `00:00:10.000 --> 00:00:20.000` мөрийн дараах
         * `<sprite-url>#xywh=x,y,w,h` мөрийг хос болгоно.
         */
        const toSec = (t: string) => {
          const [h, m, s] = t.split(':');
          return Number(h) * 3600 + Number(m) * 60 + parseFloat(s);
        };
        const out: NonNullable<typeof thumbnails> = [];
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const cue = lines[i].match(/^([\d:.]+)\s*-->\s*([\d:.]+)/);
          if (!cue) continue;
          const target = lines[i + 1]?.trim();
          if (!target) continue;
          const [imgUrl, frag] = target.split('#xywh=');
          const [x, y, w, h] = (frag ?? '').split(',').map(Number);
          out.push({
            startTime: toSec(cue[1]),
            endTime: toSec(cue[2]),
            url: imgUrl,
            /* ⚠️ coords = байрлал, width/height = хэмжээ (тусдаа талбарууд) */
            ...(frag && Number.isFinite(w)
              ? { coords: { x, y }, width: w, height: h }
              : {}),
          });
        }
        /**
         * ⚠️ ХООСОН үед ч `setThumbnails` дуудна — анги солиход
         * ХУУЧИН ангийн preview үлдэхээс сэргийлнэ (`src` солигдоход
         * state автоматаар цэвэрлэгддэггүй). Sprite-гүй ангид буруу
         * кадар харуулах нь preview огт байхгүйгээс МУУ.
         */
        if (!cancelled) setThumbnails(out.length ? out : undefined);
      } catch {
        /* preview байхгүй — видео хэвийн тоглоно */
        if (!cancelled) setThumbnails(undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, srcReady]);

  /**
   * ХАДМАЛ — ТОКЕНТОЙ ТАТАЖ blob болгоно.
   *
   * ⚠️⚠️ `<Track src="/api/...">` гэж ШУУД өгвөл АЖИЛЛАХГҮЙ. Vidstack
   * нь хадмалыг энгийн `fetch`-ээр татдаг тул манай `Authorization`
   * header ЯВАХГҮЙ → endpoint 403 буцаана → хадмал ЧИМЭЭГҮЙ гарахгүй
   * (thumbnails дээр яг ижил асуудал гарч, тэндээ шийдэгдсэн).
   *
   * Тиймээс өөрсдөө токентой татаад `blob:` URL болгоно.
   *
   * ⚠️ `blob:` нь тухайн хуудсанд л хүчинтэй — хэрэглэгч хаягийг
   * хуулж авч хадмалыг тараах боломжгүй (нэмэлт хамгаалалт).
   */
  const [subtitleTracks, setSubtitleTracks] = useState<
    { lang: string; label: string; blobUrl: string; isDefault: boolean }[]
  >([]);

  useEffect(() => {
    if (!subtitles?.length) {
      setSubtitleTracks([]);
      return;
    }
    /* ⚠️ Токен ачаалагдтал хүлээнэ — эс бөгөөс хадмал ЧИМЭЭГҮЙ гарахгүй */
    if (!srcReady) return;
    let cancelled = false;
    const created: string[] = [];

    (async () => {
      const token = getAccessToken();
      const out: typeof subtitleTracks = [];
      for (const s of subtitles) {
        try {
          const res = await fetch(s.src, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          if (!res.ok) continue;
          const text = await res.text();
          const url = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }));
          created.push(url);
          out.push({ lang: s.lang, label: s.label, blobUrl: url, isDefault: s.isDefault });
        } catch {
          /* ⚠️ Нэг хэл унасан ч бусад нь ажиллана — видео зогсох ёсгүй */
        }
      }
      if (cancelled) {
        created.forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      setSubtitleTracks(out);
    })();

    return () => {
      cancelled = true;
      /* ⚠️ blob-ыг ЗААВАЛ чөлөөлнө — эс бөгөөс санах ой алдагдана */
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [subtitles, srcReady]);

  /**
   * ⚠️⚠️ ЧАНАР + ХУРД — өөрсдийн цэс хянадаг тул төлвийг энд барина.
   *
   * Vidstack-ийн `qualities` нь HLS manifest ачаалагдмагц дүүрдэг
   * тул `change` эвентээр дагана.
   */
  const [qualities, setQualities] = useState<{ index: number; label: string }[]>([]);
  const [activeQuality, setActiveQuality] = useState(-1);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const sync = () => {
      const list = [...p.qualities].map((q, i) => ({
        index: i,
        label: `${q.height}p`,
      }));
      /* ⚠️ «Авто» нь ЭХЭНД — анхдагч сонголт, хамгийн олон хүн ашиглана */
      setQualities(list.length ? [{ index: -1, label: 'Авто' }, ...list] : []);
      /* ⚠️ `autoSelect` нь МЕТОД (шинжилгээ БИШ) — авто эсэхийг
         `selectedIndex` -ээр л мэдэж болно (-1 = ABR сонгож байна) */
      setActiveQuality(p.qualities.selectedIndex);
    };
    sync();
    p.qualities.addEventListener('add', sync);
    p.qualities.addEventListener('change', sync);
    return () => {
      p.qualities.removeEventListener('add', sync);
      p.qualities.removeEventListener('change', sync);
    };
  }, [ready]);

  /**
   * ⚠️⚠️ ИДЭВХТЭЙ ХАДМАЛЫН ХЭЛ — өөрсдийн цэс хянана.
   *
   * Vidstack-ийн `textTracks` нь `mode` талбартай (`showing` /
   * `disabled`). Нэг л track `showing` байх ЁСТОЙ — олон бол
   * хадмал давхарлаж, уншигдахгүй болно.
   */
  const [activeCue, setActiveCue] = useState<string | null>(null);

  /* Анхдагч хэлийг track ачаалагдмагц тохируулна */
  useEffect(() => {
    if (!subtitleTracks.length) {
      setActiveCue(null);
      return;
    }
    const def = subtitleTracks.find((t) => t.isDefault) ?? subtitleTracks[0];
    setActiveCue(def.lang);
  }, [subtitleTracks]);

  /**
   * Сонгосон хэлийг Vidstack-д тавина.
   *
   * ⚠️ `player.textTracks` нь ачаалагдахад хугацаа шаардана тул
   * `activeCue` болон track-ийн тоо ХОЁУЛАНГ хамаарал болгоно.
   */
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const apply = () => {
      for (const t of p.textTracks) {
        /* ⚠️ `language` нь `lang` атрибутаас ирнэ */
        t.mode = t.language === activeCue ? 'showing' : 'disabled';
      }
    };
    apply();
    /**
     * ⚠️ Track хожуу нэмэгдэж болно (blob URL асинхрон бэлддэг) —
     * `add` эвентээр дахин тавина.
     */
    p.textTracks.addEventListener('add', apply);
    return () => {
      p.textTracks.removeEventListener('add', apply);
    };
  }, [activeCue, subtitleTracks.length]);

  /**
   * ⚠️⚠️ BEARER TOKEN — ЗӨВХӨН МАНАЙ API руу.
   *
   * Segment-үүд нь R2-оос ШУУД татагддаг (presigned URL). Тэдгээрт
   * `Authorization` header нэмбэл:
   *   1) `Authorization` бол "simple header" БИШ → browser CORS preflight
   *      (OPTIONS) хийнэ, R2 түүнийг дэмждэггүй → segment бүр УНАНА
   *   2) presigned URL нь өөрөө эрхээ агуулдаг тул header ИЛҮҮЦ
   * Тиймээс зөвхөн `/api/` замд л тавина.
   */
  const onProviderChange = useCallback(
    (provider: MediaProviderAdapter | null, _e: MediaProviderChangeEvent) => {
      if (!isHLSProvider(provider)) return;

      /**
       * ⚠️⚠️ hls.js-ийг ЛОКАЛААС — CDN-ЭЭС БИШ.
       *
       * Vidstack анхдагчаар `cdn.jsdelivr.net`-ээс татдаг (хэмжилтээр
       * баталсан). Энэ нь ноцтой эрсдэлтэй:
       *   1) CDN унавал / блоклогдвол БҮХ КИНО тоглохгүй болно
       *   2) Монголоос гадаад CDN руу нэмэлт RTT — эхлэх хугацаа уртсана
       *   3) `hls.js` төсөлд аль хэдийн суусан байхад дэмий татаж байна
       * `library` нь dynamic import хүлээж авдаг тул bundle-д тусдаа
       * chunk болж, зөвхөн видео нээхэд ачаалагдана.
       */
      provider.library = () => import('hls.js');

      provider.config = {
        /**
         * ⚠️⚠️ ЭХЛЭХ ХУРД — ХАМГИЙН БАГА ЧАНАРААР ЭХЭЛНЭ.
         *
         * БОДИТ ГОМДОЛ (iPhone, 4G): Play дарахад 6+ секунд хар дэлгэц.
         * Шалтгаан: LADDER нь [1080p, 720p, 480p] тул master playlist-д
         * 1080p = level 0. Өмнө `startLevel: -1` байсан нь hls.js-т эхний
         * түвшнийг СОНГУУЛДАГ бөгөөд bandwidth таавар байхгүй үед өндөр
         * чанар (1080p ~3.75MB/6сек) сонгож, 4G дээр эхний segment татахад
         * 4-8 секунд зарцуулагдаж байв.
         *
         * `startLevel: 0` + `abrEwmaDefaultEstimate` бага (600kbps) →
         * hls.js эхний удаа ХАМГИЙН БАГА bitrate variant (480p ~350KB)
         * сонгоно. Видео 1-2 секундэд эхэлж, дараа нь ABR сүлжээнд
         * тохируулж чанараа өөрөө өсгөнө.
         *
         * ⚠️ `startLevel`-ыг manifest parse дараа хамгийн доод (bitrate
         * багатай) level рүү доор `MANIFEST_PARSED`-д тааруулна — LADDER
         * дараалал өөрчлөгдсөн ч зөв ажиллана.
         */
        startLevel: -1,
        /**
         * ⚠️ Анхны bandwidth таавар — hls.js эхний segment сонгоход
         * ашиглана. Бага (600kbps) тул эхэндээ 480p сонгоно. Дараа нь
         * бодит хэмжилтээр өсгөнө. 4G-ийн бодит доод хурдтай нийцүүлэв.
         */
        abrEwmaDefaultEstimate: 600_000,
        /* ⚠️ Эхлэхэд нэмэлт bandwidth тест хийж цаг алдахгүй */
        testBandwidth: false,
        /**
         * ⚠️⚠️ БУФЕР — АЛСЫН үзэгчид зориулав.
         *
         * БОДИТ ГОМДОЛ: Чехээс үзэж байсан хэрэглэгч кино дунд «Видео
         * ачаалахад алдаа» гэж тасарсан. R2 нь Европоос хол тул нэг
         * сегмент удаашрахад буфер шавхагдаж тоглолт зогсдог байв.
         *
         * 60 секунд (өмнө 30) нь хэдэн секундын саатлыг хэрэглэгч
         * мэдэлгүй давна. `maxMaxBufferLength` нь хурдан сүлжээнд
         * хэт урагш гүйхийг хязгаарлана — хэрэглэгчийн дата дэмий
         * зарцуулагдахгүй.
         */
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        /**
         * ⚠️⚠️ ДАХИН ОРОЛДОХ БОДЛОГО — тоглолтыг үнэхээр амьд байлгадаг нь энэ.
         *
         * hls.js-ийн анхдагч нь цөөн, хурдан оролдлого хийдэг. Олон
         * улсын урт зам дээр тэр нь хангалтгүй: сегмент унамагц player
         * бууж өгч, ердөө хоёр секундын саатлын улмаас хэрэглэгч алдаа
         * хардаг байв.
         *
         * 6 оролдлого, exponential backoff (1с → 8с) нь ~20 секундын
         * бодит тасалдлыг давна. Player чимээгүй сэргэнэ.
         */
        fragLoadPolicy: {
          default: {
            maxTimeToFirstByteMs: 12_000,
            maxLoadTimeMs: 60_000,
            timeoutRetry: { maxNumRetry: 4, retryDelayMs: 1_000, maxRetryDelayMs: 8_000 },
            errorRetry: { maxNumRetry: 6, retryDelayMs: 1_000, maxRetryDelayMs: 8_000 },
          },
        },
        /* Playlist жижиг — эндээс хурдан унана, гэхдээ бас дахин оролдоно */
        playlistLoadPolicy: {
          default: {
            maxTimeToFirstByteMs: 10_000,
            maxLoadTimeMs: 20_000,
            timeoutRetry: { maxNumRetry: 3, retryDelayMs: 1_000, maxRetryDelayMs: 4_000 },
            errorRetry: { maxNumRetry: 3, retryDelayMs: 1_000, maxRetryDelayMs: 4_000 },
          },
        },
        xhrSetup: (xhr, requestUrl) => {
          if (!requestUrl.includes('/api/')) return;
          const token = getAccessToken();
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        },
      };
    },
    [],
  );

  /**
   * Үргэлжлүүлэн үзэх — эхлэх байрлалыг тавина.
   * ⚠️ `canPlay` дараа тавина: түүнээс өмнө `currentTime` бичвэл
   * media element бэлэн болоогүй тул ЧИМЭЭГҮЙ алгасагддаг.
   */
  const onCanPlay = useCallback(() => {
    setReady(true);
    const p = playerRef.current;
    if (p && startAt && startAt > 0 && p.currentTime < 1) {
      p.currentTime = startAt;
    }
  }, [startAt]);

  /**
   * ⚠️ ЯВЦ ХАДГАЛАХ — 5 секунд тутам (хэт олон хүсэлт явуулахгүй).
   * `seeked`/`pause`/хуудас хаах үед НЭМЭЛТЭЭР хадгална (доор) —
   * тэдгээргүй бол хэрэглэгч seek хийгээд шууд гарахад байрлал алдагдана.
   */
  /**
   * ─── ИНТРО АЛГАСАХ / ДАРААГИЙН АНГИ ────────────────────────────────
   *
   * ⚠️⚠️ Хоёулаа ХЭРЭГЛЭГЧИЙН СОНГОЛТ — автоматаар үсэрдэггүй.
   *   • Интро: товч гарна, дарвал л алгасна (интро үзэх дуртай хүн бий)
   *   • Дараагийн анги: тоолуур гүйнэ, «Болих» дарж зогсооно
   *
   * ⚠️ Өмнө нь анги дуусмагц ШУУД, анхааруулгагүй үсэрдэг байсан нь
   *    титр үзэх гэсэн хүнийг тасалж, унтчихсан хүнд 10 ангийг
   *    дараалан тоглуулах эрсдэлтэй байв.
   */
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);

  /**
   * ⚠️⚠️ БОГИНО АНГИ — ТООЛУУРГҮЙ, ШУУД ДАРААГИЙНХ.
   *
   * Богино драм (C-drama) нь 2-5 минутын ангитай, 27+ ангитай байдаг.
   * Анги бүрийн төгсгөлд 10 секунд хүлээх нь нийт 4.5 МИНУТ дэмий
   * хүлээлт үүсгэж, үзэлтийн урсгалыг тасалдаг.
   *
   * ⚠️ 20 МИНУТ гэсэн босго — энгийн 40-60 мин цуврал нь ХЭВЭЭР
   *    тоолууртай (титр үзэх зав, унтчихсан хүн зогсоох боломж).
   *
   * ⚠️ ЭРСДЭЛ: унтсан хэрэглэгч 27 ангийг дараалан үзэж болно
   *    (~1.5 цаг). Энэ нь ЗОРИУДЫН шийдвэр — богино драмын
   *    үзэлтийн туршлагыг чухалчилсан.
   */
  const SHORT_EPISODE_SEC = 20 * 60;
  /** Тухайн ангийн үргэлжлэх хугацаа — `onEnded` үед шийдвэрлэхэд */
  const durationRef = useRef(0);
  /** ⚠️ Хэрэглэгч «Болих» дарсан бол энэ ангид дахин санал болгохгүй */
  const nextCancelled = useRef(false);
  /** ⚠️ Дараагийн анги руу НЭГ Л УДАА шилжинэ (давхар дуудлагаас) */
  const nextFired = useRef(false);

  /* Анги солигдоход төлөвийг цэвэрлэнэ */
  useEffect(() => {
    setShowSkipIntro(false);
    setNextCountdown(null);
    nextCancelled.current = false;
    nextFired.current = false;
  }, [src]);

  const goNext = useCallback(() => {
    if (nextFired.current || !onNext) return;
    nextFired.current = true;
    /**
     * ⚠️⚠️ ТООЛУУРЫГ ЭХЛЭЭД УНТРААНА — эс бөгөөс АНГИ АЛГАСНА.
     *
     * БОДИТ АЛДАА (хэрэглэгч мэдээлсэн: «1-ээс 3 руу үсэрч байна»):
     * `goToEpisode` нь зөвхөн URL-ийг солино. React дараагийн ангийн
     * дата ирэх хүртэл ХУУЧИН `src`-тэй хэсэг хугацаанд render хийнэ.
     * Тэр зуур `nextCountdown` нь 0 хэвээр байвал доорх useEffect
     * дахин ажиллаж `goNext()`-ийг ДАХИН дуудаж, хоёр дахь ангийг
     * алгасаад ГУРАВ руу үсэрдэг байв.
     *
     * `nextFired` ганцаараа хамгаалж чадаагүй: `src` солигдоход
     * цэвэрлэх useEffect түүнийг `false` болгосны ДАРАА хуучин
     * тоолуурын effect дахин гүйж болзошгүй (render дараалал).
     */
    setNextCountdown(null);
    onNext();
  }, [onNext]);

  /**
   * Тоолуур — 1 секунд тутам буурна, 0 болмогц дараагийн анги.
   * ⚠️ `nextCountdown` null бол таймер ОГТ ажиллахгүй.
   * ⚠️ Аль хэдийн шилжсэн (`nextFired`) бол дахин ажиллуулахгүй.
   */
  useEffect(() => {
    if (nextCountdown === null || nextFired.current) return;
    if (nextCountdown <= 0) { goNext(); return; }
    const t = setTimeout(() => setNextCountdown((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [nextCountdown, goNext]);

  const onTimeUpdate = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    const t = p.currentTime;

    /* ─ Интро товч: заасан цонхонд байх үед л ─ */
    if (introStartSec != null && introEndSec != null && introEndSec > introStartSec) {
      setShowSkipIntro(t >= introStartSec && t < introEndSec);
    }

    /**
     * ─ Титрийн үед дараагийн ангийг ЭРТ санал болгоно ─
     *
     * ⚠️ БОГИНО АНГИД ОРУУЛАХГҮЙ (<20 мин): тэнд `onEnded` дээр
     *    ШУУД шилждэг тул тоолуур гарвал зөрчилдөнө — хэрэглэгч
     *    «10, 9, 8…» гэж хараад гэнэт үсэрнэ.
     */
    const isShort = durationRef.current > 0 && durationRef.current < SHORT_EPISODE_SEC;
    if (
      onNext &&
      !isShort &&
      !nextCancelled.current &&
      nextCountdown === null &&
      outroStartSec != null &&
      t >= outroStartSec
    ) {
      setNextCountdown(10);
    }

    if (!onProgress) return;
    if (t > 0 && Math.abs(t - lastSaved.current) >= 5) {
      lastSaved.current = t;
      /* ⚠️ Богино анги эсэхийг `onEnded`-д мэдэхэд хэрэгтэй */
      durationRef.current = p.duration || 0;
      onProgress(t, p.duration || 0);
    }
  }, [onProgress, introStartSec, introEndSec, onNext, outroStartSec, nextCountdown]);

  const skipIntro = useCallback(() => {
    const p = playerRef.current;
    if (p && introEndSec != null) {
      p.currentTime = introEndSec;
      setShowSkipIntro(false);
    }
  }, [introEndSec]);

  const saveNow = useCallback(() => {
    const p = playerRef.current;
    if (!p || !onProgress) return;
    if (p.currentTime > 0) {
      lastSaved.current = p.currentTime;
      onProgress(p.currentTime, p.duration || 0);
    }
  }, [onProgress]);

  /**
   * ⚠️ Хуудас хаах / таб солих үед ч ХАДГАЛНА.
   * `pagehide` нь mobile Safari-д ажилладаг цорын ганц найдвартай эвент;
   * `visibilitychange` нь Android/desktop-д. Хоёуланг сонсоно.
   * ⚠️ Компонент устахад ч хадгална (SPA-д хуудас солиход `pagehide` гарахгүй).
   */
  useEffect(() => {
    const onHide = () => saveNow();
    const onVis = () => document.visibilityState === 'hidden' && saveNow();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
      saveNow();
    };
  }, [saveNow]);

  return (
    /* ⚠️ `data-first-load` — эхний ачаалалт дуустал Vidstack-ийн
       ӨӨРИЙН буфер spinner-ыг нуухад (globals.css). Эс бөгөөс манай
       постертой overlay дээр давхарлаж ХОЁР дугуй эргэлддэг байв. */
    <div className="relative w-full bg-black" data-first-load={!ready ? '' : undefined}>
      <MediaPlayer
        ref={playerRef}
        /**
         * ⚠️⚠️ Токен бэлэн болтол ЭХ СУРВАЛЖ ӨГӨХГҮЙ (дээрх тайлбар).
         * Хоосон массив = «эх сурвалж хараахан алга» — Vidstack хүлээнэ,
         * постер харагдсаар байна. `authLoading` дуусмагц (ихэвчлэн
         * 100мс дотор) жинхэнэ src орж, ЭХНИЙ хүсэлт токентой явна.
         */
        src={srcReady ? { src, type: 'application/x-mpegurl' } : []}
        /* ⚠️ `viewType="video"` — Vidstack эх сурвалжийг таних гэж хүлээхгүй,
           video удирдлагыг ШУУД харуулна (эхний агшинд аудио скин гарахгүй) */
        viewType="video"
        streamType="on-demand"
        /**
         * ⚠️⚠️ AUTOPLAY — хэрэглэгч "Үзэх" товч дарж ЭНЭ хуудсанд ирсэн
         * тул дахин play дарах шаардлагагүй.
         *
         * ⚠️ Browser бодлого: дуутай autoplay ихэвчлэн ХОРИГЛОГДДОГ
         * (ялангуяа мобайлд). Хориглогдвол Vidstack нь `play()` алдааг
         * барьж, голын ТОМ PLAY товчийг харуулна — хэрэглэгч нэг л удаа
         * дарна. Ингэснээр "ачаалсаар байна уу, эсвэл дарахыг хүлээж
         * байна уу" гэсэн эргэлзээ арилна.
         */
        autoPlay
        /* ⚠️ `crossOrigin` ЗААВАЛ — segment нь өөр домэйн (R2) дээр байна */
        crossOrigin
        playsInline
        title={title}
        /* Дуу/чанарын сонголтыг төхөөрөмж бүрд санана */
        storage="besttv-player"
        onProviderChange={onProviderChange}
        onCanPlay={onCanPlay}
        /**
         * ⚠️⚠️ АЛДААНЫ БОЛОВСРУУЛАЛТ — өмнө нь ОГТ БАЙГААГҮЙ.
         *
         * Түрээс дунд нь дуусах, presign хугацаа өнгөрөх, сүлжээ
         * тасрах үед Vidstack чимээгүй зогсоно — хэрэглэгч ХАР ДЭЛГЭЦ
         * харж, юу болсныг мэдэхгүй, дараагийн алхам ч байхгүй.
         *
         * ⚠️ Хэрэглэгчээр алдаа олуулах нь МУУ — юу болсныг хэлж,
         * дахин ачаалах боломж өгнө.
         */
        onError={(e) => {
          const code = (e as { code?: number } | undefined)?.code;

          /**
           * ⚠️⚠️ ЗӨВХӨН СЭРГЭХГҮЙ АЛДААНД зогсооно.
           *
           * БОДИТ ГОМДОЛ: кино 3 минут тоглоод «Видео ачаалахад алдаа»
           * гэж зогсдог байв. Чехээс үзэж байсан хэрэглэгч дээр
           * давтагдсан — алсын зайнаас сүлжээний саатал их.
           *
           * ШАЛТГААН: HLS-д сегмент нэг татагдахгүй байх нь ХЭВИЙН,
           * ТҮР зуурын үзэгдэл. hls.js өөрөө дахин оролдож сэргэдэг.
           * Гэтэл бид ЯМАР Ч алдаанд шууд бүтэн дэлгэц дүүрэн мессеж
           * гаргаж тоглолтыг зогсоодог байсан тул сэргэх боломжийг нь
           * булааж байлаа.
           *
           * ⚠️ `code === 4` (SRC_NOT_SUPPORTED) нь ҮНЭХЭЭР эцсийн —
           * эрх дууссан (403), файл байхгүй (404), кодек дэмжигдэхгүй.
           * Түүнийг шууд харуулна.
           *
           * ⚠️ Бусад код (сүлжээ, decode) — 12 секунд ХҮЛЭЭНЭ. Тэр
           * хугацаанд player сэргэвэл (`onPlaying`) таймер цуцлагдана.
           */
          if (code === 4) {
            setPlayError(
              'Видео тоглуулах боломжгүй байна. Түрээсийн хугацаа дууссан эсвэл эрх дууссан байж магадгүй.',
            );
            return;
          }

          if (recoverTimer.current) return; // аль хэдийн хүлээж байна
          recoverTimer.current = setTimeout(() => {
            recoverTimer.current = null;
            setPlayError('Видео ачаалахад алдаа гарлаа. Сүлжээгээ шалгаад дахин оролдоно уу.');
          }, 12_000);
        }}
        /**
         * ⚠️ Сэргэсэн — хүлээлтийн таймерыг цуцална.
         *
         * Player дахин тоглож эхэлмэгц алдааны мессеж гаргах ёсгүй.
         */
        onPlaying={() => {
          if (recoverTimer.current) {
            clearTimeout(recoverTimer.current);
            recoverTimer.current = null;
          }
          setPlayError(null);
        }}
        /* ⚠️ Буцах товчийг удирдлагатай хамт харуулах (дээрх тайлбар) */
        onControlsChange={setControlsOn}
        onTimeUpdate={onTimeUpdate}
        onSeeked={saveNow}
        onPause={saveNow}
        onEnded={() => {
          saveNow();
          /**
           * ⚠️⚠️ Дараагийн анги байвал ШУУД үсрэхгүй — 10 сек тоолуур
           * гарч, хэрэглэгч «Болих» дарж зогсоож чадна.
           * Титрээс аль хэдийн тоолуур эхэлсэн бол дахин эхлүүлэхгүй.
           * Дараагийн анги БАЙХГҮЙ (эсвэл болиулсан) бол хуучин
           * зан төлөв — `onEnded` дуудагдана.
           */
          /* ⚠️ Аль хэдийн шилжсэн бол дахин тоолуур эхлүүлэхгүй
             (шинэ ангийн дата ирэх зуур хуучин player `ended`
             эвентийг дахин илгээж болзошгүй). */
          if (onNext && !nextCancelled.current && !nextFired.current) {
            /**
             * ⚠️ БОГИНО АНГИ (<20 мин) — тоолуургүй ШУУД шилжинэ
             *    (`SHORT_EPISODE_SEC` тайлбар үз).
             * ⚠️ `duration` мэдэгдээгүй (0) бол ХУУЧИН зан төлөв —
             *    таамаглаж шууд үсрэхгүй.
             */
            const dur = durationRef.current || playerRef.current?.duration || 0;
            if (dur > 0 && dur < SHORT_EPISODE_SEC) {
              goNext();
              return;
            }
            setNextCountdown((n) => (n === null ? 10 : n));
            return;
          }
          onEnded?.();
        }}
        /**
         * ⚠️⚠️ ХАДМАЛГҮЙ ҮЕД ЦЭСИЙГ БҮРЭН НУУНА.
         *
         * БОДИТ АСУУДАЛ: Vidstack нь хадмал ОГТ байхгүй үед ч
         * «Хадмал» цэсийг харуулж, дотор нь зөвхөн «Хаах» гэсэн
         * ганц мөр гаргадаг. Хэрэглэгч дарж хараад «хадмал байхгүй
         * юм байна» гэж ойлгох ёстой болно — цэс байгаа нь ӨӨРӨӨ
         * «хадмал бий» гэсэн ХУДАЛ дохио.
         *
         * ⚠️ Vidstack-ийн дотоод зан төлөвт НАЙДАХГҮЙ (хувилбар
         * солигдоход өөрчлөгдөж болно) — өөрсдөө шууд хянана.
         * CSS-ийн дүрэм нь `globals.css`-д.
         */
        data-has-subtitles={subtitleTracks.length > 0 ? 'true' : 'false'}
        /**
         * ⚠️⚠️ ӨНДРИЙН ХЯЗГААР — МОБАЙЛД ДЭЛГЭЦЭЭС ХЭТЭРДЭГ БАЙСАН.
         *
         * БОДИТ АСУУДАЛ: `aspect-video` (16:9) ганцаараа бол ӨРГӨНӨӨС
         * өндрийг тооцно. Утсыг ХЭВТЭЭ эргүүлэхэд өргөн нь дэлгэцийн
         * бүтэн өргөн болж, өндөр нь дэлгэцээс ХЭТЭРНЭ — удирдлагын
         * мөр доогуур гарч, хэрэглэгч видеогоо бүтнээр нь харахгүй.
         *
         * `max-h` нь өндрийг таслана; `aspect-video`-тэй хамт ажиллахад
         * өргөн нь автоматаар багасаж, харьцаа хадгалагдана.
         *
         * ⚠️ `100dvh` — мобайл browser-ийн хаяг талбар нуугдах/гарахад
         * `vh` буруу тооцоологддог (Safari-д 100vh нь хаяг талбарыг
         * ОРУУЛААД тооцдог тул хэсэг нь далдардаг).
         *
         * ⚠️ `dvh` дэмжихгүй хуучин browser-т (iOS < 15.4 — таны
         * iPhone 7) `svh` fallback хэрэггүй: `aspect-video` дангаараа
         * ажиллаж, зөвхөн хязгаар нь идэвхгүй болно.
         */
        className="aspect-video max-h-[100dvh] w-full overflow-hidden bg-black text-white sm:max-h-[calc(100dvh-4rem)]"
      >
        <MediaProvider>
          {poster && (
            /**
             * ⚠️⚠️ `vds-poster` КЛАСС ЗААВАЛ — эс бөгөөс Vidstack-ийн
             * "тоглож эхлэхэд нуух" CSS дүрэм хамаарахгүй тул постер
             * зураг видеог ҮҮРД халхалж, кино явж байхад ч зураг л
             * харагддаг байв (бодит алдаа).
             *
             * ⚠️ `pointer-events-none` — постер дээр дарахад play/pause
             * ажиллах ёстой (зураг нь дарагдалтыг залгичихвал player
             * "хөшсөн" мэт мэдрэгдэнэ).
             */
            <Poster
              className="vds-poster pointer-events-none absolute inset-0 h-full w-full object-cover"
              src={poster}
              alt={title ?? ''}
            />
          )}

          {/*
            ⚠️⚠️ ХАДМАЛ — `<Track>` нь `MediaProvider` ДОТОР байх ЁСТОЙ.
            Гадна тавибал Vidstack танихгүй, хадмалын цэс ХООСОН гарна.

            ⚠️ `default` нь МОНГОЛ дээр — тоглуулах үед автоматаар асна.
            Хэрэглэгч цэснээс өөр хэл (English, 한국어) сонгож болно.

            ⚠️ `src` нь МАНАЙ API (R2 хаяг БИШ) — эрх шалгагдана.
            Ингэснээр төлбөргүй хүн орчуулгыг татаж авч чадахгүй.
          */}
          {subtitleTracks.map((s) => (
            <Track
              key={s.lang}
              src={s.blobUrl}
              kind="subtitles"
              label={s.label}
              lang={s.lang}
              default={s.isDefault}
            />
          ))}
        </MediaProvider>

        {/*
          ⚠️⚠️ ЭХНИЙ АЧААЛАЛЫН OVERLAY — «хар дэлгэц» мэдрэмжийг арилгана.
          БОДИТ ГОМДОЛ: iPhone 4G дээр Play дарахад 6 секунд ХООСОН хар
          дэлгэц + spinner. Постерыг autoPlay нь шууд нуудаг тул хэрэглэгч
          юу ч харахгүй хүлээдэг байв.
          ⚠️ `ready` (onCanPlay) болтол постер + бүдэг давхарга + тод
          «Ачаалж байна» spinner харуулна. Эхний segment ирмэгц (1-2 сек,
          480p-аас эхэлдэг болсон) алга болно. pointer-events-none тул
          доорх player удирдлагад саад болохгүй.
        */}
        {!ready && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/55">
            {poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt=""
                className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40"
              />
            )}
            <Loader2 className="size-9 animate-spin text-white/90" />
            <p className="text-sm font-medium text-white/80">Ачаалж байна…</p>
          </div>
        )}

        {/*
          ─── ИНТРО АЛГАСАХ ────────────────────────────────────────────
          ⚠️ Баруун ДООД буланд — удирдлагын мөрнөөс ДЭЭГҮҮР (bottom-20)
             тул seek bar-ыг халхлахгүй.
          ⚠️ `z-20` — ачаалалын overlay (z-10)-аас дээгүүр.
        */}
        {showSkipIntro && (
          <button
            type="button"
            onClick={skipIntro}
            className="absolute bottom-20 right-4 z-20 rounded-lg border border-white/25 bg-black/70 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/85"
          >
            Интро алгасах
          </button>
        )}

        {/*
          ─── ДАРААГИЙН АНГИ ───────────────────────────────────────────
          ⚠️⚠️ «Болих» товч ЗААВАЛ — автоматаар үсрэх нь титр үзэх гэсэн
             хүнийг тасалдаг, унтчихсан хүнд олон ангийг тоглуулдаг.
          ⚠️ Тоолуур зогсоохдоо `nextCancelled` тэмдэглэнэ — эс бөгөөс
             дараагийн `timeupdate` дахин эхлүүлнэ.
        */}
        {nextCountdown !== null && (
          <div className="absolute bottom-20 right-4 z-20 w-64 rounded-xl border border-white/15 bg-black/85 p-3.5 backdrop-blur-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">
              Дараагийн анги
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-white">
              {nextLabel ?? 'Дараагийн анги'}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={goNext}
                className="flex-1 rounded-lg bg-white py-2 text-sm font-bold text-black transition-transform active:scale-[0.98]"
              >
                Одоо үзэх ({nextCountdown})
              </button>
              <button
                type="button"
                onClick={() => {
                  nextCancelled.current = true;
                  setNextCountdown(null);
                }}
                className="rounded-lg border border-white/25 px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
              >
                Болих
              </button>
            </div>
          </div>
        )}

        {/*
          ⚠️ БЭЛЭН LAYOUT — YouTube маягийн бүрэн удирдлага:
          тоглуулах/зогсоох, seek + thumbnail preview, дуу, чанар (ABR),
          хурд, дэлгэц дүүрэн, PiP, гарын товчлуур, a11y.
          Гараар бичих шаардлагагүй — стандарт нь хэрэглэгчид ТАНИЛ.
        */}
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          /**
           * ⚠️⚠️ CC ТОВЧИЙГ ӨӨРИЙН ЦЭСЭЭР СОЛИНО (`slots`).
           *
           * БОДИТ АЛДАА: өмнө нь өөрийн товчийг player дээр ХӨВҮҮЛЖ
           * тавиад, Vidstack-ийнхыг CSS-ээр нуухыг оролдсон. Гэвч
           * `aria-label` нь хэлний тохиргооноос хамаарч өөрчлөгддөг
           * тул сонгогч ОНОХГҮЙ — ХОЁР товч зэрэг харагдаж, бүр
           * давхарлаж байв (хэрэглэгчийн гомдол).
           *
           * `slots` нь Vidstack-ийн АЛБАН ЁСНЫ арга: тухайн байрлалд
           * байгаа товчийг ОРЛУУЛНА. Тиймээс давхардах боломжгүй.
           *
           * ⚠️ `captionButton` нь desktop + mobile ХОЁУЛАНД үйлчилнэ.
           * ⚠️ Хадмалгүй видеонд `SubtitleMenu` өөрөө `null` буцаадаг
           * тул слот хоосон үлдэж, товч огт гарахгүй.
           */
          slots={{
            /**
             * ⚠️⚠️ ХАДМАЛ + ТОХИРГОО = НЭГ ЦЭС.
             *
             * Vidstack-ийн CC товч болон тохиргооны цэс хоёулаа
             * товчны дэргэд байрладаг тул гар утсанд ДЭЭШЭЭ ГАРЧ
             * ТАСАРДАГ. CSS-ээр засах хоёр оролдлого бүтэлгүйтсэн
             * (Vidstack нь JS-ээр inline байрлал бичдэг).
             *
             * Тиймээс хоёуланг нь ӨӨРИЙН цэсээр сольсон — portal-аар
             * дэлгэцэд харьцангуй байрлуулна.
             */
            captionButton: null,
            settingsMenu: (
              <PlayerMenu
                tracks={subtitleTracks.map((t) => ({ lang: t.lang, label: t.label }))}
                activeLang={activeCue}
                onSelectLang={setActiveCue}
                qualities={qualities}
                activeQuality={activeQuality}
                onSelectQuality={(i) => {
                  const p = playerRef.current;
                  if (!p) return;
                  /* ⚠️ `-1` = ABR авто; бусад нь тухайн түвшинг тогтооно */
                  /* ⚠️ `autoSelect()` нь МЕТОД; тухайн түвшинг
                     `q.selected = true` -ээр биш `selectQuality`-аар
                     сонгоно (Vidstack 1.15 API) */
                  if (i < 0) {
                    p.qualities.autoSelect();
                  } else {
                    const q = p.qualities[i];
                    if (q) p.remoteControl.changeQuality(i);
                  }
                  setActiveQuality(i);
                }}
                speed={speed}
                onSelectSpeed={(r) => {
                  const p = playerRef.current;
                  if (p) p.playbackRate = r;
                  setSpeed(r);
                }}
              />
            ),
          }}
          /**
           * ⚠️⚠️ SEEK PREVIEW — sprite + WebVTT (хөрвүүлэлтэд бэлдэнэ).
           *
           * Өмнөх player нь НУУГДМАЛ 2 дахь `<video>`-г seek хийж preview
           * гаргадаг байсан бөгөөд ГАР УТСАНД ажилладаггүй тул зориуд
           * унтраасан байв ("утсан дээр thumbnail харагдахгүй" гомдол).
           * Одоо зөвхөн ЗУРАГ татдаг тул бүх төхөөрөмжид ажиллана.
           *
           * ⚠️ Зөвхөн КИНОНЫ замд — трейлерт sprite үүсгэдэггүй.
           */
          thumbnails={thumbnails}
          /**
           * ⚠️⚠️ ҮРГЭЛЖ БАРААН — `next-themes`-ийн гэрэл горимд Vidstack нь
           * `vds-video-layout light` болж, видеон дээр ЦАГААН удирдлага
           * гарч зураг шингэдэг байв. Player бол кино үзэх орчин тул
           * хуудасны theme-ээс ХАМААРАХГҮЙ (YouTube ч ижил зарчимтай).
           */
          colorScheme="dark"
          /**
           * ⚠️ ГОЛЫН ТОМ PLAY ТОВЧ — зогссон/тоглоогүй үед дэлгэцийн
           * голд харагдана (YouTube-тэй ижил). Хэрэглэгч "ачаалж байна
           * уу?" гэж эргэлзэхгүй — юу хийхээ шууд мэднэ.
           */
          noGestures={false}
          /**
           * ⚠️⚠️ ЖИЖИГ LAYOUT-ЫН ХИЛ — ГАР УТАСНЫ УДИРДЛАГА.
           *
           * БОДИТ АСУУДАЛ: Vidstack нь анхдагчаар 576px-ээс нарийн
           * үед «small layout» руу шилждэг. Тэр горимд зарим товч
           * (тохиргоо, дуу) ДЭЭД мөрөнд гардаг тул хэрэглэгч
           * «дээрээ байх нь зохимжгүй» гэж гомдоллосон — гар утсыг
           * нэг гараар барихад эрхий хуруу ДООД хэсэгт хүрдэг.
           *
           * `smallLayoutWhen: false` → ҮРГЭЛЖ бүрэн layout: бүх товч
           * ДООД мөрөнд эгнэнэ (YouTube-ийн гар утасны загвартай
           * ижил). CSS-ээр товчны хэмжээг 40px болгосон тул нарийн
           * дэлгэцэд ч багтана.
           */
          smallLayoutWhen={false}
          /* ⚠️ Монгол хэл — анхдагч нь англи */
          translations={{
            Play: 'Тоглуулах',
            Pause: 'Түр зогсоох',
            Mute: 'Дууг хаах',
            Unmute: 'Дууг нээх',
            Volume: 'Дууны түвшин',
            Settings: 'Тохиргоо',
            Quality: 'Чанар',
            Speed: 'Хурд',
            Normal: 'Хэвийн',
            Auto: 'Авто',
            Captions: 'Хадмал',
            'Enter Fullscreen': 'Дэлгэц дүүрэн',
            'Exit Fullscreen': 'Дэлгэц дүүрнээс гарах',
            'Enter PiP': 'Жижиг цонх',
            'Exit PiP': 'Жижиг цонхноос гарах',
            'Seek Forward': 'Урагш',
            'Seek Backward': 'Хойш',
            'Closed-Captions On': 'Хадмал асаах',
            'Closed-Captions Off': 'Хадмал унтраах',
            Off: 'Хаах',
            Default: 'Үндсэн',
            Audio: 'Дуу',
            Chapters: 'Бүлэг',
            Accessibility: 'Хүртээмж',
            'Keyboard Animations': 'Гарын анимаци',
          }}
        />
      </MediaPlayer>

      {/*
        ⚠️⚠️ АЛДААНЫ ДАВХАРГА — хар дэлгэцийн оронд тайлбар.

        Түрээс дуусах, presign хугацаа өнгөрөх, сүлжээ тасрах үед
        хэрэглэгч юу болсныг МЭДЭХ ёстой. «Дахин оролдох» нь хуудсыг
        шинэчилж, эрх хэвээр бол үргэлжлүүлнэ.
      */}
      {playError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/90 p-6 text-center">
          <p className="max-w-md text-sm text-white/90">{playError}</p>
          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black transition-transform hover:scale-[1.03]"
            >
              Дахин оролдох
            </button>
            {backHref && (
              <a
                href={backHref}
                className="rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                Буцах
              </a>
            )}
          </div>
        </div>
      )}

      {/*
        ⚠️ Буцах товч — player-ийн ДЭЭД зүүн буланд.
        Дэлгэц дүүрэн үед доорх холбоос харагдахгүй тул хэрэглэгч гарах
        замгүй үлддэг байв. `pointer-events-none` бүхий саванд байрлуулж,
        товч дээрээ л дарагдана (доорх удирдлагыг халхлахгүй).
        ⚠️ Тоглож эхэлмэгц (`ready`) бүдгэрч, hover/фокуст дахин гарна.
      */}
      {backHref && (
        /**
         * ⚠️⚠️ ТОГЛОЖ ЭХЭЛМЭГЦ АЛГА БОЛДОГ БАЙСНЫГ ЗАСАВ.
         *
         * БОДИТ АЛДАА: `ready ? 'opacity-0 hover:opacity-100'` —
         * тоглож эхэлмэгц товч БҮРЭН үл үзэгдэх болдог. `hover` нь
         * түүнийг эргүүлж авчирдаг ч ҮЛ ҮЗЭГДЭХ товчийг хэрэглэгч
         * ХЭЗЭЭ Ч ОЛОХГҮЙ — гарах зам байхгүй мэт санагдана
         * (хэрэглэгчийн гомдол).
         *
         * ЗӨВ ЗАН ТӨЛӨВ: player-ийн УДИРДЛАГАТАЙ хамт харагдана.
         * Vidstack нь хулгана хөдлөхгүй 2 секундын дараа саван дээр
         * `data-user-idle` тавьдаг — түүнийг дагана:
         *   • Хулгана хөдлөх / түр зогсоох → удирдлага + буцах товч
         *   • Идэвхгүй → хоёулаа зөөлөн бүдгэрнэ
         *
         * ⚠️ `onControlsChange` — Vidstack-ийн албан ёсны event.
         * CSS сонголтоор (`group-data-[user-idle]`) хийвэл эцэг
         * элемент нь `MediaPlayer`-ийн ГАДНА тул атрибут хүрэхгүй.
         */
        <div
          className={[
            'pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-3',
            'bg-linear-to-b from-black/75 via-black/40 to-transparent p-3 md:p-4',
            /* ⚠️ Удирдлагатай ИЖИЛ хугацаа (Vidstack 200ms) */
            'transition-opacity duration-200',
            controlsOn ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          <button
            onClick={() => {
              /**
               * ⚠️⚠️ `replace` — `push` БИШ.
               *
               * БОДИТ АЛДАА: `<Link href>` нь түүхэнд ШИНЭ бичлэг
               * нэмдэг тул зам нь болдог:
               *   нүүр → movie → watch → movie   (4 бичлэг)
               * Тэгээд movie дээрх «Буцах» нь `router.back()` хийхэд
               * WATCH руу буцаж, хэрэглэгч player-т дахин ордог байв
               * — гарах гэж оролдоод буцаад кинондоо ордог ЦИКЛ.
               *
               * `replace` нь watch-ыг movie-ЭЭР СОЛИНО:
               *   нүүр → movie                    (2 бичлэг)
               * Ингэснээр movie дээрх «Буцах» нь НҮҮР рүү зөв очно.
               */
              router.replace(backHref);
            }}
            /**
             * ⚠️⚠️ «БУЦАХ» БИЧИГТЭЙ — дүрс тэмдэг ганцаараа ХОЁРДМОЛ.
             *
             * БОДИТ АСУУДАЛ: зүүн сум ганцаараа байхад хэрэглэгч
             * «өмнөх анги руу очих товч» гэж андуурдаг. Player дотор
             * гарах зам байгааг МЭДЭХГҮЙ тул browser-ийн back дарж,
             * заримдаа огт өөр хуудсанд очдог.
             *
             * ⚠️ 44px өндөр — Apple/Google-ийн хүрэх талбайн хязгаар.
             */
            className="pointer-events-auto flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-4 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-black/85 focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Буцах"
          >
            <ChevronLeft size={20} />
            Буцах
          </button>
          {title && (
            <p className="mt-2 line-clamp-1 text-sm font-semibold text-white drop-shadow-lg md:text-base">
              {title}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
