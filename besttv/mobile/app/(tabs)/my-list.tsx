import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMyList } from '../../src/lib/queries';
import { useAuth } from '../../src/lib/auth';
import { TitleCardView } from '../../src/components/title-card';
import { GridSkeleton } from '../../src/components/skeleton';
import { EmptyState, ErrorState } from '../../src/components/error-state';
import { colors, font, radius, space } from '../../src/theme';

const CARD = 108;

export default function MyListScreen() {
  const { me, loading } = useAuth();
  const { data, isLoading, isError, error, refetch } = useMyList();

  /* ⚠️ Нэвтрээгүй үед хүсэлт явуулах нь утгагүй (401) — эхлээд
     нэвтрэхийг санал болгоно */
  if (!loading && !me) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Дуртай кинонууд</Text>
        <Text style={styles.hint}>
          Хадгалсан кинонуудаа харахын тулд нэвтэрнэ үү
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

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />;
  }
  if (isLoading) return <GridSkeleton count={6} />;
  if (!data?.length) {
    return (
      <EmptyState
        text="Дуртай кино алга"
        hint="Киноны хуудсан дээрх ♥ товчоор хадгална"
      />
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={data}
      keyExtractor={(i) => i.id}
      numColumns={3}
      columnWrapperStyle={styles.col}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => <TitleCardView item={item} width={CARD} grid />}
    />
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
  },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: font.md },
  list: { paddingTop: space.lg, paddingHorizontal: space.lg, paddingBottom: space.xxl },
  col: { justifyContent: 'space-between', marginBottom: space.lg },
});
