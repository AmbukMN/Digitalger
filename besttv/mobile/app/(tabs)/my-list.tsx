import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMyList } from '../../src/lib/queries';
import { useAuth } from '../../src/lib/auth';
import {
  useDownloads,
  useRemoveDownload,
  type DownloadRow,
} from '../../src/lib/downloads';
import { TitleCardView } from '../../src/components/title-card';
import { GridSkeleton } from '../../src/components/skeleton';
import { EmptyState, ErrorState } from '../../src/components/error-state';
import { colors, font, radius, space } from '../../src/theme';

const CARD = 108;

export default function MyListScreen() {
  const { me, loading } = useAuth();
  const [tab, setTab] = useState<'saved' | 'downloads'>('saved');

  /* ⚠️ Нэвтрээгүй үед хүсэлт явуулах нь утгагүй (401) */
  if (!loading && !me) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Дуртай кинонууд</Text>
        <Text style={styles.hint}>
          Хадгалсан болон татсан кинонуудаа харахын тулд нэвтэрнэ үү
        </Text>
        <Pressable
          onPress={() => router.push('/login')}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.btnText}>Нэвтрэх</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* ── Дэд таб ── */}
      <View style={styles.tabs}>
        <Tab label="Хадгалсан" on={tab === 'saved'} onPress={() => setTab('saved')} />
        <Tab label="Татсан" on={tab === 'downloads'} onPress={() => setTab('downloads')} />
      </View>

      {tab === 'saved' ? <SavedTab /> : <DownloadsTab />}
    </View>
  );
}

function Tab({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, on && styles.tabOn]}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
    </Pressable>
  );
}

function SavedTab() {
  const { data, isLoading, isError, error, refetch } = useMyList();

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />;
  }
  if (isLoading) return <GridSkeleton count={6} />;
  if (!data?.length) {
    return (
      <EmptyState text="Дуртай кино алга" hint="Киноны хуудсан дээрх ♥ товчоор хадгална" />
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(i) => i.id}
      numColumns={3}
      columnWrapperStyle={styles.col}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => <TitleCardView item={item} width={CARD} grid />}
    />
  );
}

/**
 * ТАТСАН КОНТЕНТ.
 *
 * ⚠️ Сүлжээгүй үед ч харагдах ЁСТОЙ — офлайн татахын гол зорилго.
 * `useDownloads` унавал алдаа биш, «сүлжээгүй» гэж үзнэ.
 */
function DownloadsTab() {
  const { data, isLoading, isError, refetch } = useDownloads();
  const remove = useRemoveDownload();

  if (isLoading) return <GridSkeleton count={4} />;

  /* ⚠️ Алдааг «татац алга» гэж БҮҮ харуул — сүлжээгүй байж болно */
  if (isError) {
    return (
      <ErrorState
        message="Татсан контентыг ачаалж чадсангүй. Сүлжээгээ шалгана уу."
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data?.length) {
    return (
      <EmptyState
        text="Татсан кино алга"
        hint="Киноны хуудсан дээрээс ангиа татаж авбал сүлжээгүй ч үзэх боломжтой"
      />
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(d) => d.id}
      contentContainerStyle={styles.dlList}
      renderItem={({ item }) => <DownloadRowView row={item} onRemove={() => remove.mutate(item)} />}
    />
  );
}

function DownloadRowView({ row, onRemove }: { row: DownloadRow; onRemove: () => void }) {
  const days = Math.ceil((new Date(row.expiresAt).getTime() - Date.now()) / 86400_000);
  return (
    <Pressable
      onPress={() =>
        router.push(
          `/watch/${row.targetId}?offline=1&target=${row.target}&title=${encodeURIComponent(row.title.title)}`,
        )
      }
      style={({ pressed }) => [styles.dlRow, pressed && { opacity: 0.75 }]}
    >
      {!!row.title.posterUrl && (
        <Image source={{ uri: row.title.posterUrl }} style={styles.dlPoster} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.dlTitle} numberOfLines={2}>
          {row.title.title}
        </Text>
        <Text style={styles.dlMeta}>
          {row.quality === 'v0' ? '1080p' : row.quality === 'v1' ? '720p' : '480p'}
          {' · '}
          {/* ⚠️ Хугацаа дуусахад файл АВТОМАТААР устана — урьдчилан хэлнэ */}
          {row.expired ? (
            <Text style={{ color: colors.destructive }}>Хугацаа дууссан</Text>
          ) : (
            `${days} хоног үлдсэн`
          )}
        </Text>
      </View>
      <Pressable
        onPress={onRemove}
        hitSlop={10}
        style={styles.dlDelete}
        accessibilityLabel="Устгах"
      >
        <Ionicons name="close" size={18} color={colors.faint} />
      </Pressable>
    </Pressable>
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
  },
  title: { color: colors.foreground, fontSize: font.xl, fontWeight: '700' },
  hint: {
    color: colors.dim,
    fontSize: font.md,
    textAlign: 'center',
    marginTop: space.sm,
    marginBottom: space.xl,
    lineHeight: 22,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: font.md },

  tabs: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  tab: {
    paddingHorizontal: space.lg,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
  },
  tabOn: { backgroundColor: colors.primary },
  tabText: { color: colors.dim, fontSize: font.sm, fontWeight: '600' },
  tabTextOn: { color: '#fff' },

  list: { paddingTop: space.sm, paddingHorizontal: space.lg, paddingBottom: space.xxl },
  col: { justifyContent: 'space-between', marginBottom: space.lg },

  dlList: { padding: space.lg, paddingBottom: space.xxl },
  dlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  dlPoster: { width: 44, height: 66, borderRadius: radius.sm, backgroundColor: colors.muted },
  dlTitle: { color: colors.foreground, fontSize: font.md, fontWeight: '600' },
  dlMeta: { color: colors.faint, fontSize: font.xs, marginTop: 3 },
  dlDelete: { padding: space.sm },
  dlDeleteText: { color: colors.faint, fontSize: font.lg },
});
