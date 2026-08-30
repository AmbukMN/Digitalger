import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { downloadEpisode, isDownloaded, removeLocal } from '../lib/downloads';
import { colors, font } from '../theme';

/**
 * ТАТАХ ТОВЧ — ангийн мөрөнд.
 *
 * ⚠️ Гурван төлөв: татаагүй (↓) · татаж байна (%) · татсан (✓)
 *
 * ⚠️⚠️ Явцыг ХАРУУЛАХ нь чухал: нэг анги 61MB, удаан сүлжээнд минут
 * авна. Явцгүй бол хэрэглэгч «эвдэрсэн» гэж бодоод дахин дарна.
 */
export function DownloadButton({
  target,
  targetId,
}: {
  target: 'movie' | 'episode';
  targetId: string;
}) {
  const qc = useQueryClient();
  const [state, setState] = useState<'none' | 'busy' | 'done'>('none');
  const [pct, setPct] = useState(0);
  /** ⚠️ Болиулах дохио — компонент устахад татацыг зогсооно */
  const signal = useRef({ cancelled: false });

  useEffect(() => {
    let alive = true;
    void isDownloaded(target, targetId).then((yes) => {
      if (alive && yes) setState('done');
    });
    return () => {
      alive = false;
      /* ⚠️ Дэлгэцээс гарахад татацыг зогсооно — далд ажиллуулбал
         хэрэглэгч мэдэхгүй дата зарцуулна */
      signal.current.cancelled = true;
    };
  }, [target, targetId]);

  const start = async () => {
    signal.current = { cancelled: false };
    setState('busy');
    setPct(0);
    try {
      await downloadEpisode(target, targetId, {
        onProgress: (p) => setPct(Math.round(p * 100)),
        signal: signal.current,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setState('done');
      void qc.invalidateQueries({ queryKey: ['downloads'] });
    } catch (e) {
      setState('none');
      const msg = e instanceof Error ? e.message : 'Татаж чадсангүй';
      /* ⚠️ Болиулсныг АЛДАА гэж харуулахгүй */
      if (!msg.includes('болиул')) Alert.alert('Татахад алдаа гарлаа', msg);
    }
  };

  const confirmRemove = () => {
    Alert.alert('Татсаныг устгах уу?', 'Дахин татах шаардлагатай болно.', [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Устгах',
        style: 'destructive',
        onPress: () => {
          void removeLocal(target, targetId).then(() => {
            setState('none');
            void qc.invalidateQueries({ queryKey: ['downloads'] });
          });
        },
      },
    ]);
  };

  if (state === 'busy') {
    return (
      <Pressable
        onPress={() => {
          signal.current.cancelled = true;
        }}
        hitSlop={8}
        style={styles.btn}
        accessibilityLabel="Татахыг болиулах"
      >
        {pct === 0 ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.pct}>{pct}%</Text>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={state === 'done' ? confirmRemove : () => void start()}
      hitSlop={8}
      style={styles.btn}
      accessibilityLabel={state === 'done' ? 'Татсаныг устгах' : 'Татаж авах'}
    >
      <Text style={[styles.icon, state === 'done' && { color: colors.success }]}>
        {state === 'done' ? '✓' : '↓'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* ⚠️ 36px — хүрэлцэх зөвлөмжийн доод хэмжээ */
  btn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: font.lg, color: colors.dim, fontWeight: '700' },
  pct: { fontSize: font.xs, color: colors.primary, fontWeight: '700' },
});
