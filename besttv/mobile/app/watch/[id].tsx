import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent, useEventListener } from 'expo';
import * as ScreenOrientation from 'expo-screen-orientation';
import { API_BASE, getAccess } from '../../src/lib/api';
import { useSaveProgress } from '../../src/lib/queries';
import { localPlaylist } from '../../src/lib/downloads';
import { colors, font, radius, space } from '../../src/theme';

/**
 * Видео тоглуулагч.
 *
 * ⚠️⚠️ HLS playlist нь `Authorization` header шаарддаг (эрх шалгана).
 * `expo-video` нь `headers` дэмждэг тул токеныг дамжуулна.
 *
 * ⚠️ Playlist доторх variant зам нь ХАРЬЦАНГУЙ (`/api/stream/...`) тул
 * плеер өөрөө үндсэн хостоос шийднэ.
 */
export default function WatchScreen() {
  const { id, kind, title, pos, tid, nextId, nextNum, offline, target } =
    useLocalSearchParams<{
    id: string;
    kind?: string;
    title?: string;
    pos?: string;
    /** ⚠️⚠️ ЦУВРАЛД ЗААВАЛ — `id` нь episodeId тул киноны id тусад нь
        ирэх ёстой. Эс бөгөөс явц episodeId дор бичигдэж «Үргэлжлүүлэх»
        эгнээ БУРУУ ажиллана. */
    tid?: string;
    /** Дараагийн ангийн id — байвал төгсгөлд санал болгоно */
    nextId?: string;
    /** Дараагийн ангийн дугаар — «5-р анги» гэж харуулна */
    nextNum?: string;
    /** ⚠️ `1` бол ЛОКАЛ файлаас тоглуулна (сүлжээгүй ч ажиллана) */
    offline?: string;
    target?: string;
  }>();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const saveProgress = useSaveProgress();
  const lastSave = useRef(0);

  const isOffline = offline === '1';
  const kindTarget = target ?? (kind === 'movie' ? 'movie' : 'episode');
  /**
   * ⚠️⚠️ ОФЛАЙН: локал m3u8 — сүлжээ рүү ОГТ орохгүй.
   * Онлайн: серверийн playlist (эрх шалгагдана).
   */
  const url = isOffline
    ? localPlaylist(kindTarget, String(id))
    : `${API_BASE}/stream/${kindTarget}/${id}/playlist.m3u8`;

  useEffect(() => {
    void getAccess().then(setToken).finally(() => setReady(true));
  }, []);

  /**
   * ⚠️⚠️ ДЭЛГЭЦИЙН ЭРГЭЛТ — зөвхөн ЭНЭ дэлгэц дээр чөлөөтэй.
   * Гарахад БОСОО болгож буцаана, эс бөгөөс каталог хэвтээ үлдэнэ.
   */
  useEffect(() => {
    void ScreenOrientation.unlockAsync();
    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  const player = useVideoPlayer(
    /* ⚠️ Офлайнд header ХЭРЭГГҮЙ — локал файл */
    ready
      ? {
          uri: url,
          headers: !isOffline && token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      : null,
    (p) => {
      p.timeUpdateEventInterval = 5;
      /* ⚠️ Үргэлжлүүлэх байрлал — нүүрнээс дамжина */
      const start = Number(pos ?? 0);
      if (start > 5) p.currentTime = start;
      p.play();
    },
  );

  const { status, error } = useEvent(player, 'statusChange', {
    status: player.status,
    error: undefined as Error | undefined,
  });

  /**
   * ⚠️⚠️ ДАРААГИЙН АНГИ — 10 секундын тоолуур.
   *
   * АВТОМАТААР үсрэхгүй, БОЛИХ товчтой: хэрэглэгч титрийн дуу сонсох
   * эсвэл зүгээр орхих эрхтэй. Вэб дээрх зан авиртай ИЖИЛ.
   */
  const [countdown, setCountdown] = useState<number | null>(null);
  /* ⚠️ `flush` доор зарлагддаг тул ref-ээр холбоно — шилжихийн өмнө
     явцыг хадгалахгүй бол дууссан анги «үзээгүй» хэвээр үлдэнэ */
  const flushRef = useRef<((force?: boolean) => void) | null>(null);
  const goNext = useCallback(() => {
    if (!nextId) return;
    flushRef.current?.(true);
    /* ⚠️ `replace` — `push` бол буцах товч дарахад өмнөх ангиуд
       давхарлан хуримтлагдана */
    router.replace(
      `/watch/${nextId}?kind=episode&tid=${tid ?? ''}` +
        `&title=${encodeURIComponent(title ?? '')}` +
        (offline === '1' ? '&offline=1&target=episode' : ''),
    );
  }, [nextId, tid, title, offline]);

  /* ⚠️ `playToEnd` нь аргументгүй event — `useEventListener`-ээр барина
     (`useEvent` нь утга буцаадаг event-д зориулагдсан) */
  useEventListener(player, 'playToEnd', () => {
    if (nextId) setCountdown(10);
  });

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      goNext();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, goNext]);

  /**
   * ⚠️⚠️ ҮЗСЭН ЯВЦ — 5 секунд тутам ирдэг ч сервер рүү 20 сек тутам л
   * илгээнэ. Тутам илгээвэл 1 цагийн кинонд 720 хүсэлт болно.
   */
  useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  /**
   * ⚠️⚠️ ЯВЦ ХАДГАЛАХ — ганц эх сурвалж.
   *
   * `force` нь дэлгэцээс ГАРАХ үед — 20 секундын хязгаарыг алгасна,
   * эс бөгөөс хэрэглэгч буцах товч дармагц сүүлийн 20 сек АЛДАГДАНА.
   */
  const flush = useCallback(
    (force = false) => {
      if (isOffline) return;
      const now = player.currentTime;
      const dur = player.duration;
      if (!dur || now < 5) return;
      if (!force && now - lastSave.current < 20) return;
      lastSave.current = now;
      saveProgress.mutate(
        {
          /* ⚠️⚠️ Цувралд `id` нь episodeId — киноны id-г `tid`-ээс авна.
             Хоёуланг нь ижил өгвөл «Үргэлжлүүлэх» эгнээ эвдэрнэ. */
          titleId: String(tid ?? id),
          ...(kindTarget === 'episode' ? { episodeId: String(id) } : {}),
          positionSec: Math.floor(now),
          durationSec: Math.floor(dur),
        },
        {
          /* ⚠️ Чимээгүй унана — офлайн/сүлжээ саатвал хэрэглэгчид
             алдаа харуулах шаардлагагүй, зүгээр л алгасна */
          onError: () => {},
        },
      );
    },
    [player, id, tid, kindTarget, saveProgress, isOffline],
  );

  /* ⚠️ Дараагийн анги руу шилжихэд ашиглагдана */
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    const t = setInterval(() => flush(false), 5000);
    return () => {
      clearInterval(t);
      /* ⚠️⚠️ ГАРАХАД ЭЦСИЙН ХАДГАЛАЛТ — үүнгүйгээр буцах товч дарахад
         сүүлийн 20 секунд алдагдаж, дахин нээхэд ХОЙШ үсэрнэ */
      flush(true);
    };
  }, [flush]);

  /**
   * ⚠️⚠️ АПП ДАРААС РУУ ОРОХОД ч хадгална — хэрэглэгч home товч дараад
   * аппыг устгавал `unmount` ажиллахгүй, явц бүрмөсөн алдагдана.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') flush(true);
    });
    return () => sub.remove();
  }, [flush]);

  return (
    <View style={styles.screen}>
      <VideoView
        style={styles.video}
        player={player}
        /**
         * ⚠️ Нэйтив удирдлага — seek, дуу, бүтэн дэлгэц.
         *
         * ⚠️⚠️ ХАДМАЛ ЭНД ГАРАХГҮЙ: `expo-video` нь хадмалыг ЗӨВХӨН
         * media source-оос уншдаг (`availableSubtitleTracks`), гаднаас
         * VTT залгах API байхгүй. Манай HLS playlist-д
         * `#EXT-X-MEDIA:TYPE=SUBTITLES` мөр БАЙХГҮЙ тул хадмал огт
         * ирэхгүй. Засах бол backend талд playlist-д хадмал нэмэх
         * шаардлагатай — тэр нь ВЭБЭД нөлөөлөх тул тусад нь шийднэ.
         */
        nativeControls
        allowsPictureInPicture
        /* ⚠️ Апп дэвсгэрт орох үед дуу үргэлжилнэ (app.json-д зөвшөөрсөн) */
        startsPictureInPictureAutomatically={false}
        contentFit="contain"
      />

      {/* ⚠️⚠️ ДАРААГИЙН АНГИ — автоматаар үсрэхгүй, БОЛИХ боломжтой.
          Хэрэглэгч титрийн дуу сонсох эрхтэй (вэбтэй ижил зан авир) */}
      {countdown !== null && (
        <View style={styles.nextBox}>
          <Text style={styles.nextLabel}>
            {nextNum ? `${nextNum}-р анги` : 'Дараагийн анги'}
          </Text>
          <Text style={styles.nextCount}>{countdown} секундын дараа</Text>
          <View style={styles.nextRow}>
            <Pressable
              onPress={() => {
                setCountdown(null);
                goNext();
              }}
              style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <Text style={styles.nextBtnText}>Одоо үзэх</Text>
            </Pressable>
            <Pressable
              onPress={() => setCountdown(null)}
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Болих</Text>
            </Pressable>
          </View>
        </View>
      )}

      {status === 'loading' && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.primary} />
          {!!title && <Text style={styles.loadingText}>{title}</Text>}
        </View>
      )}

      {status === 'error' && (
        <View style={styles.overlay}>
          <Text style={styles.errTitle}>Тоглуулж чадсангүй</Text>
          <Text style={styles.errText}>
            {error?.message?.includes('403') || error?.message?.includes('401')
              ? 'Энэ контентыг үзэх эрх байхгүй байна'
              : 'Сүлжээгээ шалгаад дахин оролдоно уу'}
          </Text>
          <Pressable onPress={() => router.back()} style={styles.btn}>
            <Text style={styles.btnText}>Буцах</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    padding: space.xl,
  },
  loadingText: { color: colors.dim, fontSize: font.md, marginTop: space.lg },
  errTitle: { color: colors.foreground, fontSize: font.lg, fontWeight: '700' },
  errText: {
    color: colors.dim,
    fontSize: font.md,
    textAlign: 'center',
    marginTop: space.sm,
    marginBottom: space.xl,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: font.md },

  /* ⚠️ Баруун доод буланд — видеоны удирдлагыг халхлахгүй */
  nextBox: {
    position: 'absolute',
    right: space.lg,
    bottom: space.xxl + space.lg,
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
    minWidth: 210,
  },
  nextLabel: { color: colors.foreground, fontSize: font.md, fontWeight: '700' },
  nextCount: { color: colors.dim, fontSize: font.sm },
  nextRow: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  nextBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: space.sm,
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: font.sm },
  cancelBtn: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.dim, fontSize: font.sm },
});
