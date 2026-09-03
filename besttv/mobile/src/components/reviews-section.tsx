import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useMyReview,
  useReviewStats,
  useReviews,
  useSaveReview,
  useVoteReview,
  type Review,
} from '../lib/queries';
import { useAuth } from '../lib/auth';
import { ago } from '../lib/format';
import { colors, font, radius, space } from '../theme';

/**
 * ҮНЭЛГЭЭ / СЭТГЭГДЭЛ.
 *
 * ⚠️⚠️ `rating` нь 1-10 хуваарьтай (5 БИШ) — backend-ийн
 * `@Min(1) @Max(10)`-аас баталгаажсан. 5 одоор харуулбал утга
 * хоёр дахин буруу болно.
 *
 * ⚠️ Backend бүрэн бэлэн байсан атлаа апп нэг ч дуудалт хийдэггүй байв.
 */
export function ReviewsSection({ titleId }: { titleId: string }) {
  const { me } = useAuth();
  const stats = useReviewStats(titleId);
  const list = useReviews(titleId);
  const mine = useMyReview(titleId, !!me);
  const vote = useVoteReview(titleId);
  const [open, setOpen] = useState(false);

  const items = list.data?.items ?? [];
  const count = stats.data?.count ?? 0;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={styles.title}>Үнэлгээ</Text>
        {count > 0 && (
          <View style={styles.avgRow}>
            <Ionicons name="star" size={14} color={colors.premium} />
            <Text style={styles.avg}>
              {(stats.data?.average ?? 0).toFixed(1)}
            </Text>
            <Text style={styles.count}>({count})</Text>
          </View>
        )}
      </View>

      {/* ⚠️ Өөрийн үнэлгээ байвал «засах», үгүй бол «үнэлэх» */}
      <Pressable
        onPress={() => {
          /* ⚠️ Зочинд ТОДОРХОЙ хэлнэ — товч дарахад юу ч болохгүй бол
             эвдэрсэн мэт харагдана */
          if (!me) {
            Alert.alert('Нэвтрэх шаардлагатай', 'Үнэлгээ өгөхийн тулд нэвтэрнэ үү.', [
              { text: 'Болих', style: 'cancel' },
              { text: 'Нэвтрэх', onPress: () => router.push('/login') },
            ]);
            return;
          }
          setOpen(true);
        }}
        style={({ pressed }) => [styles.rateBtn, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
      >
        <Ionicons
          name={mine.data ? 'create-outline' : 'star-outline'}
          size={16}
          color={colors.foreground}
        />
        <Text style={styles.rateText}>
          {mine.data ? `Таны үнэлгээ: ${mine.data.rating}/10 — засах` : 'Үнэлгээ өгөх'}
        </Text>
      </Pressable>

      {list.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: space.md }} />
      ) : !items.length ? (
        <Text style={styles.empty}>
          Сэтгэгдэл алга. Хамгийн түрүүнд бичээрэй.
        </Text>
      ) : (
        items.slice(0, 5).map((r) => (
          <ReviewRow
            key={r.id}
            r={r}
            /* ⚠️ Өөрийн сэтгэгдэлд санал өгөх БОЛОМЖГҮЙ (backend 400) —
               товчийг идэвхгүй болгож дэмий алдаанаас сэргийлнэ */
            own={r.userId === me?.id}
            onVote={(value) => {
              if (!me) {
                router.push('/login');
                return;
              }
              /* ⚠️ Ижил утгыг дахин илгээнэ — backend ӨӨРӨӨ болиулна
                 (0 илгээвэл @IsIn([1,-1])-д унаж 400 өгнө) */
              vote.mutate({ id: r.id, value });
            }}
          />
        ))
      )}

      <RateModal
        titleId={titleId}
        open={open}
        onClose={() => setOpen(false)}
        current={mine.data ?? null}
      />
    </View>
  );
}

function ReviewRow({
  r,
  own,
  onVote,
}: {
  r: Review;
  own?: boolean;
  onVote: (v: 1 | -1) => void;
}) {
  /* ⚠️ Спойлерыг НУУНА — дарж л нээнэ (кино сүйтгэхээс сэргийлнэ) */
  const [revealed, setRevealed] = useState(false);
  const hidden = r.hasSpoiler && !revealed;

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.name} numberOfLines={1}>
          {r.user?.name || 'Хэрэглэгч'}
          {r.isStaff && <Text style={styles.staff}>  · Ажилтан</Text>}
        </Text>
        <View style={styles.ratingPill}>
          <Ionicons name="star" size={11} color={colors.premium} />
          <Text style={styles.ratingText}>{r.rating}</Text>
        </View>
      </View>

      {!!r.comment && (
        <Pressable onPress={() => hidden && setRevealed(true)} disabled={!hidden}>
          <Text style={[styles.comment, hidden && styles.spoiler]} selectable={!hidden}>
            {hidden ? 'Спойлер — харахын тулд дарна уу' : r.comment}
          </Text>
        </Pressable>
      )}

      <View style={styles.rowFoot}>
        <Text style={styles.date}>{ago(r.createdAt)}</Text>
        <View style={styles.voteRow}>
          <Pressable
            onPress={() => onVote(1)}
            disabled={own}
            hitSlop={8}
            style={[styles.voteBtn, own && { opacity: 0.35 }]}
            accessibilityLabel="Хэрэгтэй"
          >
            <Ionicons
              name={r.myVote === 1 ? 'thumbs-up' : 'thumbs-up-outline'}
              size={14}
              color={r.myVote === 1 ? colors.primary : colors.faint}
            />
            {r.helpful > 0 && <Text style={styles.voteCount}>{r.helpful}</Text>}
          </Pressable>
          <Pressable
            onPress={() => onVote(-1)}
            disabled={own}
            hitSlop={8}
            style={[styles.voteBtn, own && { opacity: 0.35 }]}
            accessibilityLabel="Хэрэггүй"
          >
            <Ionicons
              name={r.myVote === -1 ? 'thumbs-down' : 'thumbs-down-outline'}
              size={14}
              color={r.myVote === -1 ? colors.destructive : colors.faint}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ══════════ Үнэлгээ өгөх цонх ══════════ */

