import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { colors, font, radius, space } from '../theme';
import type { TitleCard as T } from '../lib/types';

/** Постерын өргөн — нэг дэлгэцэнд ~2.7 карт багтана */
export const CARD_W = 124;
export const CARD_H = Math.round(CARD_W * 1.5); // 2:3

/**
 * Киноны постер карт.
 *
 * ⚠️ `memo` — нүүр хуудсанд 100+ карт байдаг, эцэг render бүрд бүгд
 * дахин зурагдвал гүйлгэлт мэдэгдэхүйц удаашрана.
 *
 * ⚠️ `expo-image` — `contentFit`, санах ойн кэш, blurhash дэмждэг.
 * RN-ийн үндсэн `Image` нь жагсаалтад удаан.
 */
export const TitleCardView = memo(function TitleCardView({
  item,
  width = CARD_W,
  /** ⚠️ Сүлжээ (3 багана) дээр `marginRight` нь зайг ЗӨРҮҮЛНЭ —
      `columnWrapperStyle: space-between` өөрөө зай тавьдаг */
  grid,
}: {
  item: T;
  width?: number;
  grid?: boolean;
}) {
  const h = Math.round(width * 1.5);
  return (
    <Pressable
      onPress={() => router.push(`/title/${item.slug}`)}
      style={({ pressed }) => [
        styles.wrap,
        grid && { marginRight: 0 },
        { width, opacity: pressed ? 0.7 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={[styles.imgBox, { width, height: h }]}>
        {item.posterUrl ? (
          <Image
            source={{ uri: item.posterUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            /* ⚠️ 200мс — гэнэт үсрэхээс сэргийлнэ, гэхдээ удаашруулахгүй */
            transition={200}
          />
        ) : (
          /* ⚠️ Постергүй кино — хоосон саарал биш, гарчгаа харуулна */
          <View style={styles.noImg}>
            <Text style={styles.noImgText} numberOfLines={3}>
              {item.title}
            </Text>
          </View>
        )}

        {/* ⚠️ Төлбөртэй тэмдэг — хэрэглэгч дарахаасаа өмнө мэдэх ёстой */}
        {item.isPremium && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>₮</Text>
          </View>
        )}
        {item.comingSoon && (
          <View style={[styles.badge, styles.soon]}>
            <Text style={styles.soonText}>Удахгүй</Text>
          </View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      {!!item.episodeCount && item.episodeCount > 1 && (
        <Text style={styles.meta}>{item.episodeCount} анги</Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  wrap: { marginRight: space.md },
  imgBox: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  noImg: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
  },
  noImgText: {
    color: colors.dim,
    fontSize: font.sm,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: space.xs,
    right: space.xs,
    backgroundColor: colors.premium,
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: { color: '#1a1200', fontSize: font.xs, fontWeight: '800' },
  soon: { backgroundColor: colors.primary },
  soonText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  title: {
    color: colors.foreground,
    fontSize: font.sm,
    marginTop: space.xs + 2,
    lineHeight: 17,
  },
  meta: { color: colors.faint, fontSize: font.xs, marginTop: 1 },
});
