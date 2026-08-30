import { useCallback, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHome } from '../../src/lib/queries';
import { TitleCardView } from '../../src/components/title-card';
import { HomeSkeleton } from '../../src/components/skeleton';
import { ErrorState } from '../../src/components/error-state';
import { colors, font, radius, space } from '../../src/theme';
import type { ContinueItem, TitleCard } from '../../src/lib/types';

const { width: SCREEN_W } = Dimensions.get('window');

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, error, refetch } = useHome();
  const [refreshing, setRefreshing] = useState(false);

  /* ⚠️ Pull-to-refresh — мобайлын үндсэн хүлээлт */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: space.xxl }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.brandBar}>
        <Text style={styles.brand}>
          Best<Text style={{ color: colors.primary }}>TV</Text>
        </Text>
      </View>

      {isLoading || !data ? (
        <HomeSkeleton />
      ) : (
        <>
          {/* ── Баннер ── */}
          {data.banners?.length > 0 && <Banner items={data.banners} />}

          {/* ⚠️ «Үргэлжлүүлэх» ХАМГИЙН ДЭЭР — хэрэглэгч ихэвчлэн
              эндээс үргэлжлүүлэхээр ирдэг */}
          {!!data.continueWatching?.length && (
            <ContinueRow items={data.continueWatching} />
          )}

          <Row title="Шинээр нэмэгдсэн" items={data.newReleases} />
          <Row title="Их үзсэн" items={data.popular} />
          {data.genreRows?.map((g) => (
            <Row key={g.id} title={g.name} items={g.items} />
          ))}
          {!!data.comingSoon?.length && <Row title="Удахгүй" items={data.comingSoon} />}
        </>
      )}
    </ScrollView>
  );
}

/** Дээд баннер — эхний контентыг том харуулна */
function Banner({ items }: { items: TitleCard[] }) {
  const h = Math.round(SCREEN_W * 0.62);
  return (
    <FlatList
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      data={items}
      keyExtractor={(i) => i.id}
      style={{ marginBottom: space.xl }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/title/${item.slug}`)}
          style={{ width: SCREEN_W, height: h }}
        >
          {!!(item.backdropUrl || item.posterUrl) && (
            <Image
              source={{ uri: item.backdropUrl || item.posterUrl! }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={250}
            />
          )}
          {/* ⚠️ Доод бараан давхарга — цагаан бичиг УНШИГДАХ ёстой.
              Зурагны өнгө янз бүр тул давхаргагүй бол алга болно. */}
          <View style={styles.bannerFade} />
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.bannerMeta}>
              {!!item.year && <Text style={styles.metaText}>{item.year}</Text>}
              {!!item.episodeCount && item.episodeCount > 1 && (
                <Text style={styles.metaText}>· {item.episodeCount} анги</Text>
              )}
              {item.isPremium && <Text style={styles.premiumTag}>Төлбөртэй</Text>}
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}

/** Постерын хэвтээ эгнээ */
function Row({ title, items }: { title: string; items?: TitleCard[] }) {
  if (!items?.length) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{title}</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: space.lg }}
        /* ⚠️ Гүйцэтгэл — нүүрэнд 8+ эгнээ байдаг */
        initialNumToRender={4}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
        renderItem={({ item }) => <TitleCardView item={item} />}
      />
    </View>
  );
}

/** Үргэлжлүүлэх — явцын мөртэй */
function ContinueRow({ items }: { items: ContinueItem[] }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>Үргэлжлүүлэх</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(i) => `${i.id}-${i.episodeId ?? 'm'}`}
        contentContainerStyle={{ paddingHorizontal: space.lg }}
        renderItem={({ item }) => {
          const pct = item.durationSec
            ? Math.min(100, Math.round((item.positionSec / item.durationSec) * 100))
            : 0;
          return (
            <View>
              <TitleCardView item={item} />
              {/* ⚠️ Явцын мөр — хэр үзсэнээ НЭГ ХАРЦААР мэдэх */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
              {!!item.episodeNumber && (
                <Text style={styles.epText}>{item.episodeNumber}-р анги</Text>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  brandBar: { paddingHorizontal: space.lg, paddingVertical: space.md },
  brand: { color: colors.foreground, fontSize: font.xxl, fontWeight: '800' },

  bannerFade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bannerText: {
    position: 'absolute',
    bottom: space.lg,
    left: space.lg,
    right: space.lg,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: font.xxl,
    fontWeight: '800',
    /* ⚠️ Сүүдэр — цайвар зурагны дээр ч уншигдана */
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 8,
  },
  bannerMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 6 },
  metaText: { color: '#ddd', fontSize: font.sm },
  premiumTag: {
    color: '#1a1200',
    backgroundColor: colors.premium,
    fontSize: font.xs,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },

  row: { marginBottom: space.xl },
  rowTitle: {
    color: colors.foreground,
    fontSize: font.lg,
    fontWeight: '700',
    marginBottom: space.md,
    paddingHorizontal: space.lg,
  },

  progressTrack: {
    height: 3,
    backgroundColor: colors.secondary,
    borderRadius: 2,
    marginTop: -18,
    marginRight: space.md,
  },
  progressFill: { height: 3, backgroundColor: colors.primary, borderRadius: 2 },
  epText: { color: colors.faint, fontSize: font.xs, marginTop: 4 },
});
