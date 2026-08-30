import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { colors, font, radius, space } from '../theme';

/**
 * СОШИАЛ НЭВТРЭЛТ.
 *
 * ⚠️⚠️ APPLE SIGN-IN нь App Store-ийн **Guideline 4.8**-аар ЗААВАЛ:
 * Google/Facebook гэх мэт гуравдагч нэвтрэлт санал болгож буй апп
 * Apple-ийг МӨН санал болгох ёстой. Байхгүй бол аппыг ТАТГАЛЗАНА.
 *
 * ⚠️ Apple товч нь ЗӨВХӨН iOS дээр харагдана — Android дээр Apple
 * Sign-In байхгүй бөгөөд байх шаардлагагүй.
 *
 * ⚠️⚠️ APPLE-ИЙН НЭР: зөвхөн ХАМГИЙН АНХНЫ нэвтрэлтэд ирнэ.
 * `id_token` дотор ОГТ байхгүй тул тусад нь илгээх ЁСТОЙ. Хадгалахгүй
 * бол хэрэглэгч мөнхөд нэргүй үлдэнэ — дахин авах ЗАМГҮЙ (Apple-ийн
 * тохиргооноос апп устгаж, дахин нэвтрэхээс өөр).
 */
export function SocialAuth({
  onToken,
  busy,
}: {
  /** `id_token` + нэрийг эцэгт дамжуулна */
  onToken: (p: { provider: 'apple' | 'google'; idToken: string; name?: string }) => void;
  busy?: boolean;
}) {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    /* ⚠️ iOS 13+ дээр л боломжтой — шалгахгүй бол хуучин төхөөрөмжид
       товч гарч, дарахад алдаа өгнө */
    if (Platform.OS !== 'ios') return;
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const signInApple = async () => {
    setErr(null);
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) {
        setErr('Apple нэвтрэлт амжилтгүй боллоо');
        return;
      }
      /* ⚠️ Нэр нь ЗӨВХӨН анхны удаад ирнэ — байвал заавал дамжуулна */
      const name = [cred.fullName?.givenName, cred.fullName?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();
      onToken({
        provider: 'apple',
        idToken: cred.identityToken,
        name: name || undefined,
      });
    } catch (e) {
      /* ⚠️ Хэрэглэгч өөрөө болиулсныг АЛДАА гэж харуулахгүй */
      const code = (e as { code?: string })?.code;
      if (code === 'ERR_REQUEST_CANCELED') return;
      setErr('Apple нэвтрэлт амжилтгүй боллоо');
    }
  };

  /* ⚠️ Android дээр Apple байхгүй бол компонент огт гарахгүй */
  if (!appleAvailable) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>эсвэл</Text>
        <View style={styles.line} />
      </View>

      {/*
        ⚠️ Apple-ийн ӨӨРИЙН товчийг ашиглана — Apple нь товчны дизайныг
        (өнгө, лого, текст, өндөр) ХАТУУ зохицуулдаг. Өөрөө зурсан товч
        review дээр татгалзагдана.
      */}
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={radius.md}
        style={styles.appleBtn}
        onPress={() => void signInApple()}
      />

      {!!err && <Text style={styles.err}>{err}</Text>}

      {/*
        ⚠️ Google нэвтрэлт нь `GOOGLE_MOBILE_CLIENT_IDS` тохируулсны
        ДАРАА нэмэгдэнэ. Одоо товч гаргавал дарахад 401 өгч, хэрэглэгч
        эвдэрсэн гэж бодно.
      */}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xl },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { color: colors.faint, fontSize: font.sm },
  /* ⚠️ 50px — Apple-ийн зөвлөмжийн доод өндөр */
  appleBtn: { height: 50, width: '100%' },
  err: { color: colors.destructive, fontSize: font.sm, marginTop: space.md, textAlign: 'center' },
});
