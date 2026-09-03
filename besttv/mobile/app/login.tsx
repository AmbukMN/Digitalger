import { useState } from 'react';
import {
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
import { useAuth } from '../src/lib/auth';
import { SocialAuth } from '../src/components/social-auth';
import { colors, font, radius, space } from '../src/theme';

/**
 * ⚠️⚠️ АЮУЛГҮЙ БУЦАЛТ.
 *
 * `safeBack()` нь буцах ТҮҮХГҮЙ үед хоосон дэлгэц үлдээнэ.
 * Мэдэгдлээр эсвэл deep link-ээр шууд энэ дэлгэц рүү орсон
 * хэрэглэгчид яг тэр тохиолдол үүснэ.
 */
function safeBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

export default function LoginScreen() {
  const { signIn, signInWithProvider } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setErr('Имэйл болон нууц үгээ оруулна уу');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await signIn(email.trim(), password);
      safeBack();
    } catch (e) {
      /* ⚠️ Backend-ийн монгол мессежийг харуулна */
      setErr(e instanceof Error ? e.message : 'Нэвтэрч чадсангүй');
    } finally {
      setBusy(false);
    }
  };

  return (
    /* ⚠️ Гар гарахад талбар далдлагдахаас сэргийлнэ */
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>
          Best<Text style={{ color: colors.primary }}>TV</Text>
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Имэйл эсвэл утас"
          placeholderTextColor={colors.faint}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="next"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Нууц үг"
          placeholderTextColor={colors.faint}
          style={styles.input}
          secureTextEntry
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />

        {!!err && <Text style={styles.err}>{err}</Text>}

        <Pressable
          onPress={() => void submit()}
          disabled={busy}
          style={({ pressed }) => [styles.btn, (pressed || busy) && { opacity: 0.7 }]}
        >
          <Text style={styles.btnText}>{busy ? 'Түр хүлээнэ үү…' : 'Нэвтрэх'}</Text>
        </Pressable>

        {/* ⚠️⚠️ ЗААВАЛ — үүнгүйгээр нууц үгээ мартсан хэрэглэгч
            апп дотор БҮРМӨСӨН гацна */}
        <Pressable
          onPress={() => router.push('/forgot-password')}
          style={styles.linkBtn}
          hitSlop={8}
        >
          <Text style={styles.link}>Нууц үгээ мартсан уу?</Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/register')} style={styles.linkBtn}>
          <Text style={styles.link}>Бүртгэлгүй юу? Бүртгүүлэх</Text>
        </Pressable>

        {/*
          ⚠️ Apple Sign-In — App Store-ийн 4.8 дүрмээр ЗААВАЛ (Google/FB
          байгаа тул). Зөвхөн iOS дээр харагдана.
        */}
        <SocialAuth
          busy={busy}
          onToken={(p) => {
            setBusy(true);
            setErr(null);
            signInWithProvider(p)
              .then(() => safeBack())
              .catch((e: unknown) =>
                setErr(e instanceof Error ? e.message : 'Нэвтэрч чадсангүй'),
              )
              .finally(() => setBusy(false));
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.xl, paddingTop: space.xxl },
  brand: {
    color: colors.foreground,
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: space.xxl,
  },
  input: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    height: 50,
    color: colors.foreground,
    fontSize: font.md,
    marginBottom: space.md,
  },
  err: {
    color: colors.destructive,
    fontSize: font.sm,
    marginBottom: space.md,
    lineHeight: 19,
  },
  btn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: font.md },
  linkBtn: { marginTop: space.xl, alignItems: 'center', padding: space.sm },
  link: { color: colors.dim, fontSize: font.md },
});
