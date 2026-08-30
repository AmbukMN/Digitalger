import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useChatMessages, useSendMessage, type ChatMsg } from '../src/lib/chat';
import { colors, font, radius, space } from '../src/theme';

/**
 * ДЭМЖЛЭГИЙН ЧАТ.
 *
 * ⚠️ Вэбтэй ЯГ ИЖИЛ backend — n8n AI туслах хариулна, шаардлагатай
 * бол админ гар аргаар авна (`handedOff`).
 */
export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const { data, isLoading } = useChatMessages(true);
  const send = useSendMessage();
  const listRef = useRef<FlatList<ChatMsg>>(null);

  const messages = data?.messages ?? [];

  /* ⚠️ Шинэ зурвас ирэхэд доош гүйлгэнэ — эс бөгөөс хэрэглэгч
     хариу ирснийг анзаарахгүй */
  useEffect(() => {
    if (!messages.length) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(t);
  }, [messages.length]);

  const submit = useCallback(() => {
    const t = text.trim();
    if (!t || send.isPending) return;
    setText('');
    send.mutate(t);
  }, [text, send]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      /* ⚠️ Header өндөр — гар гарахад оролт далдлагдахгүй */
      keyboardVerticalOffset={insets.top + 44}
    >
      {/* ⚠️ Админ авсан эсэхийг ХЭЛНЭ — хэрэглэгч AI-тай ярьж байна
          гэж бодоод хүлээх нь эвгүй */}
      {data?.handedOff && (
        <View style={styles.handoff}>
          <Text style={styles.handoffText}>
            Ажилтан таны яриаг авлаа — удахгүй хариулна
          </Text>
        </View>
      )}

      {isLoading && !messages.length ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Танд юугаар туслах вэ?</Text>
              <Text style={styles.emptyHint}>
                Кино хайх, багц авах, төлбөрийн асуудал — юу ч бичээрэй
              </Text>
            </View>
          }
          renderItem={({ item }) => <Bubble msg={item} />}
        />
      )}

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Зурвас бичих…"
          placeholderTextColor={colors.faint}
          style={styles.input}
          multiline
          maxLength={1000}
          onSubmitEditing={submit}
          returnKeyType="send"
        />
        <Pressable
          onPress={submit}
          disabled={!text.trim() || send.isPending}
          style={({ pressed }) => [
            styles.sendBtn,
            (!text.trim() || send.isPending) && { opacity: 0.4 },
            pressed && { opacity: 0.7 },
          ]}
          accessibilityLabel="Илгээх"
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ msg }: { msg: ChatMsg }) {
  const mine = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, mine && { justifyContent: 'flex-end' }]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        {/* ⚠️ Админы хариуг ЯЛГАНА — хэрэглэгч хүнтэй ярьж байгаагаа мэдэх */}
        {msg.role === 'admin' && <Text style={styles.adminTag}>Ажилтан</Text>}
        <Text style={[styles.text, mine && { color: '#fff' }]}>{msg.text}</Text>

        {/* ⚠️ Санал болгосон кино — дарахад дэлгэрэнгүй рүү */}
        {!!msg.titles?.length && (
          <View style={styles.titles}>
            {msg.titles.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/title/${t.slug}`)}
                style={({ pressed }) => [styles.titleChip, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.titleChipText} numberOfLines={1}>
                  🎬 {t.title}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  handoff: {
    backgroundColor: colors.success + '22',
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  handoffText: { color: colors.success, fontSize: font.sm, textAlign: 'center' },
  list: { padding: space.lg, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  emptyTitle: { color: colors.foreground, fontSize: font.lg, fontWeight: '700' },
  emptyHint: {
    color: colors.dim,
    fontSize: font.sm,
    textAlign: 'center',
    marginTop: space.sm,
    lineHeight: 20,
  },

  bubbleRow: { flexDirection: 'row', marginBottom: space.md },
  bubble: { maxWidth: '84%', borderRadius: radius.lg, padding: space.md },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  adminTag: {
    color: colors.success,
    fontSize: font.xs,
    fontWeight: '700',
    marginBottom: 3,
  },
  text: { color: colors.foreground, fontSize: font.md, lineHeight: 21 },
  titles: { marginTop: space.md, gap: space.sm },
  titleChip: {
    backgroundColor: colors.secondary,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 7,
  },
  titleChipText: { color: colors.foreground, fontSize: font.sm },

  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: 11,
    paddingBottom: 11,
    color: colors.foreground,
    fontSize: font.md,
    /* ⚠️ Дээд өндөр — урт зурвас дэлгэцийг эзлэхгүй */
    maxHeight: 110,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontSize: font.lg },
});
