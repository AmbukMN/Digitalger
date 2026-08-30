import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '../../src/lib/auth';
import { colors, font, radius, space } from '../../src/theme';

export default function ProfileScreen() {
  const { me, loading, signOut } = useAuth();

  if (loading) {
    return <View style={styles.screen} />;
  }

  /* ── Нэвтрээгүй ── */
  if (!me) {
    return (
      <View style={styles.center}>
        <Text style={styles.brand}>
          Best<Text style={{ color: colors.primary }}>TV</Text>
        </Text>
        <Text style={styles.hint}>
          Нэвтэрч багцаа удирдах, дуртай кинонуудаа хадгална уу
        </Text>
        <Pressable
          onPress={() => router.push('/login')}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.btnText}>Нэвтрэх</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/register')} style={styles.linkBtn}>
          <Text style={styles.link}>Шинээр бүртгүүлэх</Text>
        </Pressable>
      </View>
    );
  }

  const active = me.subscriptions ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* ── Хэрэглэгч ── */}
      <View style={styles.card}>
        <Text style={styles.name}>{me.name || 'Хэрэглэгч'}</Text>
        <Text style={styles.email}>{me.email}</Text>
        {!me.emailVerified && (
          <Text style={styles.warn}>⚠ Имэйл баталгаажаагүй</Text>
        )}
      </View>

      {/* ── Багц ── */}
      <Text style={styles.section}>Идэвхтэй багц</Text>
      <View style={styles.card}>
        {active.length === 0 ? (
          <Text style={styles.dim}>
            Багц байхгүй — зөвхөн үнэгүй контент үзнэ
          </Text>
        ) : (
          active.map((s) => (
            <View key={s.id ?? s.planId} style={styles.subRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subName}>{s.planName}</Text>
                {!s.isVip && !!s.genres?.length && (
                  <Text style={styles.subGenres}>
                    {s.genres.map((g) => g.name).join(' · ')}
                  </Text>
                )}
              </View>
              <Text style={styles.subDate}>
                {new Date(s.expiresAt).toLocaleDateString('mn-MN')}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* ⚠️ Хэтэвч — вэбтэй ижил мэдээлэл харагдана */}
      <Text style={styles.section}>Хэтэвч</Text>
      <View style={styles.card}>
        <Text style={styles.wallet}>{me.walletBalance.toLocaleString('mn-MN')}₮</Text>
      </View>

      {/*
        ⚠️⚠️ БАГЦ АВАХ нь ВЭБ рүү чиглүүлнэ (эхний хувилбар).
        Apple-ийн IAP дүрмийн эрсдэлээс болж апп дотор шууд зарахгүй —
        `/mobile/config`-оор алсаас асаах боломжтой болгоно.
      */}
      <Pressable
        onPress={() => void Linking.openURL('https://besttv.us/pricing')}
        style={({ pressed }) => [styles.btn, styles.fullBtn, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.btnText}>Багц авах / сунгах</Text>
      </Pressable>

      <Text style={styles.section}>Тохиргоо</Text>
      <View style={styles.card}>
        <Row label="Төхөөрөмж" value="3 хүртэл" />
        <Row label="Хувилбар" value={Constants.expoConfig?.version ?? '1.0.0'} />
      </View>

      <Pressable
        onPress={() =>
          Alert.alert('Гарах уу?', 'Дахин нэвтрэх шаардлагатай болно.', [
            { text: 'Болих', style: 'cancel' },
            { text: 'Гарах', style: 'destructive', onPress: () => void signOut() },
          ])
        }
        style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.signOutText}>Гарах</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, paddingBottom: space.xxl },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: colors.background,
  },
  brand: { color: colors.foreground, fontSize: 34, fontWeight: '800' },
  hint: {
    color: colors.dim,
    fontSize: font.md,
    textAlign: 'center',
    marginTop: space.sm,
    marginBottom: space.xl,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.lg,
  },
  name: { color: colors.foreground, fontSize: font.xl, fontWeight: '700' },
  email: { color: colors.dim, fontSize: font.sm, marginTop: 2 },
  warn: { color: colors.warning, fontSize: font.sm, marginTop: space.sm },
  section: {
    color: colors.dim,
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: space.sm,
    marginLeft: 2,
  },
  dim: { color: colors.dim, fontSize: font.md },
  subRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: space.sm,
    gap: space.sm,
  },
  subName: { color: colors.foreground, fontSize: font.md, fontWeight: '600' },
  subGenres: { color: colors.faint, fontSize: font.xs, marginTop: 2 },
  subDate: { color: colors.dim, fontSize: font.sm },
  wallet: { color: colors.foreground, fontSize: font.xxl, fontWeight: '800' },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  fullBtn: { marginBottom: space.xl },
  btnText: { color: '#fff', fontWeight: '700', fontSize: font.md },
  linkBtn: { marginTop: space.lg, padding: space.sm },
  link: { color: colors.dim, fontSize: font.md, textDecorationLine: 'underline' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
  rowLabel: { color: colors.dim, fontSize: font.md },
  rowValue: { color: colors.foreground, fontSize: font.md },
  signOut: { padding: space.lg, alignItems: 'center' },
  signOutText: { color: colors.destructive, fontSize: font.md, fontWeight: '600' },
});
