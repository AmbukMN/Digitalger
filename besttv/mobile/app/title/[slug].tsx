import { useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMyListIds, useTitle, useToggleMyList } from '../../src/lib/queries';
import { useAuth } from '../../src/lib/auth';
import { ErrorState } from '../../src/components/error-state';
import { RowSkeleton } from '../../src/components/skeleton';
import { colors, font, radius, space } from '../../src/theme';
import type { Episode } from '../../src/lib/types';

const { width: W } = Dimensions.get('window');

export default function TitleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { me } = useAuth();
  const { data: t, isLoading, isError, error, refetch } = useTitle(String(slug));
  const { data: myIds } = useMyListIds();
  const toggle = useToggleMyList();
  const [season, setSeason] = useState(0);

  const saved = !!t && !!myIds?.includes(t.id);
  const episodes: Episode[] = useMemo(
    () => t?.seasons?.[season]?.episodes ?? [],
    [t, season],
  );

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => void refetch()} />;
  }
  if (isLoading || !t) {
    return (
      <View style={styles.screen}>
        <View style={{ height: W * 0.62, backgroundColor: colors.muted }} />
        <RowSkeleton />
      </View>
    );
  }

  /** ⚠️ Эхний ҮНЭГҮЙ анги — эрхгүй хэрэглэгчид үзүүлэх */
  const firstFree = episodes.find((e) => e.isFreePreview);
  const canWatch = t.hasAccess || !t.isPremium;

  const play = (ep?: Episode) => {
    /* ⚠️ Эрхгүй БА үнэгүй анги ч байхгүй бол багц авах руу чиглүүлнэ —
       эс бөгөөс товч дарахад ЮУ Ч болохгүй, эвдэрсэн мэт харагдана */
    if (!canWatch && !firstFree) {
      router.push('/pricing');
      return;
    }
    const target = ep ?? (canWatch ? episodes[0] : firstFree);
    if (t.type === 'MOVIE') {
      router.push(`/watch/${t.id}?kind=movie&title=${encodeURIComponent(t.title)}`);
      return;
    }
    if (!target) return;
    router.push(`/watch/${target.id}?title=${encodeURIComponent(t.title)}`);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: space.xxl }}>
      {/* ── Дэвсгэр зураг ── */}
      <View style={styles.hero}>
        {!!(t.backdropUrl || t.posterUrl) && (
          <Image
            source={{ uri: t.backdropUrl || t.posterUrl! }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={250}
          />
        )}
        <View style={styles.heroFade} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{t.title}</Text>

        <View style={styles.metaRow}>
          {!!t.year && <Text style={styles.meta}>{t.year}</Text>}
          {!!t.episodeCount && t.episodeCount > 1 && (
            <Text style={styles.meta}>· {t.episodeCount} анги</Text>
          )}
          {!!t.language && (
            <Text style={styles.meta}>· {t.language === 'MN' ? 'Монгол хэл' : 'Хадмал'}</Text>
          )}
          {t.isPremium && <Text style={styles.premium}>Төлбөртэй</Text>}
        </View>

        {/* ── Үйлдэл ── */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => play()}
            style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.playText}>
              {canWatch ? '▶  Үзэх' : firstFree ? '▶  1-р анги үнэгүй' : '🔒  Багц авах'}
            </Text>
          </Pressable>

          {/* ⚠️ Нэвтрээгүй бол хадгалах боломжгүй — нэвтрэх рүү чиглүүлнэ */}
          <Pressable
            onPress={() => {
              if (!me) {
                router.push('/login');
                return;
              }
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggle.mutate({ titleId: t.id, on: !saved });
            }}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel={saved ? 'Дуртайгаас хасах' : 'Дуртайд нэмэх'}
          >
            <Text style={[styles.icon, saved && { color: colors.primary }]}>
              {saved ? '♥' : '♡'}
            </Text>
          </Pressable>
        </View>

        {!canWatch && (
          <Text style={styles.lockNote}>
            {firstFree
              ? 'Эхний 3 анги үнэгүй. Бүрэн үзэхийн тулд багц авна уу.'
              : 'Энэ контентыг үзэхийн тулд багц шаардлагатай.'}
          </Text>
        )}

        {!!t.description && <Text style={styles.desc}>{t.description}</Text>}

        {!!t.genres?.length && (
          <View style={styles.genreRow}>
            {t.genres.map((g) => (
              <Text key={g.id} style={styles.genreTag}>
                {g.name}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* ── Ангиуд ── */}
      {t.type === 'SERIES' && episodes.length > 0 && (
        <View style={styles.epSection}>
          {t.seasons.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonBar}>
              {t.seasons.map((s, i) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSeason(i)}
                  style={[styles.seasonChip, season === i && styles.seasonChipOn]}
                >
                  <Text style={[styles.seasonText, season === i && { color: '#fff' }]}>
                    {s.name || `${s.number}-р улирал`}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Text style={styles.epHead}>{episodes.length} анги</Text>
          <FlatList
            data={episodes}
            keyExtractor={(e) => e.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const locked = !canWatch && !item.isFreePreview;
              return (
                <Pressable
                  onPress={() => !locked && play(item)}
                  style={({ pressed }) => [
                    styles.epRow,
                    pressed && !locked && { backgroundColor: colors.secondary },
                  ]}
                >
                  <Text style={[styles.epNum, locked && { color: colors.faint }]}>
                    {item.number}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.epName, locked && { color: colors.faint }]}>
                      {item.name || `${item.number}-р анги`}
                    </Text>
                    {!!item.durationSec && (
                      <Text style={styles.epDur}>
                        {Math.round(item.durationSec / 60)} мин
                      </Text>
                    )}
                  </View>
                  {item.isFreePreview && !canWatch && (
                    <Text style={styles.freeTag}>ҮНЭГҮЙ</Text>
                  )}
                  {locked && <Text style={styles.lock}>🔒</Text>}
                </Pressable>
              );
            }}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: { height: W * 0.62, backgroundColor: colors.muted },
  heroFade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5,5,5,0.35)',
  },
  body: { padding: space.lg },
  title: { color: colors.foreground, fontSize: font.xxl, fontWeight: '800', lineHeight: 32 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.xs,
    marginTop: space.sm,
  },
  meta: { color: colors.dim, fontSize: font.sm },
  premium: {
    color: '#1a1200',
    backgroundColor: colors.premium,
    fontSize: font.xs,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginLeft: space.xs,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
  playBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: { color: '#fff', fontWeight: '700', fontSize: font.md },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 22, color: colors.foreground },
  lockNote: {
    color: colors.warning,
    fontSize: font.sm,
    marginTop: space.md,
    lineHeight: 19,
  },
  desc: { color: colors.dim, fontSize: font.md, lineHeight: 22, marginTop: space.lg },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  genreTag: {
    color: colors.dim,
    fontSize: font.xs,
    backgroundColor: colors.secondary,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.full,
    overflow: 'hidden',
  },

  epSection: { paddingHorizontal: space.lg },
  seasonBar: { marginBottom: space.md },
  seasonChip: {
    paddingHorizontal: space.lg,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    marginRight: space.sm,
  },
  seasonChipOn: { backgroundColor: colors.primary },
  seasonText: { color: colors.dim, fontSize: font.sm, fontWeight: '600' },
  epHead: {
    color: colors.foreground,
    fontSize: font.lg,
    fontWeight: '700',
    marginBottom: space.sm,
  },
  epRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    borderRadius: radius.sm,
  },
  epNum: {
    color: colors.dim,
    fontSize: font.lg,
    fontWeight: '700',
    width: 32,
    textAlign: 'center',
  },
  epName: { color: colors.foreground, fontSize: font.md },
  epDur: { color: colors.faint, fontSize: font.xs, marginTop: 2 },
  freeTag: { color: colors.success, fontSize: 10, fontWeight: '800' },
  lock: { fontSize: font.md },
});
