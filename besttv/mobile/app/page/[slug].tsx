import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { SimpleHtml } from '../../src/components/simple-html';
import { ErrorState } from '../../src/components/error-state';
import { colors, font, space } from '../../src/theme';

/**
 * СТАТИК ХУУДАС — Үйлчилгээний нөхцөл, Нууцлалын бодлого.
 *
 * ⚠️⚠️ Контент нь HTML-ээр ирдэг тул `SimpleHtml`-ээр хөрвүүлнэ.
 * Шууд `<Text>`-д хийвэл `<h2>`, `<p>` тагууд ТЕКСТ болж харагдана.
 *
 * ⚠️ Дэлгүүрт тавихад эдгээр хуудас хүртээмжтэй байх ШААРДЛАГАТАЙ.
 */

interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
}

export default function PageScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['page', slug],
    queryFn: () => api<Page>(`/pages/${slug}`),
    enabled: !!slug,
    /* ⚠️ Нөхцөл ховор өөрчлөгддөг — 30 минут кэш хангалттай */
    staleTime: 30 * 60_000,
  });

  return (
    <>
      {/* ⚠️ Гарчгийг ДАТАНААС — хатуу бичвэл шинэ хуудас нэмэхэд буруу болно */}
      <Stack.Screen options={{ title: data?.title ?? 'Ачаалж байна…' }} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError || !data ? (
        <ErrorState
          message="Хуудсыг ачаалж чадсангүй"
          onRetry={() => void refetch()}
        />
      ) : (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
          <Text style={styles.title}>{data.title}</Text>
          <SimpleHtml html={data.content ?? ''} />
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  title: { color: colors.foreground, fontSize: font.xl, fontWeight: '800' },
});
