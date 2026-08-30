import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, space } from '../theme';

/**
 * СҮЛЖЭЭГҮЙ АНХААРУУЛГА.
 *
 * ⚠️⚠️ Үүнгүйгээр сүлжээ тасрахад хэрэглэгч зөвхөн «алдаа гарлаа»
 * гэсэн мессеж хараад аппыг эвдэрсэн гэж боддог. Шалтгааныг хэлэх нь
 * гомдлын тоог мэдэгдэхүйц бууруулна.
 *
 * ⚠️ Татсан контент сүлжээгүй ч ажилладгийг САНУУЛНА — офлайн татацын
 * гол давуу тал нь хэрэглэгчид мартагддаг.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const slide = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => {
      /**
       * ⚠️⚠️ `isInternetReachable` нь эхэндээ `null` (шалгаагүй) байдаг —
       * түүнийг «сүлжээгүй» гэж үзвэл апп нээгдэх бүрд анхааруулга
       * дэмий анивчина. Зөвхөн ТОДОРХОЙ `false` үед л харуулна.
       */
      const bad = s.isConnected === false || s.isInternetReachable === false;
      setOffline(bad);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: offline ? 0 : -60,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [offline, slide]);

  /* ⚠️ Онлайн үед DOM-оос хасахгүй — гарах анимаци дуусахгүй үлдэнэ */
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bar,
        { paddingTop: insets.top + space.xs, transform: [{ translateY: slide }] },
      ]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>
        Сүлжээгүй байна — татсан кино хэвийн ажиллана
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    /* ⚠️ Бүх дэлгэцээс ДЭЭГҮҮР — модал дээр ч харагдана */
    zIndex: 999,
    backgroundColor: colors.destructive,
    paddingBottom: space.sm,
    paddingHorizontal: space.lg,
  },
  text: { color: '#fff', fontSize: font.sm, textAlign: 'center', fontWeight: '600' },
});
