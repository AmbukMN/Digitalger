import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/lib/api';
import { colors, font, radius, space } from '../src/theme';

/**
 * НУУЦ ҮГ СЭРГЭЭХ.
 *
 * ⚠️⚠️ ҮҮНГҮЙГЭЭР нууц үгээ мартсан хэрэглэгч апп дотор БҮРМӨСӨН
 * гацна — сошиал нэвтрэлтгүй хүн орох ямар ч зам үлдэхгүй.
 *
 * ⚠️ Шинэ нууц үгийг ЭНД тавихгүй: линкийн токен имэйлээр ирдэг ба
 * түүнийг вэб дээр боловсруулна. Апп дотор reset хийхийн тулд deep
 * link (`besttv://reset?token=`) тохируулах шаардлагатай — тэр нь
 * имэйлийн загварыг ӨӨРЧИЛНӨ гэсэн үг, вэбэд нөлөөлөх тул хийхгүй.
 */
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const e = email.trim();
    if (!e) {
      setErr('Имэйл хаягаа оруулна уу');
      return;
    }
    /* ⚠️ Энгийн шалгалт — сервер эцсийн шийдвэрийг гаргана */
    if (!e.includes('@') || !e.includes('.')) {
      setErr('Имэйл хаяг буруу байна');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email: e }),
      });
      setSent(true);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Илгээж чадсангүй');
    } finally {
      setBusy(false);
    }
  };

  /* ── Амжилттай илгээсэн ── */
  if (sent) {
    return (
      <View style={styles.screen}>
        <View style={styles.doneWrap}>
          <Ionicons name="mail-outline" size={54} color={colors.primary} />
          <Text style={styles.doneTitle}>Заавар илгээлээ</Text>
          {/**
           * ⚠️⚠️ «Имэйл олдсонгүй» гэж ХЭЛЭХГҮЙ — сервер ч ялгаагүй хариу
           * буцаадаг (бүртгэлтэй хаягийг таах халдлагаас сэргийлнэ).
           * Тиймээс UI-д ч ялгаа гаргаж БОЛОХГҮЙ.
           */}
          <Text style={styles.doneText}>
            Хэрэв <Text style={{ color: colors.foreground }}>{email.trim()}</Text> хаягаар
            бүртгэлтэй бол нууц үг сэргээх холбоос очих болно.
          </Text>
          <Text style={styles.doneHint}>
            Ирээгүй бол Spam хавтсаа шалгаарай. Холбоос 1 цагийн дараа хүчингүй болно.
          </Text>

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.btnText}>Нэвтрэх рүү буцах</Text>
          </Pressable>

          {/* ⚠️ Дахин илгээх зам — имэйл ирээгүй тохиолдол цөөнгүй */}
          <Pressable onPress={() => setSent(false)} hitSlop={8}>
            <Text style={styles.link}>Өөр хаягаар оролдох</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Нууц үгээ мартсан уу?</Text>
        <Text style={styles.sub}>
          Бүртгэлтэй имэйл хаягаа оруулбал сэргээх холбоос илгээнэ.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Имэйл хаяг"
          placeholderTextColor={colors.faint}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          /* ⚠️ Android-д textContentType ажиллахгүй — autoComplete хэрэгтэй */
          autoComplete="email"
          returnKeyType="send"
          onSubmitEditing={() => void submit()}
          editable={!busy}
          accessibilityLabel="Имэйл хаяг"
        />

        {!!err && <Text style={styles.err}>{err}</Text>}

        <Pressable
          onPress={() => void submit()}
          disabled={busy}
          style={({ pressed }) => [
            styles.btn,
            (busy || pressed) && { opacity: 0.8 },
          ]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Холбоос илгээх</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.link}>Нэвтрэх рүү буцах</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.xl, paddingTop: space.xxl, gap: space.md },
  title: { color: colors.foreground, fontSize: font.xxl, fontWeight: '800' },
  sub: { color: colors.dim, fontSize: font.md, lineHeight: 21, marginBottom: space.sm },
  input: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    /* ⚠️ 50px — хүрэлцэх зөвлөмжийн доод хэмжээнээс дээгүүр */
    height: 50,
    color: colors.foreground,
    fontSize: font.md,
  },
  err: { color: colors.destructive, fontSize: font.sm, lineHeight: 19 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  btnText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
  link: {
    color: colors.dim,
    fontSize: font.sm,
    textAlign: 'center',
    marginTop: space.lg,
  },

  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    gap: space.md,
  },
  doneTitle: { color: colors.foreground, fontSize: font.xl, fontWeight: '800' },
  doneText: {
    color: colors.dim,
    fontSize: font.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  doneHint: {
    color: colors.faint,
    fontSize: font.sm,
    textAlign: 'center',
    lineHeight: 19,
  },
});
