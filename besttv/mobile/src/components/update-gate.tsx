import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useConfig } from '../lib/payments';
import { colors, font, radius, space } from '../theme';

/**
 * ⚠️⚠️ АЛБАДАН ШИНЭЧЛЭЛТ.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ: эвдэрсэн хувилбар дэлгүүрт гарвал буцаах ЗАМГҮЙ.
 * Хэрэглэгч шинэчлэхгүй бол эвдэрсэн аппаа хэдэн сар ашиглана. Энэ
 * хаалт нь `/mobile/config`-ийн `minVersion`-оос доош хувилбарыг
 * БҮРЭН зогсооно.
 *
 * ⚠️ Config татагдаагүй (сүлжээгүй) үед хаахгүй — офлайн үзэлт
 *    ажиллах ёстой.
 */

/** `1.2.3` → `[1,2,3]`, харьцуулахад тохиромжтой */
function parse(v: string): number[] {
  return v.split('.').map((n) => parseInt(n, 10) || 0);
}

/** a < b эсэх */
function isOlder(a: string, b: string): boolean {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d < 0;
  }
  return false;
}

export function UpdateGate({ children }: { children: React.ReactNode }) {
  const { data: cfg } = useConfig();
  const current = Constants.expoConfig?.version ?? '1.0.0';

  /* ⚠️ Config ирээгүй бол ХААХГҮЙ — сүлжээгүй үед апп ажиллах ёстой */
  if (!cfg?.minVersion || !isOlder(current, cfg.minVersion)) {
    return <>{children}</>;
  }

  const store =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/besttv/id0000000000'
      : 'https://play.google.com/store/apps/details?id=mn.besttv.app';

  return (
    <View style={styles.wrap}>
      <Text style={styles.brand}>
        Best<Text style={{ color: colors.primary }}>TV</Text>
      </Text>
      <Text style={styles.title}>Шинэчлэлт шаардлагатай</Text>
      <Text style={styles.body}>
        Аппын шинэ хувилбар гарсан байна. Үргэлжлүүлэхийн тулд шинэчилнэ үү.
      </Text>
      <Text style={styles.ver}>
        Одоогийн {current} · Шаардлагатай {cfg.minVersion}
      </Text>

      <Pressable
        onPress={() => void Linking.openURL(store)}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.btnText}>Шинэчлэх</Text>
      </Pressable>

      {/* ⚠️ Вэб рүү гарц ҮЛДЭЭНЭ — шинэчилж чадахгүй хэрэглэгч (хуучин
          iOS, зай дүүрсэн) бүрэн хаагдвал үйлчилгээ алдана */}
      <Pressable
        onPress={() => void Linking.openURL(cfg.webUrl)}
        style={styles.linkBtn}
      >
        <Text style={styles.link}>Вэбсайтаар үзэх</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: colors.background,
  },
  brand: { color: colors.foreground, fontSize: 34, fontWeight: '800', marginBottom: space.xl },
  title: { color: colors.foreground, fontSize: font.xl, fontWeight: '700' },
  body: {
    color: colors.dim,
    fontSize: font.md,
    textAlign: 'center',
    marginTop: space.sm,
    lineHeight: 22,
  },
  ver: {
    color: colors.faint,
    fontSize: font.xs,
    marginTop: space.md,
    marginBottom: space.xl,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: font.md },
  linkBtn: { marginTop: space.lg, padding: space.sm },
  link: { color: colors.dim, fontSize: font.md, textDecorationLine: 'underline' },
});
