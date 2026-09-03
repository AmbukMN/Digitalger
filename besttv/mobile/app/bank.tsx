import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE, getAccess } from '../src/lib/api';
import { mnt } from '../src/lib/format';
import { colors, font, radius, space } from '../src/theme';

/**
 * БАНКНЫ ШИЛЖҮҮЛГЭЭР ТӨЛӨХ.
 *
 * ⚠️⚠️ Вэбд ажилладаг атлаа аппад БАЙХГҮЙ байв. QPay ажиллахгүй
 * (лимит, банкны апп суулгаагүй) хэрэглэгчийн ганц гарц.
 *
 * Урсгал: данс харах → гүйлгээ хийх → баримт хавсаргах → баталгаажуулах
 */

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  logoUrl?: string | null;
}
interface BankInfo {
  enabled: boolean;
  note: string;
  requireReceipt: boolean;
  accounts: BankAccount[];
}
interface BankOrder {
  id: string;
  amount: number;
  reference: string;
  status: string;
}

/**
 * ⚠️⚠️ АЮУЛГҮЙ БУЦАЛТ — `safeBack()` нь буцах ТҮҮХГҮЙ үед хоосон
 * дэлгэц үлдээнэ. Мэдэгдлээр эсвэл deep link-ээр шууд орсон
 * хэрэглэгчид яг тэр тохиолдол үүснэ.
 */
function safeBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

