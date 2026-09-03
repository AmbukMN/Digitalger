import { StyleSheet, Text, View } from 'react-native';
import { colors, font, space } from '../theme';

/**
 * ЭНГИЙН HTML → React Native текст.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: `/pages/:slug` нь HTML буцаадаг
 * (`<h2>`, `<p>`, `<ul>`, `<li>`, `<strong>`). React Native нь HTML
 * render ХИЙДЭГГҮЙ тул шууд харуулбал тагууд ТЕКСТ болж харагдана.
 *
 * ⚠️ Гуравдагч сан (react-native-render-html) нэмээгүй: 200KB+ жинтэй,
 * засварлагдахаа больсон, манай контент нь энгийн 5 таг л ашигладаг.
 *
 * ⚠️⚠️ ХЯЗГААР: script/style/iframe-ыг ХАЯНА. Хэдийгээр контент нь
 * админаас ирдэг ч гүйцэтгэх боломжтой зүйлийг render хийх ёсгүй.
 */

interface Block {
  type: 'h' | 'p' | 'li';
  text: string;
}

/** HTML entity — хамгийн түгээмэл 6 */
function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function parseHtml(html: string): Block[] {
  /* ⚠️ Гүйцэтгэх боломжтой блокуудыг АГУУЛГАТАЙ нь ХАЯНА */
  const safe = html.replace(
    /<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi,
    '',
  );

  const out: Block[] = [];
  /* ⚠️ Зөвхөн блок түвшний таг — доторх `<strong>` г.м. текст болно */
  const re = /<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(safe)) !== null) {
    const tag = m[1].toLowerCase();
    const text = decode(
      m[2]
        /* ⚠️ `<br>` нь мөр таслалт — устгавал үг наалдана */
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim(),
    );
    if (!text) continue;
    out.push({ type: tag.startsWith('h') ? 'h' : tag === 'li' ? 'li' : 'p', text });
  }

  /**
   * ⚠️ Таг огт олдоогүй бол ЦЭВЭР ТЕКСТ гэж үзнэ — эс бөгөөс
   * админ энгийн текст бичихэд хуудас ХООСОН харагдана.
   */
  if (!out.length) {
    const plain = decode(safe.replace(/<[^>]+>/g, '')).trim();
    if (plain) out.push({ type: 'p', text: plain });
  }
  return out;
}

export function SimpleHtml({ html }: { html: string }) {
  const blocks = parseHtml(html);
  return (
    <View style={{ gap: space.md }}>
      {blocks.map((b, i) => {
        if (b.type === 'h') {
          return (
            <Text key={i} style={styles.h} accessibilityRole="header">
              {b.text}
            </Text>
          );
        }
        if (b.type === 'li') {
          return (
            <View key={i} style={styles.liRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.p}>{b.text}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={styles.p}>
            {b.text}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  h: {
    color: colors.foreground,
    fontSize: font.md,
    fontWeight: '800',
    marginTop: space.sm,
  },
  p: { color: colors.dim, fontSize: font.sm, lineHeight: 21, flex: 1 },
  liRow: { flexDirection: 'row', gap: space.sm, paddingLeft: space.sm },
  bullet: { color: colors.primary, fontSize: font.sm, lineHeight: 21 },
});
