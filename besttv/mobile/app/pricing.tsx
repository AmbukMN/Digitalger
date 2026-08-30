import { useEffect, useState } from 'react';
import { mnt } from '../src/lib/format';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../src/lib/auth';
import {
  useConfig,
  useCreateInvoice,
  usePaymentStatus,
  usePlans,
  usePurchaseWithWallet,
  useValidateCoupon,
  type CouponResult,
  type Plan,
  type QPayInvoice,
} from '../src/lib/payments';
import { ErrorState } from '../src/components/error-state';
import { colors, font, radius, space } from '../src/theme';

/**
 * БАГЦ АВАХ — QPay.
 *
 * ⚠️⚠️ APPLE-ИЙН IAP ЭРСДЭЛ: дижитал захиалгыг App Store-ийн дүрмээр
 * IAP-аар зарах шаардлагатай. QPay нь «reader app» статусаар
 * зөвтгөгдөх боломжтой ч БАТАЛГАА байхгүй.
 *
 * Тиймээс `/mobile/config`-ийн `paymentsEnabled` тугаар удирдана:
 * Apple татгалзвал АЛСААС унтраагаад «Вэб дээр авна уу» гэсэн текст
 * үлдээнэ — апп дахин build хийхгүй.
 */
export default function PricingScreen() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const { data: cfg } = useConfig();
  const { data: plans, isLoading, isError, error, refetch } = usePlans();
  const createInvoice = useCreateInvoice();
  const [invoice, setInvoice] = useState<QPayInvoice | null>(null);
  const [picked, setPicked] = useState<Plan | null>(null);

  /* ⚠️ Купон — багц сонгохоос ӨМНӨ оруулна (хямдарсан үнийг харуулна) */
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState<CouponResult | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const validateCoupon = useValidateCoupon();
  const purchaseWallet = usePurchaseWithWallet();
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  const balance = me?.walletBalance ?? 0;

  const { data: status } = usePaymentStatus(invoice?.paymentId ?? null);

  /* ⚠️ Төлбөр баталгаажмагц эрхийг ШУУД шинэчилнэ — эс бөгөөс
     хэрэглэгч «төлсөн атал нээгдэхгүй» гэж гомдоно */
  useEffect(() => {
    if (!status?.paid) return;
    void qc.invalidateQueries();
    setInvoice(null);
    setPicked(null);
    router.back();
  }, [status?.paid, qc]);

  /* ⚠️ Нэвтрээгүй бол төлбөр эхлүүлэх боломжгүй (backend 401) */
  if (!me) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Багц авах</Text>
        <Text style={styles.hint}>Багц авахын тулд эхлээд нэвтэрнэ үү</Text>
        <Pressable onPress={() => router.push('/login')} style={styles.btn}>
          <Text style={styles.btnText}>Нэвтрэх</Text>
        </Pressable>
      </View>
    );
  }

  /* ⚠️⚠️ Төлбөр АЛСААС унтраагдсан — вэб рүү чиглүүлнэ */
  if (cfg && !cfg.paymentsEnabled) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Багц авах</Text>
        <Text style={styles.hint}>
          Багцаа манай вэбсайтаар авна уу. Авсны дараа апп дээрээ шууд үзэх
          боломжтой.
        </Text>
        <Pressable
          onPress={() => void Linking.openURL(`${cfg.webUrl}/pricing`)}
          style={styles.btn}
        >
          <Text style={styles.btnText}>Вэбсайт руу очих</Text>
        </Pressable>
      </View>
    );
  }

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />;
  }

  /* ── Invoice үүссэн — банк сонгох ── */
  if (invoice) {
    return (
      <BankPicker
        invoice={invoice}
        plan={picked}
        onCancel={() => {
          setInvoice(null);
          setPicked(null);
        }}
      />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Багц сонгох</Text>
      <Text style={styles.sub}>
        Багц идэвхжсэнээр тухайн ангиллын бүх кино нээгдэнэ
      </Text>

      {/* ⚠️⚠️ КУПОН — багц сонгохоос ӨМНӨ. Дараа нь оруулах боломжгүй
          (invoice үүссэн бол үнэ тогтчихсон) */}
      <View style={styles.couponBox}>
        <TextInput
          value={coupon}
          onChangeText={(v) => {
            setCoupon(v);
            /* ⚠️ Код өөрчлөгдвөл хуучин хямдрал ХҮЧИНГҮЙ — эс бөгөөс
               буруу үнэ харуулна */
            if (applied) setApplied(null);
            if (couponErr) setCouponErr(null);
          }}
          placeholder="Купон код (заавал биш)"
          placeholderTextColor={colors.faint}
          style={styles.couponInput}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={32}
          editable={!validateCoupon.isPending}
        />
        <Pressable
          onPress={() => {
            const c = coupon.trim();
            if (!c || !plans?.length) return;
            setCouponErr(null);
            /* ⚠️ Хамгийн хямд багцын үнээр шалгана — купон нь дүнгээс
               хамаарах доод хязгаартай байж болно */
            const cheapest = plans.reduce((a, b) => (a.price <= b.price ? a : b));
            validateCoupon.mutate(
              { code: c, price: cheapest.price },
              {
                onSuccess: (r) => setApplied(r),
                onError: (e) =>
                  setCouponErr(e instanceof Error ? e.message : 'Купон хүчингүй'),
              },
            );
          }}
          disabled={!coupon.trim() || validateCoupon.isPending}
          style={({ pressed }) => [
            styles.couponBtn,
            (!coupon.trim() || validateCoupon.isPending) && { opacity: 0.4 },
            pressed && { opacity: 0.8 },
          ]}
        >
          {validateCoupon.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.couponBtnText}>Шалгах</Text>
          )}
        </Pressable>
      </View>
      {!!applied && (
        <Text style={styles.couponOk}>
          ✓ {mnt(applied.discount)} хямдрал идэвхжлээ
        </Text>
      )}
      {!!couponErr && <Text style={styles.couponErr}>{couponErr}</Text>}

      {isLoading || !plans ? (
        <View style={{ paddingVertical: space.xxl }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        plans.map((p) => (
          <Pressable
            key={p.id}
            disabled={createInvoice.isPending || busyPlan !== null}
            onPress={() => {
              /* ⚠️ Купон нь ТУХАЙН үнэд шалгагдсан — өөр багц сонгосон
                 бол дахин шалгуулах ёстой (хямдрал дүнгээс хамаарна) */
              const code = applied?.code;
              const price = applied && applied.code === coupon.trim().toUpperCase()
                ? applied.finalPrice
                : p.price;

              /* ⚠️⚠️ ХЭТЭВЧИНД ХҮРЭЛЦЭХ бол СОНГОЛТ өгнө — QPay дамжих
                 шаардлагагүй байхад дамжуулах нь орлогын саад */
              if (balance >= price) {
                Alert.alert(
                  'Төлбөрийн хэлбэр',
                  `${p.name} — ${mnt(price)}
Хэтэвчний үлдэгдэл: ${mnt(balance)}`,
                  [
                    { text: 'Болих', style: 'cancel' },
                    {
                      text: 'Хэтэвчээр',
                      onPress: () => {
                        setBusyPlan(p.id);
                        purchaseWallet.mutate(
                          { planId: p.id, couponCode: code },
                          {
                            onSuccess: () => {
                              setBusyPlan(null);
                              Alert.alert('Амжилттай', 'Багц идэвхжлээ.');
                              router.back();
                            },
                            onError: (e) => {
                              setBusyPlan(null);
                              Alert.alert(
                                'Төлж чадсангүй',
                                e instanceof Error ? e.message : 'Дахин оролдоно уу',
                              );
                            },
                          },
                        );
                      },
                    },
                    {
                      text: 'QPay',
                      onPress: () => {
                        setPicked(p);
                        createInvoice.mutate(
                          { planId: p.id, couponCode: code },
                          { onSuccess: setInvoice, onError: () => setPicked(null) },
                        );
                      },
                    },
                  ],
                );
                return;
              }

              setPicked(p);
              createInvoice.mutate(
                { planId: p.id, couponCode: code },
                { onSuccess: setInvoice, onError: () => setPicked(null) },
              );
            }}
            style={({ pressed }) => [
              styles.card,
              p.isVip && styles.vipCard,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={styles.cardHead}>
              <Text style={[styles.planName, p.isVip && { color: colors.premium }]}>
                {p.name}
              </Text>
              <Text style={styles.price}>{mnt(p.price)}</Text>
            </View>
            <Text style={styles.days}>{p.durationDays} хоног</Text>

            {/* ⚠️ Аль жанрыг нээхийг ТОДОРХОЙ хэлнэ — хэрэглэгч буруу
                багц аваад дараа нь гомдох нь түгээмэл */}
            {!p.isVip && !!p.genres?.length && (
              <View style={styles.genreRow}>
                {p.genres.map((g) => (
                  <Text key={g.genre.id} style={styles.genreTag}>
                    {g.genre.name}
                  </Text>
                ))}
              </View>
            )}
            {p.isVip && <Text style={styles.vipNote}>Бүх контент нээлттэй</Text>}
          </Pressable>
        ))
      )}

      {createInvoice.isPending && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Нэхэмжлэх үүсгэж байна…</Text>
        </View>
      )}
      {createInvoice.isError && (
        <Text style={styles.err}>
          {(createInvoice.error as Error)?.message || 'Нэхэмжлэх үүсгэж чадсангүй'}
        </Text>
      )}
    </ScrollView>
  );
}