export default function BankScreen() {
  const { planId, amount } = useLocalSearchParams<{
    planId?: string;
    amount?: string;
  }>();
  const qc = useQueryClient();
  const [order, setOrder] = useState<BankOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [receiptKey, setReceiptKey] = useState<string | null>(null);

  const info = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => api<BankInfo>('/bank/accounts'),
    staleTime: 5 * 60_000,
  });

  if (info.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  /* ⚠️ Админ унтраасан бол ТОДОРХОЙ хэлнэ — хоосон дэлгэц эвдэрсэн мэт */
  if (!info.data?.enabled || !info.data.accounts.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Банкны шилжүүлэг боломжгүй</Text>
        <Text style={styles.emptyHint}>
          Одоогоор идэвхгүй байна. QPay-ээр төлнө үү.
        </Text>
        <Pressable
          onPress={() => safeBack()}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.btnText}>Буцах</Text>
        </Pressable>
      </View>
    );
  }

  /* ── 1. Захиалга үүсгэх ── */
  const start = async (bankAccountId: string) => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { bankAccountId };
      if (planId) body.planId = planId;
      else if (amount) body.topupAmount = Number(amount);

      const o = await api<BankOrder>('/bank/initiate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setOrder(o);
    } catch (e) {
      Alert.alert('Алдаа', e instanceof Error ? e.message : 'Дахин оролдоно уу');
    } finally {
      setBusy(false);
    }
  };

  /* ── 2. Баримт хавсаргах ── */
  const pickReceipt = async () => {
    /* ⚠️ Зөвшөөрөл — татгалзвал ТОДОРХОЙ хэлнэ, чимээгүй унтрахгүй */
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Зөвшөөрөл хэрэгтэй',
        'Баримтын зураг хавсаргахын тулд зургийн санд хандах зөвшөөрөл өгнө үү.',
      );
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (res.canceled || !res.assets?.length) return;

    setBusy(true);
    try {
      const asset = res.assets[0];
      const form = new FormData();
      form.append('file', {
        uri: asset.uri,
        name: asset.fileName ?? 'receipt.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      } as unknown as Blob);

      /**
       * ⚠️⚠️ `api()` ХЭРЭГЛЭХГҮЙ — тэр нь Content-Type-ыг JSON гэж
       * тавьдаг. FormData-д boundary-г fetch ӨӨРӨӨ тохируулах ёстой:
       * гараар заавал буруу boundary орж, сервер файлыг уншиж чадахгүй.
       */
      const token = await getAccess();
      const r = await fetch(`${API_BASE}/bank/${order!.id}/receipt`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!r.ok) throw new Error('Баримт илгээж чадсангүй');
      const d = (await r.json()) as { receiptKey?: string };
      setReceiptKey(d.receiptKey ?? 'ok');
      Alert.alert('Хүлээн авлаа', 'Баримт хавсаргагдлаа.');
    } catch (e) {
      Alert.alert('Алдаа', e instanceof Error ? e.message : 'Дахин оролдоно уу');
    } finally {
      setBusy(false);
    }
  };

  /* ── 3. Баталгаажуулах ── */
  const claim = async () => {
    setBusy(true);
    try {
      await api(`/bank/${order!.id}/claim`, {
        method: 'POST',
        body: JSON.stringify(receiptKey ? { receiptKey } : {}),
      });
      void qc.invalidateQueries();
      Alert.alert(
        'Хүсэлт илгээлээ',
        'Ажилтан шалгаад баталгаажуулна. Ажлын цагаар 1-3 цаг зарцуулна.',
        [{ text: 'Ойлголоо', onPress: () => safeBack() }],
      );
    } catch (e) {
      Alert.alert('Алдаа', e instanceof Error ? e.message : 'Дахин оролдоно уу');
    } finally {
      setBusy(false);
    }
  };

  /* ══════════ Захиалга үүсээгүй — данс сонгох ══════════ */
  if (!order) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Банкны шилжүүлэг</Text>
        {!!info.data.note && <Text style={styles.note}>{info.data.note}</Text>}

        {info.data.accounts.map((a) => (
          <Pressable
            key={a.id}
            disabled={busy}
            onPress={() => void start(a.id)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.bankRow}>
              {!!a.logoUrl && (
                <Image source={{ uri: a.logoUrl }} style={styles.logo} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.bankName}>{a.bankName}</Text>
                <Text style={styles.accNum}>{a.accountNumber}</Text>
                <Text style={styles.accName}>{a.accountName}</Text>
              </View>
              {busy ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.faint} />
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  /* ══════════ Захиалга үүссэн — заавар ══════════ */
  const acc = info.data.accounts[0];
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Гүйлгээ хийнэ үү</Text>

      <View style={styles.card}>
        <Field label="Банк" value={acc.bankName} />
        <Field label="Данс" value={acc.accountNumber} copy />
        <Field label="Хүлээн авагч" value={acc.accountName} />
        <Field label="Дүн" value={mnt(order.amount)} copy copyText={String(order.amount)} />
        {/**
         * ⚠️⚠️ ГҮЙЛГЭЭНИЙ УТГА нь ХАМГИЙН ЧУХАЛ — үүнгүйгээр ажилтан
         * төлбөрийг хэн хийснийг таних БОЛОМЖГҮЙ. Тодруулж харуулна.
         */}
        <Field label="Гүйлгээний утга" value={order.reference} copy highlight />
      </View>

      <Text style={styles.warn}>
        ⚠️ Гүйлгээний утгыг ЗААВАЛ хуулж тавина уу — эс бөгөөс төлбөр
        тань танигдахгүй.
      </Text>

      {/* ⚠️ Баримт — тохиргооноос хамаарч заавал эсвэл сонголттой */}
      <Pressable
        onPress={() => void pickReceipt()}
        disabled={busy}
        style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.85 }]}
      >
        <Ionicons
          name={receiptKey ? 'checkmark-circle' : 'image-outline'}
          size={18}
          color={receiptKey ? colors.success : colors.foreground}
        />
        <Text style={styles.outlineText}>
          {receiptKey ? 'Баримт хавсаргагдсан' : 'Баримтын зураг хавсаргах'}
          {info.data.requireReceipt && !receiptKey ? ' (заавал)' : ''}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => void claim()}
        /* ⚠️ Баримт заавал бол хавсаргалгүй илгээхийг хориглоно —
           сервер татгалзах тул урьдчилан сэргийлнэ */
        disabled={busy || (info.data.requireReceipt && !receiptKey)}
        style={({ pressed }) => [
          styles.btn,
          (busy || (info.data.requireReceipt && !receiptKey)) && { opacity: 0.4 },
          pressed && { opacity: 0.85 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Гүйлгээ хийсэн — баталгаажуулах</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  copy,
  copyText,
  highlight,
}: {
  label: string;
  value: string;
  copy?: boolean;
  copyText?: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={() => {
          if (!copy) return;
          void Clipboard.setStringAsync(copyText ?? value);
          Alert.alert('Хуулагдлаа', copyText ?? value);
        }}
        style={styles.fieldValRow}
        hitSlop={6}
      >
        <Text
          style={[styles.fieldVal, highlight && { color: colors.premium }]}
          selectable
        >
          {value}
        </Text>
        {copy && <Ionicons name="copy-outline" size={15} color={colors.faint} />}
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
    padding: space.xl,
    backgroundColor: colors.background,
    gap: space.sm,
  },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  title: { color: colors.foreground, fontSize: font.xl, fontWeight: '800' },
  note: { color: colors.dim, fontSize: font.sm, lineHeight: 20 },
  emptyTitle: { color: colors.foreground, fontSize: font.lg, fontWeight: '700' },
  emptyHint: { color: colors.dim, fontSize: font.md, textAlign: 'center' },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  bankRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  logo: { width: 40, height: 40, borderRadius: radius.sm },
  bankName: { color: colors.foreground, fontSize: font.md, fontWeight: '700' },
  accNum: { color: colors.dim, fontSize: font.sm, marginTop: 2 },
  accName: { color: colors.faint, fontSize: font.xs, marginTop: 1 },

  field: { gap: 2 },
  fieldLabel: { color: colors.faint, fontSize: font.xs },
  fieldValRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  fieldVal: { color: colors.foreground, fontSize: font.md, fontWeight: '600' },

  warn: { color: colors.premium, fontSize: font.sm, lineHeight: 19 },

  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 48,
  },
  outlineText: { color: colors.foreground, fontSize: font.sm, fontWeight: '600' },

  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
