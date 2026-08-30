import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../theme';

/**
 * Алдааны төлөв.
 *
 * ⚠️ Backend-ийн МОНГОЛ мессежийг харуулна — «Алдаа гарлаа» гэсэн
 * ерөнхий текст юу буруу болсныг хэлдэггүй тул хэрэглэгч дахин дахин
 * оролдоно.
 *
 * ⚠️ «Дахин оролдох» товч ЗААВАЛ — сүлжээ түр тасарсан тохиолдол
 * мобайлд байнга гардаг.
 */
export function ErrorState({
  message,
  onRetry,
  compact,
}: {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <Text style={styles.icon}>⚠</Text>
      <Text style={styles.msg}>{message || 'Алдаа гарлаа'}</Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>Дахин оролдох</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Хоосон жагсаалт — алдаа БИШ */
export function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emptyText}>{text}</Text>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
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
  compact: { flex: 0, paddingVertical: space.xxl },
  icon: { fontSize: 32, color: colors.warning, marginBottom: space.md },
  msg: {
    color: colors.foreground,
    fontSize: font.md,
    textAlign: 'center',
    marginBottom: space.lg,
    lineHeight: 22,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: font.md },
  emptyText: { color: colors.dim, fontSize: font.md, textAlign: 'center' },
  hint: { color: colors.faint, fontSize: font.sm, marginTop: space.sm, textAlign: 'center' },
});
