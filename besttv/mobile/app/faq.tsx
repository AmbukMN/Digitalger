import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../src/lib/api';
import { ErrorState } from '../src/components/error-state';
import { colors, font, radius, space } from '../src/theme';

/**
 * ТҮГЭЭМЭЛ АСУУЛТ.
 *
 * ⚠️ Backend бэлэн байсан атлаа апп дуудахгүй байв — хэрэглэгч
 * асуулттай бол шууд чат руу орж ажилтны цагийг иддэг.
 *
 * ⚠️ Ангиллаар бүлэглэнэ (Багц/Бүртгэл/Техник/Төлбөр) — 9 асуултыг
 * нэг жагсаалтаар харуулбал хайхад хэцүү.
 */

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  order: number;
}

/* ⚠️ Android дээр LayoutAnimation-ыг ГАРААР асаана — эс бөгөөс
   нээх/хаах хөдөлгөөн огт ажиллахгүй */
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function FaqScreen() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['faqs'],
    queryFn: () => api<Faq[] | { items: Faq[] }>('/faqs'),
    staleTime: 10 * 60_000,
  });

  const [openId, setOpenId] = useState<string | null>(null);

  /* ⚠️ Backend жагсаалт эсвэл {items} буцааж болно — хоёуланг тооцно */
  const items = useMemo(() => {
    const raw = Array.isArray(data) ? data : (data?.items ?? []);
    return [...raw].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [data]);

  /* ⚠️ Ангиллаар бүлэглэнэ — ангилалгүй нь ХАМГИЙН СҮҮЛД */
  const groups = useMemo(() => {
    const m = new Map<string, Faq[]>();
    for (const f of items) {
      const k = f.category?.trim() || 'Бусад';
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    return [...m.entries()].sort((a, b) =>
      a[0] === 'Бусад' ? 1 : b[0] === 'Бусад' ? -1 : 0,
    );
  }, [items]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (isError) {
    return <ErrorState message="Асуултуудыг ачаалж чадсангүй" onRetry={() => void refetch()} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {groups.map(([cat, list]) => (
        <View key={cat} style={styles.group}>
          <Text style={styles.groupTitle}>{cat}</Text>
          {list.map((f) => {
            const open = openId === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => {
                  /* ⚠️ Зөөлөн нээлт — гэнэт үсрэх нь эвгүй */
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut,
                  );
                  setOpenId(open ? null : f.id);
                }}
                style={styles.card}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
              >
                <View style={styles.qRow}>
                  <Text style={styles.question}>{f.question}</Text>
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={17}
                    color={colors.faint}
                  />
                </View>
                {open && <Text style={styles.answer}>{f.answer}</Text>}
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* ⚠️ Хариулт олдоогүй хүнд ГАРЦ өгнө — эс бөгөөс хаана хандахаа
          мэдэхгүй үлдэнэ */}
      <Pressable
        onPress={() => router.push('/support')}
        style={({ pressed }) => [styles.askBtn, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        <Ionicons name="chatbubble-ellipses-outline" size={17} color="#fff" />
        <Text style={styles.askText}>Хариулт олдсонгүй — чатаар асуух</Text>
      </Pressable>

      {/* ⚠️ Дэлгүүрийн шаардлага: нөхцөл/нууцлал хүртээмжтэй байх */}
      <View style={styles.legal}>
        <Pressable onPress={() => router.push('/page/terms')} hitSlop={8}>
          <Text style={styles.legalLink}>Үйлчилгээний нөхцөл</Text>
        </Pressable>
        <Text style={styles.legalDot}>·</Text>
        <Pressable onPress={() => router.push('/page/privacy')} hitSlop={8}>
          <Text style={styles.legalLink}>Нууцлалын бодлого</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },

  group: { gap: space.sm },
  groupTitle: {
    color: colors.primary,
    fontSize: font.sm,
    fontWeight: '800',
    marginBottom: space.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  question: {
    flex: 1,
    color: colors.foreground,
    fontSize: font.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
  answer: { color: colors.dim, fontSize: font.sm, lineHeight: 21 },

  askBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 50,
  },
  askText: { color: '#fff', fontSize: font.sm, fontWeight: '700' },

  legal: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  legalLink: { color: colors.faint, fontSize: font.xs, textDecorationLine: 'underline' },
  legalDot: { color: colors.faint, fontSize: font.xs },
});
