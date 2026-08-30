import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCatalog, useGenres } from '../../src/lib/queries';
import { TitleCardView } from '../../src/components/title-card';
import { GridSkeleton } from '../../src/components/skeleton';
import { EmptyState, ErrorState } from '../../src/components/error-state';
import { colors, font, radius, space } from '../../src/theme';

const TYPES = [
  { k: 'ALL', label: 'Бүгд' },
  { k: 'SERIES', label: 'Цуврал' },
  { k: 'MOVIE', label: 'Кино' },
];

export default function CatalogScreen() {
  const [type, setType] = useState('ALL');
  const [genre, setGenre] = useState('ALL');
  const { data: genres } = useGenres();
  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useCatalog({ type, genre });

  /* ⚠️ Хуудсуудыг нэгтгэхдээ ДАВХАРДЛЫГ шүүнэ — backend нь offset
     пагинаци ашигладаг тул шинэ кино нэмэгдэхэд мөр давхардаж болно */
  const seen = new Set<string>();
  const items = (data?.pages ?? [])
    .flatMap((p) => p.items)
    .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));

  return (
    <View style={styles.screen}>
      {/* ── Шүүлт ── */}
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {TYPES.map((t) => (
            <Chip key={t.k} label={t.label} on={type === t.k} onPress={() => setType(t.k)} />
          ))}
          <View style={styles.divider} />
          <Chip label="Бүх жанр" on={genre === 'ALL'} onPress={() => setGenre('ALL')} />
          {genres?.map((g) => (
            <Chip key={g.id} label={g.name} on={genre === g.id} onPress={() => setGenre(g.id)} />
          ))}
        </ScrollView>
      </View>

      {isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <GridSkeleton />
      ) : items.length === 0 ? (
        <EmptyState text="Кино олдсонгүй" hint="Өөр шүүлт сонгоно уу" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={3}
          columnWrapperStyle={styles.col}
          contentContainerStyle={styles.list}
          /* ⚠️ Доод хэсэгт хүрэхээс ӨМНӨ дараагийн хуудсыг татна —
             хэрэглэгч хүлээхгүй */
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          renderItem={({ item }) => <TitleCardView item={item} width={CARD} grid />}
          ListFooterComponent={
            isFetchingNextPage ? (
              <Text style={styles.loading}>Ачаалж байна…</Text>
            ) : !hasNextPage && items.length > 12 ? (
              <Text style={styles.end}>Бүгдийг үзлээ</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

/* ⚠️ 3 багана — зай хассан өргөн */
const CARD = 108;

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  filters: {
    paddingVertical: space.md,
    paddingLeft: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    marginRight: space.sm,
  },
  chipOn: { backgroundColor: colors.primary },
  chipText: { color: colors.dim, fontSize: font.sm, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginRight: space.sm,
    marginVertical: 4,
  },
  list: { paddingTop: space.lg, paddingHorizontal: space.lg, paddingBottom: space.xxl },
  col: { justifyContent: 'space-between', marginBottom: space.lg },
  loading: { color: colors.dim, textAlign: 'center', paddingVertical: space.lg },
  end: { color: colors.faint, textAlign: 'center', paddingVertical: space.lg, fontSize: font.sm },
});
