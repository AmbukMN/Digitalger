import { useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../src/lib/api';
import { EmptyState, ErrorState } from '../src/components/error-state';
import { colors, font, radius, space } from '../src/theme';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * МЭДЭГДЭЛ.
 *
 * ⚠️ Push дарахад `data.link`-ээр шууд зорилтот хуудас руу очдог ч,
 * хэрэглэгч мэдэгдлээ хожим үзэх боломжтой байх ЁСТОЙ (push-ыг
 * санамсаргүй арчсан, унтраасан г.м).
 */
export default function NotificationsScreen() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<{ items: Notif[]; unread: number }>('/notifications?limit=50'),
    staleTime: 0,
  });

  const markAll = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const open = useCallback(
    (n: Notif) => {
      /* ⚠️ Уншсан гэж тэмдэглэнэ — хариу хүлээхгүй (UI шууд хариулна) */
      if (!n.readAt) {
        void api(`/notifications/${n.id}/read`, { method: 'POST' })
          .then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))
          .catch(() => {});
      }
      /* ⚠️ Зөвхөн ДОТООД зам — гадаад URL нээвэл фишинг эрсдэлтэй */
      if (n.link?.startsWith('/')) router.push(n.link as never);
    },
    [qc],
  );

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />;
  }

  return (
    <View style={styles.screen}>
      {!!data?.unread && (
        <Pressable onPress={() => markAll.mutate()} style={styles.markAll}>
          <Text style={styles.markAllText}>
            {data.unread} уншаагүй · Бүгдийг уншсан болгох
          </Text>
        </Pressable>
      )}

      <FlatList
        data={data?.items ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => void refetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              text="Мэдэгдэл алга"
              hint="Шинэ анги, багцын мэдээлэл энд харагдана"
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            style={({ pressed }) => [
              styles.row,
              /* ⚠️ Уншаагүйг ТОДООР — хэрэглэгч шинийг нь ялгах ёстой */
              !item.readAt && styles.unread,
              pressed && { opacity: 0.75 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.body} numberOfLines={3}>
                {item.body}
              </Text>
              <Text style={styles.date}>
                {new Date(item.createdAt).toLocaleDateString('mn-MN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            {!item.readAt && <View style={styles.dot} />}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  markAll: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  markAllText: { color: colors.primary, fontSize: font.sm, fontWeight: '600' },
  list: { padding: space.lg, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.lg,
    marginBottom: space.md,
  },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  title: { color: colors.foreground, fontSize: font.md, fontWeight: '600' },
  body: { color: colors.dim, fontSize: font.sm, marginTop: 3, lineHeight: 19 },
  date: { color: colors.faint, fontSize: font.xs, marginTop: space.sm },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
});
