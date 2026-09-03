import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

export default function RegisterScreen() {
  const { signUp, signInWithProvider } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setErr('Имэйл болон нууц үгээ оруулна уу');
      return;
    }
    /* ⚠️ Backend 6 тэмдэгт шаарддаг — сервер рүү явахаас ӨМНӨ хэлнэ */
    if (password.length < 6) {
      setErr('Нууц үг дор хаяж 6 тэмдэгт байх ёстой');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await signUp(email.trim(), password, name.trim());
      safeBack();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Бүртгүүлж чадсангүй');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>
          Best<Text style={{ color: colors.primary }}>TV</Text>
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Нэр"
          placeholderTextColor={colors.faint}
          style={styles.input}
          autoCapitalize="words"
          textContentType="name"
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Имэйл"
          placeholderTextColor={colors.faint}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Нууц үг (6+ тэмдэгт)"
          placeholderTextColor={colors.faint}
          style={styles.input}
          secureTextEntry
          /* ⚠️ `newPassword` — iOS-ийн Keychain хүчтэй нууц үг санал болгоно */
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />

        {!!err && <Text style={styles.err}>{err}</Text>}

        <Pressable
          onPress={() => void submit()}
          disabled={busy}
          style={({ pressed }) => [styles.btn, (pressed || busy) && { opacity: 0.7 }]}
        >
          <Text style={styles.btnText}>{busy ? 'Түр хүлээнэ үү…' : 'Бүртгүүлэх'}</Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/login')} style={styles.linkBtn}>
          <Text style={styles.link}>Бүртгэлтэй юу? Нэвтрэх</Text>
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
  err: { color: colors.destructive, fontSize: font.sm, marginBottom: space.md, lineHeight: 19 },
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
