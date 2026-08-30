import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import * as ScreenOrientation from 'expo-screen-orientation';
import { API_BASE, getAccess } from '../../src/lib/api';
import { useSaveProgress } from '../../src/lib/queries';
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
  const { id, kind, title, pos } = useLocalSearchParams<{
    id: string;
    kind?: string;
    title?: string;
    pos?: string;
  }>();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const saveProgress = useSaveProgress();
  const lastSave = useRef(0);

  const target = kind === 'movie' ? 'movie' : 'episode';
  const url = `${API_BASE}/stream/${target}/${id}/playlist.m3u8`;

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
    ready ? { uri: url, headers: token ? { Authorization: `Bearer ${token}` } : undefined } : null,
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
   * ⚠️⚠️ ҮЗСЭН ЯВЦ — 5 секунд тутам ирдэг ч сервер рүү 20 сек тутам л
   * илгээнэ. Тутам илгээвэл 1 цагийн кинонд 720 хүсэлт болно.
   */
  useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  useEffect(() => {
    const t = setInterval(() => {
      const now = player.currentTime;
      const dur = player.duration;
      if (!dur || now < 5 || now - lastSave.current < 20) return;
      lastSave.current = now;
      saveProgress.mutate({
        titleId: String(id),
        ...(target === 'episode' ? { episodeId: String(id) } : {}),
        positionSec: Math.floor(now),
        durationSec: Math.floor(dur),
      });
    }, 5000);
    return () => clearInterval(t);
  }, [player, id, target, saveProgress]);

  return (
    <View style={styles.screen}>
      <VideoView
        style={styles.video}
        player={player}
        /* ⚠️ Нэйтив удирдлага — seek, чанар, хадмал бүгд орсон.
            Бүтэн дэлгэц нь удирдлагад АВТОМАТААР багтсан (expo-video 57-д
            `allowsFullscreen` талбар хасагдсан). */
        nativeControls
        allowsPictureInPicture
        /* ⚠️ Апп дэвсгэрт орох үед дуу үргэлжилнэ (app.json-д зөвшөөрсөн) */
        startsPictureInPictureAutomatically={false}
        contentFit="contain"
      />

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
});
