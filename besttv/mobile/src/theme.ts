/**
 * BestTV аппын өнгө / зай / бичвэрийн систем.
 *
 * ⚠️⚠️ Өнгийг ВЭБЭЭС ХУУЛСАН (`shared/src/styles/globals.css`) — апп болон
 * вэб хоёр ЯГ ижил харагдах ёстой. Хэрэглэгч хоёуланг нь ашиглана.
 *
 * ⚠️ Апп нь `userInterfaceStyle: "dark"` тул ЗӨВХӨН dark палитр хэрэгтэй.
 * Вэб шиг гэрэл/харанхуй солигддоггүй — стриминг апп харанхуйд үзэгддэг.
 */
export const colors = {
  /* ── Гадаргуу ── */
  background: '#050505',
  card: '#121212',
  popover: '#1a1a1a',
  secondary: '#1f1f1f',
  muted: '#171717',

  /* ── Бичвэр ── */
  foreground: '#f5f5f5',
  mutedForeground: '#9ca3af',
  /** ⚠️ Тунгалаг биш ХАТУУ утга — RN дээр `color-mix` байхгүй */
  dim: '#8b8b93',
  faint: '#6b6b73',

  /* ── Брэнд ── */
  primary: '#e50914',
  primaryForeground: '#ffffff',
  accent: '#ff2c38',

  /* ── Төлөв ── */
  destructive: '#f43f4d',
  success: '#00c758',
  warning: '#ffc300',
  /** Төлбөртэй контентын алт */
  premium: '#f0b400',

  /* ── Зураас ── */
  border: 'rgba(255,255,255,0.12)',
  input: 'rgba(255,255,255,0.16)',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

/** 4px суурьтай зайн шат — бүх зайг эндээс авна */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  full: 999,
} as const;

/**
 * Бичвэрийн хэмжээ.
 * ⚠️ 11-ээс жижиг БҮҮ хэрэглэ — гар утсан дээр уншигдахгүй ба
 * хүртээмжийн шаардлага хангахгүй.
 */
export const font = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
} as const;

/** Постерын харьцаа — вэбтэй ижил (2:3) */
export const POSTER_RATIO = 2 / 3;
