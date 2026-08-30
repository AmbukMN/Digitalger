import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { reportError } from '../lib/report-error';
import { colors, font, radius, space } from '../theme';

/**
 * АЛДААНЫ ХИЛ.
 *
 * ⚠️⚠️ ҮҮНГҮЙГЭЭР ямар ч render алдаа гарвал БҮХ АПП хар дэлгэц болж,
 * хэрэглэгчид сэргэх ЯМАР Ч зам үлдэхгүй — аппыг устгаж дахин
 * суулгахаас өөр аргагүй болно.
 *
 * ⚠️ Class компонент байх ЁСТОЙ — React-д алдаа барих hook байхгүй.
 */
interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    /**
     * ⚠️⚠️ Серверт МЭДЭГДЭНЭ — эс бөгөөс production дээр юу эвдэрснийг
     * мэдэх ямар ч арга байхгүй (хэрэглэгч гомдоллохоос нааш).
     *
     * ⚠️ `void` — мэдээлэх нь унасан ч UI сэргээх ажил зогсох ЁСГҮЙ.
     */
    void reportError(error, {
      source: 'error-boundary',
      componentStack: info.componentStack?.slice(0, 2000) ?? null,
    });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Уучлаарай, алдаа гарлаа</Text>
          <Text style={styles.text}>
            Аппад санаандгүй алдаа гарлаа. Дахин оролдоно уу — асуудал
            давтагдвал бидэнд мэдэгдээрэй.
          </Text>

          {/**
           * ⚠️ Техникийн мессежийг ХАРУУЛНА (нуухгүй) — хэрэглэгч
           * дэмжлэгт хандахдаа хуулж илгээх боломжтой байх ёстой.
           */}
          <View style={styles.errBox}>
            <Text style={styles.errText} selectable>
              {error.message || String(error)}
            </Text>
          </View>

          <Pressable
            onPress={() => this.setState({ error: null })}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>Дахин оролдох</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: space.xl,
    gap: space.md,
  },
  title: { color: colors.foreground, fontSize: font.xl, fontWeight: '800' },
  text: { color: colors.dim, fontSize: font.md, lineHeight: 22 },
  errBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.sm,
  },
  errText: { color: colors.faint, fontSize: font.xs, lineHeight: 17 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
  },
  btnText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
