import { useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  Share,
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
import { Ionicons } from '@expo/vector-icons';
import { mnt } from '../../src/lib/format';
import { TitleCardView } from '../../src/components/title-card';
import {
  useRentPrice,
  useRentWithQpay,
  useRentWithWallet,
} from '../../src/lib/payments';
import { useMyListIds, useTitle, useToggleMyList } from '../../src/lib/queries';
import { useAuth } from '../../src/lib/auth';
import { ErrorState } from '../../src/components/error-state';
import { RowSkeleton } from '../../src/components/skeleton';
import { DownloadButton } from '../../src/components/download-button';
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

  /* ⚠️ Түрээс — зөвхөн эрхгүй үед хэрэгтэй (эрхтэй бол дэмий хүсэлт) */
  const rent = useRentPrice(!canWatch ? t.id : undefined);
  const rentWallet = useRentWithWallet();
  const rentQpay = useRentWithQpay();

  /**
   * ⚠️⚠️ ҮРГЭЛЖЛҮҮЛЭХ БАЙРЛАЛ — киноны хуудаснаас үзэхэд ч сэргээнэ.
   *
   * Хэрэглэгч нүүрнээс биш, киноны хуудаснаас дарж болно. Байрлал
   * дамжуулахгүй бол «Үргэлжлүүлэх» гэж бичээд ЭХНЭЭС нь тоглоно.
   */
  const resume = (episodeId?: string) => {
    const p = t.progress;
    if (!p || !p.positionSec || p.positionSec < 10) return '';
    /* ⚠️ Анги таарахгүй бол байрлал ХЭРЭГГҮЙ — өөр ангийн явц */
    if (episodeId && p.episodeId && p.episodeId !== episodeId) return '';
    return `&pos=${Math.floor(p.positionSec)}`;
  };

  const play = (ep?: Episode) => {
    /* ⚠️ Эрхгүй БА үнэгүй анги ч байхгүй бол багц авах руу чиглүүлнэ —
       эс бөгөөс товч дарахад ЮУ Ч болохгүй, эвдэрсэн мэт харагдана */
    if (!canWatch && !firstFree) {
      router.push('/pricing');
      return;
    }
    const target = ep ?? (canWatch ? episodes[0] : firstFree);
    if (t.type === 'MOVIE') {
      /* ⚠️ Кинонд `id` нь өөрөө titleId — `tid` илүүдэл */
      router.push(
        `/watch/${t.id}?kind=movie&title=${encodeURIComponent(t.title)}` + resume(),
      );
      return;
    }
    if (!target) return;

    /**
     * ⚠️⚠️ ДАРААГИЙН АНГИ — ПАРАМЕТРЭЭР дамжуулна.
     *
     * Плеер дотор хүсэлт явуулбал нэмэлт саатал үүсэх ба ОФЛАЙН үед
     * ажиллахгүй. Энд аль хэдийн бүх ангийн жагсаалт байгаа тул
     * дараагийнхыг нь шууд олж өгнө.
     *
     * ⚠️ Эрхгүй хэрэглэгчид зөвхөн ҮНЭГҮЙ анги санал болгоно — эс
     * бөгөөс төлбөрийн хана руу шидэгдэж, эвгүй туршлага болно.
     */
    const idx = episodes.findIndex((e) => e.id === target.id);
    const next = idx >= 0 ? episodes[idx + 1] : undefined;
    const nextOk = next && (canWatch || next.isFreePreview) ? next : undefined;

    /* ⚠️⚠️ `tid` ЗААВАЛ — эс бөгөөс явц episodeId дор бичигдэнэ */
    router.push(
      `/watch/${target.id}?tid=${t.id}&title=${encodeURIComponent(t.title)}` +
        resume(target.id) +
        (nextOk ? `&nextId=${nextOk.id}&nextNum=${nextOk.number}` : ''),
    );
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
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={22}
              color={saved ? colors.primary : colors.foreground}
            />
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          {/* ⚠️ ТРЕЙЛЕР — эрх шаардахгүй, кино авахаасаа өмнө үзнэ
              (борлуулалтад шууд тустай). YouTube бол гадагш нээнэ. */}
          {(t.trailerAvailable || t.trailerYoutubeKey) && (
            <Pressable
              onPress={() => {
                if (t.trailerYoutubeKey) {
                  void Linking.openURL(
                    `https://www.youtube.com/watch?v=${t.trailerYoutubeKey}`,
                  );
                  return;
                }
                router.push(
                  `/watch/${t.id}?kind=trailer&target=trailer` +
                    `&title=${encodeURIComponent(`${t.title} — трейлер`)}`,
                );
              }}
              style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityLabel="Трейлер үзэх"
            >
              <Ionicons name="play-circle-outline" size={19} color={colors.foreground} />
              <Text style={styles.actionText}>Трейлер</Text>
            </Pressable>
          )}

          {/* ⚠️⚠️ ХУВААЛЦАХ — мобайл дээр шинэ хэрэглэгч татах ГОЛ суваг.
              Вэбд байдаг атлаа аппад байхгүй байв. */}
          <Pressable
            onPress={() => {
              void Share.share({
                message: `${t.title} — BestTV дээр үзээрэй
https://besttv.us/title/${t.slug}`,
                /* ⚠️ iOS нь `url`-ыг тусад нь хүсдэг, Android үл тоомсорлоно */
                url: `https://besttv.us/title/${t.slug}`,
                title: t.title,
              }).catch(() => {});
            }}
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel="Хуваалцах"
          >
            <Ionicons name="share-outline" size={19} color={colors.foreground} />
            <Text style={styles.actionText}>Хуваалцах</Text>
          </Pressable>
        </View>

        {!canWatch && (
          <Text style={styles.lockNote}>
            {firstFree
              ? 'Эхний 3 анги үнэгүй. Бүрэн үзэхийн тулд багц авна уу.'
              : 'Энэ контентыг үзэхийн тулд багц шаардлагатай.'}
          </Text>
        )}

        {/**
         * ⚠️⚠️ ТҮРЭЭС — багц авах хүсэлгүй хэрэглэгчийн ганц гарц.
         *
         * `available: false` (админ унтраасан) эсвэл аль хэдийн эрхтэй
         * бол ОГТ харуулахгүй — илүүдэл товч төөрөгдөл үүсгэнэ.
         */}
        {!canWatch && rent.data?.available && (
          <Pressable
            onPress={() => {
              if (!me) {
                router.push('/login');
                return;
              }
              const { price, hours } = rent.data!;
              const balance = me.walletBalance ?? 0;
              Alert.alert(
                'Түрээслэх',
                `${t.title}
${mnt(price)} — ${hours} цагийн турш үзнэ` +
                  (balance >= price ? `

Хэтэвч: ${mnt(balance)}` : ''),
                [
                  { text: 'Болих', style: 'cancel' },
                  /* ⚠️ Хэтэвчинд хүрэлцвэл л сонголт харуулна */
                  ...(balance >= price
                    ? [
                        {
                          text: 'Хэтэвчээр',
                          onPress: () =>
                            rentWallet.mutate(t.id, {
                              onSuccess: () =>
                                Alert.alert('Амжилттай', `${hours} цагийн турш үзэх боломжтой.`),
                              onError: (e: unknown) =>
                                Alert.alert(
                                  'Түрээслэж чадсангүй',
                                  e instanceof Error ? e.message : 'Дахин оролдоно уу',
                                ),
                            }),
                        },
                      ]
                    : []),
                  {
                    text: 'QPay',
                    onPress: () =>
                      rentQpay.mutate(t.id, {
                        onSuccess: () =>
                          Alert.alert(
                            'Нэхэмжлэх үүслээ',
                            'Банкны апп-аар төлнө үү. Төлөгдмөгц кино нээгдэнэ.',
                          ),
                        onError: (e: unknown) =>
                          Alert.alert(
                            'Алдаа',
                            e instanceof Error ? e.message : 'Дахин оролдоно уу',
                          ),
                      }),
                  },
                ],
              );
            }}
            disabled={rentWallet.isPending || rentQpay.isPending}
            style={({ pressed }) => [styles.rentBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={styles.rentText}>
              {mnt(rent.data.price)}-өөр {rent.data.hours} цаг түрээслэх
            </Text>
          </Pressable>
        )}

        {!!t.description && <Text style={styles.desc}>{t.description}</Text>}

        {/* ⚠️ ЖҮЖИГЧИД — `cast` (зурагтай) давуу, байхгүй бол `actors` */}
        {!!t.cast?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Жүжигчид</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={t.cast}
              keyExtractor={(c, i) => `${c.name}-${i}`}
              contentContainerStyle={{ gap: space.md }}
              renderItem={({ item }) => (
                <View style={styles.castItem}>
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={styles.castPhoto} />
                  ) : (
                    <View style={[styles.castPhoto, styles.castNoPhoto]}>
                      <Ionicons name="person" size={22} color={colors.faint} />
                    </View>
                  )}
                  <Text style={styles.castName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {!!item.character && (
                    <Text style={styles.castRole} numberOfLines={1}>
                      {item.character}
                    </Text>
                  )}
                </View>
              )}
            />
          </View>
        )}

        {/* ⚠️ `cast` байхгүй үед л — давхардуулахгүй */}
        {!t.cast?.length && !!t.actors?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Жүжигчид</Text>
            <Text style={styles.desc}>{t.actors.join(', ')}</Text>
          </View>
        )}

        {/* ⚠️⚠️ ТӨСТЭЙ КИНО — мобайл API нь 18+ шүүсэн байна
            (өмнө нь шүүгдэхгүй, 18+ санал болгогддог байсан) */}
        {!!t.related?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Төстэй кино</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={t.related}
              keyExtractor={(r) => r.id}
              contentContainerStyle={{ gap: space.md }}
              renderItem={({ item }) => <TitleCardView item={item} width={98} />}
            />
          </View>
        )}

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
                  {/* ⚠️ Татах товч — түгжээтэй ангид харуулахгүй */}
                  {!locked && (
                    <DownloadButton target="episode" targetId={item.id} />
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
  actionRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
  },
  actionText: { color: colors.foreground, fontSize: font.sm, fontWeight: '600' },
  section: { marginTop: space.xl },
  sectionTitle: {
    color: colors.foreground,
    fontSize: font.md,
    fontWeight: '700',
    marginBottom: space.md,
  },
  castItem: { width: 76 },
  castPhoto: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.muted,
  },
  castNoPhoto: { alignItems: 'center', justifyContent: 'center' },
  castName: {
    color: colors.foreground,
    fontSize: font.xs,
    textAlign: 'center',
    marginTop: space.xs,
    lineHeight: 15,
  },
  castRole: {
    color: colors.faint,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 1,
  },
  rentBtn: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.premium,
    paddingVertical: space.md,
    alignItems: 'center',
    marginTop: space.md,
  },
  rentText: { color: colors.premium, fontWeight: '700', fontSize: font.md },
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
