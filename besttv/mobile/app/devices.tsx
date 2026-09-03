import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { api } from '../src/lib/api';
import { ErrorState } from '../src/components/error-state';
import { colors, font, radius, space } from '../src/theme';

/**
 * НЭВТЭРСЭН ТӨХӨӨРӨМЖ.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: нэг эрхээр 3 төхөөрөмж нэвтэрнэ. Хязгаар
 * хэтрэхэд хамгийн УДААН ашиглаагүй нь автоматаар гардаг. Хэрэглэгч
 * «гэнэт гарчихлаа» гэж гомдох тул аль төхөөрөмж холбогдсоныг ХАРАХ,
 * шаардлагагүйг нь ГАРГАХ боломжтой байх ЁСТОЙ.
 */

interface Session {
  id: string;
  deviceName: string | null;
  ip: string | null;
  lastUsedAt: string;
  createdAt: string;
  current: boolean;
}

export default function DevicesScreen() {
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      /* ⚠️ `rt` — сервер аль нь ЭНЭ төхөөрөмж болохыг мэдэх ёстой */
      const rt = await SecureStore.getItemAsync('btv_refresh');
      const q = rt ? `?rt=${encodeURIComponent(rt)}` : '';
      return api<{ max: number; items: Session[] }>(`/auth/sessions${q}`);
    },
    staleTime: 0,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/auth/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const revokeOthers = useMutation({
    mutationFn: async () => {
      const rt = await SecureStore.getItemAsync('btv_refresh');
      return api('/auth/sessions/revoke-others', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: rt }),
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sessions'] }),
  });

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />;
  }
  if (isLoading || !data) return <View style={styles.screen} />;

  const full = data.items.length >= data.max;

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <Text style={styles.count}>
          {data.items.length} / {data.max}
        </Text>
        <Text style={styles.hint}>
          Нэг эрхээр зэрэг {data.max} төхөөрөмж ашиглана.
          {/* ⚠️ Автомат гаралтыг УРЬДЧИЛАН хэлнэ — гэнэт гарахад
              «эвдэрсэн» гэж бодохоос сэргийлнэ */}
          {' '}Шинэ төхөөрөмжөөс нэвтэрвэл хамгийн удаан ашиглаагүй нь
          автоматаар гарна.
        </Text>
        {full && (
          <Text style={styles.warn}>⚠ Хязгаар дүүрсэн байна</Text>
        )}
      </View>

      <FlatList
        data={data.items}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.row, item.current && styles.rowCurrent]}>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>
                  {item.deviceName || 'Тодорхойгүй төхөөрөмж'}
                </Text>
                {item.current && <Text style={styles.badge}>ЭНЭ ТӨХӨӨРӨМЖ</Text>}
              </View>
              <Text style={styles.meta}>{timeAgo(item.lastUsedAt)}</Text>
              {!!item.ip && (
                <Text style={styles.ip} numberOfLines={1}>
                  {item.ip}
                </Text>
              )}
            </View>

            {/* ⚠️ ӨӨРИЙГӨӨ гаргах товч ХАРУУЛАХГҮЙ — гарах бол
                профайлын «Гарах» товч бий, эндээс гарвал будлиантай */}
            {!item.current && (
              <Pressable
                onPress={() =>
                  Alert.alert(
                    'Гаргах уу?',
                    `«${item.deviceName || 'Тодорхойгүй төхөөрөмж'}» дахин нэвтрэх шаардлагатай болно.`,
                    [
                      { text: 'Болих', style: 'cancel' },
                      {
                        text: 'Гаргах',
                        style: 'destructive',
                        onPress: () => revoke.mutate(item.id),
                      },
                    ],
                  )
                }
                hitSlop={8}
                style={styles.out}
                accessibilityLabel="Гаргах"
              >
                <Text style={styles.outText}>Гаргах</Text>
              </Pressable>
            )}
          </View>
        )}
      />

      {data.items.length > 1 && (
        <Pressable
          onPress={() =>
            Alert.alert(
              'Бусад төхөөрөмжийг гаргах уу?',
              'Энэ төхөөрөмжөөс бусад бүх нэвтрэлт цуцлагдана.',
              [
                { text: 'Болих', style: 'cancel' },
                {
                  text: 'Гаргах',
                  style: 'destructive',
                  onPress: () => revokeOthers.mutate(),
                },
              ],
            )
          }
          style={({ pressed }) => [styles.allBtn, pressed && { opacity: 0.75 }]}
        >
          <Text style={styles.allBtnText}>Бусад бүх төхөөрөмжийг гаргах</Text>
        </Pressable>
      )}
    </View>
  );
}

/** ⚠️ «2026-08-30T13:12» гэхээс «5 минутын өмнө» нь ойлгомжтой */
function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'Яг одоо';
  if (min < 60) return `${min} минутын өмнө`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} цагийн өмнө`;
  return `${Math.floor(h / 24)} хоногийн өмнө`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  head: { padding: space.lg, paddingBottom: space.md },
  count: { color: colors.foreground, fontSize: font.xxl, fontWeight: '800' },
  hint: { color: colors.dim, fontSize: font.sm, marginTop: 4, lineHeight: 19 },
  warn: { color: colors.warning, fontSize: font.sm, marginTop: space.sm },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.lg,
    marginBottom: space.sm,
  },
  rowCurrent: { borderWidth: 1, borderColor: colors.primary },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  name: { color: colors.foreground, fontSize: font.md, fontWeight: '600' },
  badge: {
    color: colors.primary,
    fontSize: font.xs,
    fontWeight: '800',
    backgroundColor: colors.primary + '22',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  meta: { color: colors.dim, fontSize: font.xs, marginTop: 4 },
  ip: { color: colors.faint, fontSize: font.xs, marginTop: 2 },
  out: { paddingHorizontal: space.md, paddingVertical: space.sm },
  outText: { color: colors.destructive, fontSize: font.sm, fontWeight: '600' },
  allBtn: { margin: space.lg, padding: space.md, alignItems: 'center' },
  allBtnText: { color: colors.destructive, fontSize: font.md, fontWeight: '600' },
});
