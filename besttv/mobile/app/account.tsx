import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { colors, font, radius, space } from '../src/theme';

/**
 * ПРОФАЙЛ ЗАСАХ.
 *
 * ⚠️⚠️ Вэб дээр байдаг атлаа аппад БАЙХГҮЙ байсан — хэрэглэгч нэрээ ч
 * солиж чаддаггүй байв.
 *
 * Гурван хэсэг: үндсэн мэдээлэл · утас баталгаажуулах · нууц үг солих.
 */
export default function AccountScreen() {
  const { me, refresh } = useAuth();

  if (!me) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ProfileSection me={me} onSaved={refresh} />
        <PhoneSection me={me} onVerified={refresh} />
        <PasswordSection />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ══════════ 1. Үндсэн мэдээлэл ══════════ */

function ProfileSection({
  me,
  onSaved,
}: {
  me: { name: string | null; email: string; emailVerified: boolean };
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(me.name ?? '');
  const [email, setEmail] = useState(me.email);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const emailChanged = email.trim().toLowerCase() !== me.email.toLowerCase();
  const dirty = name.trim() !== (me.name ?? '') || emailChanged;

  const save = async () => {
    if (!name.trim()) {
      setErr('Нэрээ оруулна уу');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, string> = { name: name.trim() };
      if (emailChanged) body.email = email.trim();
      await api('/auth/me', { method: 'PATCH', body: JSON.stringify(body) });
      await onSaved();
      Alert.alert(
        'Хадгаллаа',
        /* ⚠️ Имэйл солиход OTP баталгаажуулалт шаардагдана — хэрэглэгч
           «болсон» гэж бодоод хаяхаас сэргийлж ТОДОРХОЙ хэлнэ */
        emailChanged
          ? 'Шинэ имэйл рүү баталгаажуулах код илгээлээ. Баталгаажуулж дуустал хуучин хаяг хэвээр байна.'
          : 'Мэдээлэл шинэчлэгдлээ.',
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Хадгалж чадсангүй');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Үндсэн мэдээлэл</Text>

      <Text style={styles.label}>Нэр</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Таны нэр"
        placeholderTextColor={colors.faint}
        style={styles.input}
        editable={!busy}
        accessibilityLabel="Нэр"
      />

      <View style={styles.labelRow}>
        <Text style={styles.label}>Имэйл</Text>
        {me.emailVerified ? (
          <View style={styles.okTag}>
            <Ionicons name="checkmark-circle" size={13} color={colors.success} />
            <Text style={styles.okText}>Баталгаажсан</Text>
          </View>
        ) : (
          <Text style={styles.warnText}>Баталгаажаагүй</Text>
        )}
      </View>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Имэйл"
        placeholderTextColor={colors.faint}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        editable={!busy}
        accessibilityLabel="Имэйл хаяг"
      />
      {emailChanged && (
        <Text style={styles.hint}>
          ⚠️ Имэйл солиход шинэ хаяг руу код илгээж баталгаажуулна
        </Text>
      )}

      {!!err && <Text style={styles.err}>{err}</Text>}

      <Pressable
        onPress={() => void save()}
        disabled={busy || !dirty}
        style={({ pressed }) => [
          styles.btn,
          (!dirty || busy) && { opacity: 0.4 },
          pressed && { opacity: 0.8 },
        ]}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Хадгалах</Text>
        )}
      </Pressable>
    </View>
  );
}

/* ══════════ 2. Утас баталгаажуулах ══════════ */

interface VerifySession {
  sessionId: string;
  code: string;
  smsUri: string;
  displayInstruction: string;
}

/**
 * ⚠️⚠️ MO SMS — хэрэглэгч ӨӨРӨӨ 144773 руу код илгээнэ (бид SMS
 * илгээдэггүй). Тиймээс «код хүлээж байна» биш «та илгээнэ үү» гэж
 * заана — эс бөгөөс хэрэглэгч SMS хүлээгээд сууна.
 */
function PhoneSection({
  me,
  onVerified,
}: {
  me: { phone: string | null; phoneVerified: boolean };
  onVerified: () => void | Promise<void>;
}) {
  const [phone, setPhone] = useState(me.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [session, setSession] = useState<VerifySession | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  /* ⚠️ Дэлгэцээс гарахад polling ЗААВАЛ зогсоно — эс бөгөөс далд
     ажиллаж, батарей болон дата дэмий зарцуулна */
  useEffect(() => stop, [stop]);

  const start = async () => {
    const p = phone.trim();
    if (!/^\d{8}$/.test(p)) {
      setErr('8 оронтой дугаараа оруулна уу');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const s = await api<VerifySession>('/auth/request-phone-verify', {
        method: 'POST',
        body: JSON.stringify({ phone: p }),
      });
      setSession(s);

      /* ⚠️ 3 секунд тутам — verify.mn 2с дотор давтвал 429 буцаана */
      stop();
      let ticks = 0;
      timer.current = setInterval(() => {
        ticks += 1;
        /* ⚠️⚠️ ХЯЗГААР — 5 минут (100 tick). Үүнгүй бол хэрэглэгч
           орхиход апп ҮҮРД сервер рүү залгасаар байна. */
        if (ticks > 100) {
          stop();
          setErr('Хугацаа дууслаа. Дахин оролдоно уу.');
          setSession(null);
          return;
        }
        void api<{ status: string }>(
          `/auth/phone-verify/status?sessionId=${encodeURIComponent(s.sessionId)}`,
        )
          .then(async (r) => {
            if (r.status === 'verified') {
              stop();
              setSession(null);
              await onVerified();
              Alert.alert('Баталгаажлаа', 'Утасны дугаар амжилттай баталгаажлаа.');
            } else if (r.status === 'expired') {
              stop();
              setSession(null);
              setErr('Хугацаа дууссан. Дахин оролдоно уу.');
            }
          })
          /* ⚠️ Сүлжээ саатвал зогсоохгүй — дараагийн tick дээр дахин үзнэ */
          .catch(() => {});
      }, 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Хүсэлт илгээж чадсангүй');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <Text style={styles.cardTitle}>Утасны дугаар</Text>
        {me.phoneVerified && (
          <View style={styles.okTag}>
            <Ionicons name="checkmark-circle" size={13} color={colors.success} />
            <Text style={styles.okText}>Баталгаажсан</Text>
          </View>
        )}
      </View>

      {session ? (
        <View style={{ gap: space.md }}>
          <Text style={styles.instruction}>{session.displayInstruction}</Text>

          {/* ⚠️ Код нь ТОМООР — хэрэглэгч гараар бичих магадлалтай */}
          <View style={styles.codeBox}>
            <Text style={styles.code} selectable>
              {session.code}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              /* ⚠️ Мессежийн апп нээгдэхгүй байж болно (эмулятор,
                 SIM-гүй таблет) — унавал заавраа харуулсан хэвээр */
              void Linking.openURL(session.smsUri).catch(() =>
                setErr('Мессежийн апп нээгдсэнгүй. Гараар илгээнэ үү.'),
              );
            }}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.btnText}>Мессеж илгээх</Text>
          </Pressable>

          <View style={styles.waitRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.hint}>Илгээсний дараа автоматаар шалгана…</Text>
          </View>

          <Pressable
            onPress={() => {
              stop();
              setSession(null);
            }}
            hitSlop={8}
          >
            <Text style={styles.cancel}>Болих</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="99112233"
            placeholderTextColor={colors.faint}
            style={styles.input}
            keyboardType="number-pad"
            maxLength={8}
            editable={!busy}
            accessibilityLabel="Утасны дугаар"
          />
          {!!err && <Text style={styles.err}>{err}</Text>}
          <Pressable
            onPress={() => void start()}
            disabled={busy}
            style={({ pressed }) => [styles.btn, (busy || pressed) && { opacity: 0.8 }]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>
                {me.phoneVerified ? 'Дугаар солих' : 'Баталгаажуулах'}
              </Text>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

/* ══════════ 3. Нууц үг солих ══════════ */

function PasswordSection() {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!cur || !next) {
      setErr('Бүх талбарыг бөглөнө үү');
      return;
    }
    /* ⚠️ Backend-ийн MinLength(6)-тай ЯГ ИЖИЛ — өөр байвал хэрэглэгч
       сервер рүү явж байж алдаа хардаг, эвгүй */
    if (next.length < 6) {
      setErr('Шинэ нууц үг доод тал нь 6 тэмдэгт байна');
      return;
    }
    if (next !== again) {
      setErr('Шинэ нууц үг таарахгүй байна');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: cur, newPassword: next }),
      });
      setCur('');
      setNext('');
      setAgain('');
      Alert.alert('Амжилттай', 'Нууц үг солигдлоо.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Солиж чадсангүй');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Нууц үг солих</Text>

      <TextInput
        value={cur}
        onChangeText={setCur}
        placeholder="Одоогийн нууц үг"
        placeholderTextColor={colors.faint}
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        editable={!busy}
        accessibilityLabel="Одоогийн нууц үг"
      />
      <TextInput
        value={next}
        onChangeText={setNext}
        placeholder="Шинэ нууц үг (6+ тэмдэгт)"
        placeholderTextColor={colors.faint}
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        editable={!busy}
        accessibilityLabel="Шинэ нууц үг"
      />
      <TextInput
        value={again}
        onChangeText={setAgain}
        placeholder="Шинэ нууц үг давтах"
        placeholderTextColor={colors.faint}
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        editable={!busy}
        accessibilityLabel="Шинэ нууц үг давтах"
      />

      {!!err && <Text style={styles.err}>{err}</Text>}

      <Pressable
        onPress={() => void save()}
        disabled={busy}
        style={({ pressed }) => [styles.btn, (busy || pressed) && { opacity: 0.8 }]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Нууц үг солих</Text>
        )}
      </Pressable>
    </View>
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

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: font.lg,
    fontWeight: '700',
    marginBottom: space.xs,
  },
  label: { color: colors.dim, fontSize: font.sm, marginTop: space.xs },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  okTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  okText: { color: colors.success, fontSize: font.xs, fontWeight: '600' },
  warnText: { color: colors.premium, fontSize: font.xs, fontWeight: '600' },

  input: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 48,
    color: colors.foreground,
    fontSize: font.md,
  },
  hint: { color: colors.faint, fontSize: font.xs, lineHeight: 17 },
  err: { color: colors.destructive, fontSize: font.sm, lineHeight: 19 },

  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  btnText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
  cancel: { color: colors.dim, fontSize: font.sm, textAlign: 'center' },

  instruction: { color: colors.foreground, fontSize: font.md, lineHeight: 21 },
  codeBox: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  code: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 3,
  },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
