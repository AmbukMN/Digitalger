import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { date, mnt } from '../../src/lib/format';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import {
  useAutoRenew,
  useCancelSubscription,
} from '../../src/lib/payments';
import { useState } from 'react';
import { useAuth } from '../../src/lib/auth';
import { useUnreadCount } from '../../src/lib/queries';
import { api } from '../../src/lib/api';
import { colors, font, radius, space } from '../../src/theme';

export default function ProfileScreen() {
  const { me, loading, signOut } = useAuth();
  const autoRenew = useAutoRenew();
  const cancelSub = useCancelSubscription();
  /* ⚠️ Нэвтрээгүй үед дуудахгүй — зочинд 401 */
  const unread = useUnreadCount(!!me);
  /* ⚠️ Анхдагч ON — бүртгэх үед backend `enabled: true` тавьдаг */
  const [pushOn, setPushOn] = useState(true);

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
            <View key={s.id ?? s.planId} style={styles.subCard}>
              <View style={styles.subRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subName}>{s.planName}</Text>
                  {!s.isVip && !!s.genres?.length && (
                    <Text style={styles.subGenres}>
                      {s.genres.map((g) => g.name).join(' · ')}
                    </Text>
                  )}
                </View>
                <Text style={styles.subDate}>{date(s.expiresAt)}</Text>
              </View>

              {/**
               * ⚠️⚠️ УДИРДЛАГА — зөвхөн `id` ирсэн үед.
               * Backend өгдөг нь батлагдсан (auth.service.ts:282) ч
               * тип нь `id?` тул хамгаалалт үлдээв.
               */}
              {!!s.id && (
                <View style={styles.subActions}>
                  {/* ⚠️ Авто-сунгалтын төлөвийг ХАРУУЛНА — мэдэлгүй
                      мөнгө хасагдвал гомдол болдог */}
                  <Pressable
                    onPress={() =>
                      autoRenew.mutate(
                        { id: s.id!, enabled: !s.autoRenew },
                        {
                          onError: (e: unknown) =>
                            Alert.alert(
                              'Алдаа',
                              e instanceof Error ? e.message : 'Дахин оролдоно уу',
                            ),
                        },
                      )
                    }
                    disabled={autoRenew.isPending}
                    style={styles.subAction}
                    hitSlop={6}
                  >
                    <Ionicons
                      name={s.autoRenew ? 'repeat' : 'repeat-outline'}
                      size={15}
                      color={s.autoRenew ? colors.success : colors.faint}
                    />
                    <Text
                      style={[
                        styles.subActionText,
                        s.autoRenew && { color: colors.success },
                      ]}
                    >
                      {s.autoRenew ? 'Авто-сунгалт асаалттай' : 'Авто-сунгалт унтраалттай'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        'Багц цуцлах уу?',
                        /* ⚠️⚠️ Үлдсэн хоног ДАГАЖ УСТАНА — буцаалт
                           хийгддэггүй. Тодорхой хэлж байж зөвшөөрүүлнэ */
                        `«${s.planName}» багцыг цуцалснаар эрх ШУУД хаагдаж, ` +
                          `үлдсэн хоног дагаж устана. Буцаалт хийгдэхгүй.`,
                        [
                          { text: 'Болих', style: 'cancel' },
                          {
                            text: 'Цуцлах',
                            style: 'destructive',
                            onPress: () =>
                              cancelSub.mutate(s.id!, {
                                onSuccess: () =>
                                  Alert.alert('Цуцлагдлаа', 'Багц цуцлагдсан.'),
                                onError: (e: unknown) =>
                                  Alert.alert(
                                    'Цуцалж чадсангүй',
                                    e instanceof Error ? e.message : 'Дахин оролдоно уу',
                                  ),
                              }),
                          },
                        ],
                      )
                    }
                    disabled={cancelSub.isPending}
                    style={styles.subAction}
                    hitSlop={6}
                  >
                    <Text style={styles.subCancel}>Цуцлах</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* ⚠️⚠️ Профайл засах — нэр/имэйл/утас/нууц үг. Вэбэд байдаг
          атлаа аппад байхгүй байсан (хэрэглэгч нэрээ ч солиж чадахгүй) */}
      <Pressable
        onPress={() => router.push('/account')}
        style={({ pressed }) => [styles.card, styles.navRow, pressed && { opacity: 0.75 }]}
        accessibilityRole="button"
        accessibilityLabel="Профайл засах"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Ionicons name="person-circle-outline" size={20} color={colors.dim} />
          <Text style={styles.rowLabel}>Профайл засах</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </Pressable>

      {/* ⚠️ Хэтэвч — дарж гүйлгээ/захиалгын түүх рүү орно */}
      <Text style={styles.section}>Хэтэвч</Text>
      <Pressable
        onPress={() => router.push('/wallet')}
        style={({ pressed }) => [styles.card, styles.navRow, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.wallet}>{mnt(me.walletBalance)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </Pressable>

      {/*
        ⚠️ Багц авах дэлгэц — QPay + 22 банкны deeplink.
        `paymentsEnabled` унтраасан бол тэр дэлгэц өөрөө вэб рүү
        чиглүүлнэ (Apple татгалзсан тохиолдолд).
      */}
      <Pressable
        onPress={() => router.push('/pricing')}
        style={({ pressed }) => [styles.btn, styles.fullBtn, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.btnText}>Багц авах / сунгах</Text>
      </Pressable>

      {/* ⚠️ Мэдэгдэл — push дарж амжаагүй хэрэглэгч эндээс үзнэ */}
      <Pressable
        onPress={() => router.push('/notifications')}
        style={({ pressed }) => [styles.card, styles.navRow, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.rowValue}>Мэдэгдэл</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {/* ⚠️⚠️ Уншаагүй мэдэгдэл байгааг хэрэглэгч ОГТ мэдэхгүй
              байв — push ирээгүй бол бүрмөсөн алдагдана.
              ⚠️ 99+ таслана — гурваас олон орон мөрийг эвдэнэ */}
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </View>
      </Pressable>

      {/* ⚠️⚠️ FAQ — чат руу орохоос ӨМНӨ. Ихэнх асуулт эндээс
          хариулагдвал ажилтны цаг хэмнэгдэнэ */}
      <Pressable
        onPress={() => router.push('/faq')}
        style={({ pressed }) => [styles.card, styles.navRow, pressed && { opacity: 0.75 }]}
        accessibilityRole="button"
        accessibilityLabel="Түгээмэл асуулт"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Ionicons name="help-circle-outline" size={20} color={colors.dim} />
          <Text style={styles.rowLabel}>Түгээмэл асуулт</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </Pressable>

      {/* ⚠️ Тусламж — вэбийн чат widget-тэй ИЖИЛ backend (n8n AI) */}
      <Pressable
        onPress={() => router.push('/support')}
        style={({ pressed }) => [styles.card, styles.navRow, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.rowValue}>Тусламж / Чат</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </Pressable>

      <Text style={styles.section}>Тохиргоо</Text>
      <View style={styles.card}>
        {/*
          ⚠️ Push унтраах — токеныг УСТГАХГҮЙ, зөвхөн `enabled: false`.
          Дахин асаахад ижил токен ашиглана (Expo шинэ токен өгөх
          шаардлагагүй, зөвшөөрөл дахин асуухгүй).
        */}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Мэдэгдэл</Text>
          <Switch
            value={pushOn}
            onValueChange={(v) => {
              setPushOn(v);
              /* ⚠️ Алдаа гарвал БУЦААНА — эс бөгөөс UI худал харуулна */
              api('/notifications/push/toggle', {
                method: 'POST',
                body: JSON.stringify({ enabled: v }),
              }).catch(() => setPushOn(!v));
            }}
            trackColor={{ false: colors.secondary, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
        {/* ⚠️ Дарж нэвтэрсэн төхөөрөмжөө харах/гаргах */}
        <Pressable
          onPress={() => router.push('/devices')}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.rowLabel}>Төхөөрөмж</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>
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

      {/*
        ⚠️⚠️ APPLE 5.1.1(v) — АКАУНТ ҮҮСГЭДЭГ АПП НЬ ДАНС УСТГАХ ЗАМЫГ
        АПП ДОТРООС ӨГӨХ ЁСТОЙ. Байхгүй бол review дээр ТАТГАЛЗАНА.

        ⚠️ Устгалт нь эргэшгүй бөгөөд төлбөрийн түүхэд нөлөөлдөг тул
        вэбийн хуудсаар (баталгаажуулалттай) гүйцэтгэнэ — апп дотор
        нэг товчоор устгах нь санамсаргүй дарах эрсдэлтэй.
      */}
      <Pressable
        onPress={() =>
          Alert.alert(
            'Данс устгах',
            'Данс устгах хүсэлтийг вэбсайтаар илгээнэ. Устгасны дараа ' +
              'бүх мэдээлэл, багц, түүх эргэлт буцалтгүй арилна.',
            [
              { text: 'Болих', style: 'cancel' },
              {
                text: 'Үргэлжлүүлэх',
                onPress: () =>
                  void Linking.openURL('https://besttv.us/p/data-deletion'),
              },
            ],
          )
        }
        style={({ pressed }) => [styles.deleteAcc, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.deleteAccText}>Данс устгах</Text>
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
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  subCard: { gap: space.sm, paddingVertical: space.sm },
  subActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  subAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  subActionText: { color: colors.faint, fontSize: font.xs },
  subCancel: { color: colors.destructive, fontSize: font.xs, fontWeight: '600' },
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
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chevron: { color: colors.faint, fontSize: font.xl },
  signOut: { padding: space.lg, alignItems: 'center' },
  signOutText: { color: colors.destructive, fontSize: font.md, fontWeight: '600' },
  /* ⚠️ Гарахаас БҮДЭГ — санамсаргүй дарахаас сэргийлнэ */
  deleteAcc: { padding: space.md, alignItems: 'center' },
  deleteAccText: { color: colors.faint, fontSize: font.sm },
});
