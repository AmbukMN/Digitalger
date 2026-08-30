import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSearch } from '../../src/lib/queries';
import { TitleCardView } from '../../src/components/title-card';
import { GridSkeleton } from '../../src/components/skeleton';
import { EmptyState, ErrorState } from '../../src/components/error-state';
import { colors, font, radius, space } from '../../src/theme';

const CARD = 108;

export default function SearchScreen() {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');

  /**
   * ⚠️⚠️ DEBOUNCE 350мс — үсэг бүрд хүсэлт явуулбал:
   *   · сервер рүү 10+ хүсэлт (throttle-д мөргөнө)
   *   · мобайл дата дэмий зарцуулагдана
   *   · үр дүн эмх замбараагүй солигдоно
   */
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  const { data, isLoading, isError, error, refetch } = useSearch(q);
  const short = q.length > 0 && q.length < 2;

  return (
    <View style={styles.screen}>
      <View style={styles.searchBar}>
        <Text style={styles.icon}>⌕</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Нэрээр хайх… (галиг дэмжинэ)"
          placeholderTextColor={colors.faint}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          /* ⚠️ Цэвэрлэх товч — гар утсан дээр текст арилгах эвгүй */
          clearButtonMode="while-editing"
        />
      </View>

      {!q ? (
        <EmptyState
          text="Кино хайх"
          hint="Монголоор эсвэл латинаар бичнэ үү — «hairtai» гэж бичсэн ч олдоно"
        />
      ) : short ? (
        <EmptyState text="Дор хаяж 2 үсэг оруулна уу" />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <GridSkeleton count={6} />
      ) : !data?.length ? (
        <EmptyState text={`«${q}» олдсонгүй`} hint="Өөр үгээр хайж үзнэ үү" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          numColumns={3}
          columnWrapperStyle={styles.col}
          contentContainerStyle={styles.list}
          /* ⚠️ Гүйлгэхэд гар автоматаар хаагдана — үр дүн бүтнээр харагдана */
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => <TitleCardView item={item} width={CARD} grid />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    marginHorizontal: space.lg,
    marginTop: space.md,
    marginBottom: space.sm,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  icon: { color: colors.faint, fontSize: font.lg, marginRight: space.sm },
  input: {
    flex: 1,
    color: colors.foreground,
    fontSize: font.md,
    /* ⚠️ 44px — хүрэлцэх зөвлөмжийн доод хэмжээ */
    height: 44,
  },
  list: { paddingTop: space.md, paddingHorizontal: space.lg, paddingBottom: space.xxl },
  col: { justifyContent: 'space-between', marginBottom: space.lg },
});
