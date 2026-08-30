import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, space } from '../theme';
import { CARD_W } from './title-card';

/**
 * ⚠️⚠️ SPINNER БИШ SKELETON — төслийн дүрэм.
 *
 * Spinner нь «хэр удах бол» гэдгийг хэлдэггүй ба дата ирэхэд layout
 * үсэрдэг. Skeleton нь эцсийн бүтцийг урьдчилан харуулна.
 */
function Shimmer({ style }: { style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    /* ⚠️ `useNativeDriver` — JS thread чөлөөтэй үлдэж, гүйлгэлт таардаг */
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 0.75,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0.35,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);

  return <Animated.View style={[styles.base, style, { opacity: v }]} />;
}

/** Постерын эгнээний skeleton */
export function RowSkeleton() {
  return (
    <View style={styles.row}>
      <Shimmer style={{ width: 130, height: 16, marginBottom: space.md }} />
      <View style={{ flexDirection: 'row' }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ marginRight: space.md }}>
            <Shimmer
              style={{ width: CARD_W, height: CARD_W * 1.5, borderRadius: radius.md }}
            />
            <Shimmer style={{ width: CARD_W - 24, height: 12, marginTop: space.sm }} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Нүүр хуудсанд — 3 эгнээ */
export function HomeSkeleton() {
  return (
    <View>
      <Shimmer style={{ height: 200, borderRadius: 0, marginBottom: space.xl }} />
      {[0, 1, 2].map((i) => (
        <RowSkeleton key={i} />
      ))}
    </View>
  );
}

/** Сүлжээтэй холбоотой картуудын сүлжээ (каталог, хайлт) */
export function GridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ marginBottom: space.lg }}>
          <Shimmer
            style={{ width: CARD_W, height: CARD_W * 1.5, borderRadius: radius.md }}
          />
          <Shimmer style={{ width: CARD_W - 30, height: 12, marginTop: space.sm }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.secondary, borderRadius: radius.sm },
  row: { paddingHorizontal: space.lg, marginBottom: space.xl },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
});
