import { Text, TextInput } from 'react-native';

/**
 * ФОНТЫН ХЭМЖЭЭНИЙ ХЯЗГААР — ХҮРТЭЭМЖ.
 *
 * ⚠️⚠️ АСУУДАЛ: Настай эсвэл нүд муутай хэрэглэгч утасныхаа
 * тохиргооноос фонтыг 130-200% болгодог (Монголд түгээмэл). Тэр үед:
 *   · 21 тогтмол өндөртэй элементээс текст ХАЛИН гарна
 *   · 12 `numberOfLines`-тэй текст дундуураа ТАСАРНА
 *   · Товчны бичиг багтахгүй, дарах газар алдагдана
 *
 * ⚠️ ЗӨВ ШИЙДЭЛ БОЛОХГҮЙ нь `allowFontScaling={false}` — тэр нь
 * томруулалтыг БҮРЭН унтрааж, нүд муутай хэрэглэгчийг огт уншуулахгүй
 * болгоно. Энэ бол хүртээмжийн эсрэг.
 *
 * ⚠️ ЗӨВ ШИЙДЭЛ: `maxFontSizeMultiplier` — томрохыг ЗӨВШӨӨРНӨ, гэхдээ
 * layout эвдэрдэг хэмжээнд ХҮРГЭХГҮЙ. 1.3 нь 30% томрох боломж —
 * уншихад мэдэгдэхүйц тус болох ба UI бүтэн үлдэнэ.
 *
 * ⚠️⚠️ ЯАГААД ЭНД, ДЭЛГЭЦ БҮРТ БИШ ВЭ:
 * 19 дэлгэц, 300+ `<Text>` элемент бий. Нэг бүрд гараар нэмэх нь
 * алдаа гаргах магадлалтай ба ШИНЭ код бичихэд дахин мартагдана.
 * `defaultProps` нь БҮГДЭД нэг дор үйлчилнэ.
 */

/** ⚠️ 1.3 — 30% томрох. Үүнээс дээш бол тогтмол өндөртэй элемент халина */
const MAX_SCALE = 1.3;

/**
 * ⚠️ `defaultProps` нь React-д хуучирсан гэж тэмдэглэгдсэн ч
 * React Native-ийн `Text`/`TextInput`-д ОДООГООР цорын ганц
 * төвлөрсөн арга (RN 0.86-д хүчинтэй). Тиймээс тип шалгалтыг
 * зөөлрүүлж хандана.
 */
type WithDefaults = {
  defaultProps?: { maxFontSizeMultiplier?: number; allowFontScaling?: boolean };
};

export function applyFontScaling(): void {
  const T = Text as unknown as WithDefaults;
  T.defaultProps = {
    ...(T.defaultProps ?? {}),
    /* ⚠️ Томрохыг ЗӨВШӨӨРНӨ — зөвхөн дээд хязгаар тавина */
    allowFontScaling: true,
    maxFontSizeMultiplier: MAX_SCALE,
  };

  /* ⚠️ Оролтын талбарт мөн ЗААВАЛ — эс бөгөөс бичсэн текст нь
     шошгоос ӨӨР хэмжээтэй болж эвгүй харагдана */
  const I = TextInput as unknown as WithDefaults;
  I.defaultProps = {
    ...(I.defaultProps ?? {}),
    allowFontScaling: true,
    maxFontSizeMultiplier: MAX_SCALE,
  };
}
