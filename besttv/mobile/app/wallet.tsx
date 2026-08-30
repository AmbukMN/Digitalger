import { useState } from 'react';
import { date, mnt } from '../src/lib/format';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../src/lib/api';
import { EmptyState, ErrorState } from '../src/components/error-state';
import { colors, font, radius, space } from '../src/theme';

/**
 * ХЭТЭВЧ + ЗАХИАЛГЫН ТҮҮХ.
 *
 * ⚠️ Вэбийн профайлын 2 таб («Хэтэвч», «Захиалга»)-ыг нэг дэлгэцэд.
 */

interface WalletTx {
  id: string;
  type: 'TOPUP' | 'ADMIN_CREDIT' | 'ADMIN_DEBIT' | 'PURCHASE' | 'REFUND';
  amount: number;
  balanceAfter: number;
  description: string | null;
  planName: string | null;
  createdAt: string;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
  isWalletTopup: boolean;
  titleName: string | null;
  provider: string | null;
  plan: { name: string; durationDays?: number } | null;
}

/** ⚠️ Орлого/зарлагыг өнгөөр ялгана — тоо ганцаараа ойлгомжгүй */
const TX_LABEL: Record<string, { label: string; positive: boolean }> = {
  TOPUP: { label: 'Цэнэглэлт', positive: true },
  ADMIN_CREDIT: { label: 'Админ цэнэглэлт', positive: true },
  REFUND: { label: 'Буцаалт', positive: true },
  ADMIN_DEBIT: { label: 'Админ хасалт', positive: false },
  PURCHASE: { label: 'Худалдан авалт', positive: false },
};

export default function WalletScreen() {
  const [tab, setTab] = useState<'wallet' | 'orders'>('wallet');

  const balance = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api<{ balance: number }>('/wallet'),
    staleTime: 0,
  });

  return (
    <View style={styles.screen}>
      {/* ── Баланс ── */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Хэтэвчний үлдэгдэл</Text>
        <Text style={styles.balance}>
          {mnt((balance.data?.balance ?? 0))}
        </Text>
      </View>

      <View style={styles.tabs}>
        <Tab label="Гүйлгээ" on={tab === 'wallet'} onPress={() => setTab('wallet')} />
        <Tab label="Захиалга" on={tab === 'orders'} onPress={() => setTab('orders')} />
      </View>

      {tab === 'wallet' ? <TxTab /> : <OrdersTab />}
    </View>
  );
}

function Tab({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, on && styles.tabOn]}>
      <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
    </Pressable>
  );
}

function TxTab() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['wallet-tx'],
    queryFn: () => api<WalletTx[]>('/wallet/transactions'),
    staleTime: 0,
  });

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />;
  }
  if (isLoading) return null;
  if (!data?.length) {
    return <EmptyState text="Гүйлгээ алга" hint="Хэтэвч цэнэглэсний дараа энд харагдана" />;
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const meta = TX_LABEL[item.type] ?? { label: item.type, positive: false };
        return (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>
                {item.planName || item.description || meta.label}
              </Text>
              <Text style={styles.rowMeta}>
                {meta.label} · {date(item.createdAt)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={[
                  styles.amount,
                  { color: meta.positive ? colors.success : colors.foreground },
                ]}
              >
                {meta.positive ? '+' : '−'}
                {mnt(Math.abs(item.amount))}
              </Text>
              {/* ⚠️ Үлдэгдэл — хэрэглэгч гүйлгээ бүрийн дараах дүнг мэднэ */}
              <Text style={styles.after}>
                {mnt(item.balanceAfter)}
              </Text>
            </View>
          </View>
        );
      }}
    />
  );
}

function OrdersTab() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['payments-mine'],
    queryFn: () => api<Payment[]>('/payments/mine'),
    staleTime: 0,
  });

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />;
  }
  if (isLoading) return null;
  if (!data?.length) {
    return <EmptyState text="Захиалга алга" hint="Багц авсны дараа энд харагдана" />;
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        /* ⚠️ Гурван төрөл ЯЛГАНА — «0₮» гэж харагдвал хэрэглэгч
           эвдэрсэн гэж бодно */
        const what = item.isWalletTopup
          ? 'Хэтэвч цэнэглэлт'
          : item.titleName
            ? `Түрээс — ${item.titleName}`
            : (item.plan?.name ?? 'Багц');
        const granted = item.provider === 'GRANT';
        return (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{what}</Text>
              <Text style={styles.rowMeta}>
                {date(item.paidAt ?? item.createdAt)}
                {granted ? ' · Админаас олгосон' : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.amount}>
                {granted ? '—' : `${mnt(item.amount)}`}
              </Text>
              <Text
                style={[
                  styles.status,
                  { color: item.status === 'PAID' ? colors.success : colors.warning },
                ]}
              >
                {item.status === 'PAID' ? 'Төлөгдсөн' : 'Хүлээгдэж буй'}
              </Text>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  balanceCard: {
    backgroundColor: colors.card,
    margin: space.lg,
    marginBottom: space.sm,
    borderRadius: radius.lg,
    padding: space.xl,
    alignItems: 'center',
  },
  balanceLabel: { color: colors.dim, fontSize: font.sm },
  balance: { color: colors.foreground, fontSize: 32, fontWeight: '800', marginTop: 4 },

  tabs: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  tab: {
    paddingHorizontal: space.lg,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
  },
  tabOn: { backgroundColor: colors.primary },
  tabText: { color: colors.dim, fontSize: font.sm, fontWeight: '600' },
  tabTextOn: { color: '#fff' },

  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  rowTitle: { color: colors.foreground, fontSize: font.md, fontWeight: '600' },
  rowMeta: { color: colors.faint, fontSize: font.xs, marginTop: 3 },
  amount: { color: colors.foreground, fontSize: font.md, fontWeight: '700' },
  after: { color: colors.faint, fontSize: font.xs, marginTop: 2 },
  status: { fontSize: font.xs, marginTop: 3, fontWeight: '600' },
});