/**
 * БАНК СОНГОХ.
 *
 * ⚠️⚠️ Энэ бол QPay-ийн МОБАЙЛ дээрх ГОЛ давуу тал: хэрэглэгч банкаа
 * дараад аппаа шууд нээнэ. Вэб дээрх шиг QR зураг гэрэл зургаар
 * уншуулах шаардлагагүй.
 *
 * ⚠️ Банкны апп СУУЛГААГҮЙ бол `openURL` алдаа өгнө — `canOpenURL`-ээр
 *    урьдчилан шалгаж, суулгаагүй банкийг бүдэгрүүлнэ.
 */
function BankPicker({
  invoice,
  plan,
  onCancel,
}: {
  invoice: QPayInvoice;
  plan: Plan | null;
  onCancel: () => void;
}) {
  const [openable, setOpenable] = useState<Record<string, boolean>>({});

  useEffect(() => {
    /* ⚠️ iOS-д `LSApplicationQueriesSchemes` заагаагүй scheme-д
       `canOpenURL` нь ҮРГЭЛЖ false буцаана. Тиймээс шалгалт бүтэлгүйтвэл
       товчийг ИДЭВХТЭЙ үлдээнэ (хэрэглэгч өөрөө оролдоно). */
    let cancelled = false;
    void Promise.all(
      invoice.urls.map(async (u) => {
        try {
          return [u.name, await Linking.canOpenURL(u.link)] as const;
        } catch {
          return [u.name, true] as const;
        }
      }),
    ).then((pairs) => {
      if (!cancelled) setOpenable(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [invoice.urls]);

  const open = async (link: string) => {
    try {
      await Linking.openURL(link);
    } catch {
      /* ⚠️ Банкны апп байхгүй — чимээгүй унахгүй, хэрэглэгчид хэлнэ */
      setOpenable((s) => ({ ...s, [link]: false }));
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Банкаа сонгоно уу</Text>
      <Text style={styles.sub}>
        {plan?.name} · {mnt(invoice.amount)}
      </Text>

      {/* ⚠️ Хүлээж байгааг ТОДОРХОЙ харуулна — хэрэглэгч банкнаас буцаж
          ирээд юу болохыг мэдэхгүй бол дахин төлөх эрсдэлтэй */}
      <View style={styles.waiting}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.waitingText}>
          Төлбөрийг хүлээж байна… Банкны аппаас буцаж ирээрэй.
        </Text>
      </View>

      <View style={styles.bankGrid}>
        {invoice.urls.map((u) => {
          const can = openable[u.name] !== false;
          return (
            <Pressable
              key={u.name}
              onPress={() => void open(u.link)}
              style={({ pressed }) => [
                styles.bank,
                !can && { opacity: 0.35 },
                pressed && { opacity: 0.6 },
              ]}
            >
              {!!u.logo && (
                <Image source={{ uri: u.logo }} style={styles.bankLogo} resizeMode="contain" />
              )}
              <Text style={styles.bankName} numberOfLines={2}>
                {u.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={onCancel} style={styles.cancelBtn}>
        <Text style={styles.cancel}>Болих</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  couponBox: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  couponInput: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 46,
    color: colors.foreground,
    fontSize: font.md,
  },
  couponBtn: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84,
  },
  couponBtnText: { color: colors.foreground, fontWeight: '700', fontSize: font.sm },
  couponOk: { color: colors.success, fontSize: font.sm, marginBottom: space.sm },
  couponErr: { color: colors.destructive, fontSize: font.sm, marginBottom: space.sm },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, paddingBottom: space.xxl },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: colors.background,
  },
  title: { color: colors.foreground, fontSize: font.xxl, fontWeight: '800' },
  sub: { color: colors.dim, fontSize: font.md, marginTop: 4, marginBottom: space.xl },
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
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vipCard: { borderColor: colors.premium },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { color: colors.foreground, fontSize: font.lg, fontWeight: '700', flex: 1 },
  price: { color: colors.foreground, fontSize: font.xl, fontWeight: '800' },
  days: { color: colors.faint, fontSize: font.sm, marginTop: 2 },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  genreTag: {
    color: colors.dim,
    fontSize: font.xs,
    backgroundColor: colors.secondary,
    paddingHorizontal: space.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  vipNote: { color: colors.premium, fontSize: font.sm, marginTop: space.sm },

  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.lg,
    marginBottom: space.lg,
  },
  waitingText: { color: colors.dim, fontSize: font.sm, flex: 1, lineHeight: 19 },

  bankGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  bank: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
    gap: 6,
  },
  bankLogo: { width: 36, height: 36 },
  bankName: { color: colors.dim, fontSize: 10, textAlign: 'center' },

  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: font.md },
  cancelBtn: { marginTop: space.xl, padding: space.md, alignItems: 'center' },
  cancel: { color: colors.dim, fontSize: font.md },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
  },
  loadingText: { color: colors.dim, fontSize: font.sm },
  err: { color: colors.destructive, fontSize: font.sm, marginTop: space.md },
});