function RateModal({
  titleId,
  open,
  onClose,
  current,
}: {
  titleId: string;
  open: boolean;
  onClose: () => void;
  current: Review | null;
}) {
  const save = useSaveReview(titleId);
  const [rating, setRating] = useState(current?.rating ?? 0);
  const [comment, setComment] = useState(current?.comment ?? '');
  const [spoiler, setSpoiler] = useState(current?.hasSpoiler ?? false);

  const submit = () => {
    if (rating < 1) {
      Alert.alert('Үнэлгээ сонгоно уу', '1-ээс 10 хүртэл од сонгоно уу.');
      return;
    }
    save.mutate(
      { rating, comment: comment.trim() || undefined, hasSpoiler: spoiler },
      {
        onSuccess: () => {
          onClose();
          Alert.alert('Баярлалаа', 'Таны үнэлгээ хадгалагдлаа.');
        },
        onError: (e) =>
          Alert.alert('Алдаа', e instanceof Error ? e.message : 'Дахин оролдоно уу'),
      },
    );
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>
            {current ? 'Үнэлгээ засах' : 'Үнэлгээ өгөх'}
          </Text>

          {/**
           * ⚠️⚠️ 1-10 ХУВААРЬ — backend-ийн @Max(10). 5 одоор
           * харуулбал хэрэглэгчийн өгсөн утга хоёр дахин буруу болно.
           */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.stars}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setRating(n)}
                  hitSlop={4}
                  accessibilityLabel={`${n} оноо`}
                >
                  <Ionicons
                    name={n <= rating ? 'star' : 'star-outline'}
                    size={26}
                    color={n <= rating ? colors.premium : colors.faint}
                  />
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Text style={styles.ratingLabel}>
            {rating > 0 ? `${rating} / 10` : 'Од сонгоно уу'}
          </Text>

          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Сэтгэгдэл (заавал биш)"
            placeholderTextColor={colors.faint}
            style={styles.input}
            multiline
            /* ⚠️ Backend-ийн @MaxLength(3000)-тай ЯГ ИЖИЛ */
            maxLength={3000}
          />

          <Pressable
            onPress={() => setSpoiler((v) => !v)}
            style={styles.spoilerRow}
            hitSlop={6}
          >
            <Ionicons
              name={spoiler ? 'checkbox' : 'square-outline'}
              size={18}
              color={spoiler ? colors.primary : colors.faint}
            />
            <Text style={styles.spoilerText}>Спойлер агуулсан</Text>
          </Pressable>

          <View style={styles.sheetBtns}>
            <Pressable onPress={onClose} style={styles.cancelBtn} hitSlop={6}>
              <Text style={styles.cancelText}>Болих</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={save.isPending}
              style={({ pressed }) => [
                styles.saveBtn,
                (save.isPending || pressed) && { opacity: 0.8 },
              ]}
            >
              {save.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>Хадгалах</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { color: colors.foreground, fontSize: font.md, fontWeight: '700' },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  avg: { color: colors.premium, fontSize: font.md, fontWeight: '800' },
  count: { color: colors.faint, fontSize: font.xs },

  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingVertical: space.md,
    marginTop: space.md,
  },
  rateText: { color: colors.foreground, fontSize: font.sm, fontWeight: '600' },
  empty: { color: colors.faint, fontSize: font.sm, marginTop: space.md },

  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
    gap: space.sm,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: colors.foreground, fontSize: font.sm, fontWeight: '600', flex: 1 },
  staff: { color: colors.success, fontSize: font.xs, fontWeight: '700' },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { color: colors.premium, fontSize: font.sm, fontWeight: '800' },
  comment: { color: colors.dim, fontSize: font.sm, lineHeight: 20 },
  spoiler: { color: colors.faint, fontStyle: 'italic' },
  rowFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { color: colors.faint, fontSize: font.xs },
  voteRow: { flexDirection: 'row', gap: space.lg },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voteCount: { color: colors.faint, fontSize: font.xs },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
  },
  sheetTitle: { color: colors.foreground, fontSize: font.lg, fontWeight: '800' },
  stars: { flexDirection: 'row', gap: space.xs },
  ratingLabel: { color: colors.dim, fontSize: font.sm, textAlign: 'center' },
  input: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    padding: space.md,
    color: colors.foreground,
    fontSize: font.md,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  spoilerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  spoilerText: { color: colors.dim, fontSize: font.sm },
  sheetBtns: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48 },
  cancelText: { color: colors.dim, fontSize: font.md },
  saveBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
