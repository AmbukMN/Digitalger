/**
 * Жанрын нэр/ID-г аюулгүй унших.
 *
 * ⚠️ Backend `decorate()` нь Prisma-гийн `[{genre:{...}}]`-ийг `[{...}]`
 * болгож хавтгайруулдаг ч, зарим endpoint (admin get) хуучин хэлбэрээр
 * буцаадаг. Аль ч хэлбэрт унахгүй байхаар нэг цэгээс уншина —
 * өмнө нь `g.genre.name` шууд уншиж админы жагсаалт БҮТНЭЭР унасан.
 */
export function genreOf(g: unknown): { id?: string; name?: string } {
  if (!g || typeof g !== 'object') return {};
  const obj = g as Record<string, unknown>;
  const inner = obj.genre;
  if (inner && typeof inner === 'object') return inner as { id?: string; name?: string };
  return obj as { id?: string; name?: string };
}

export const genreName = (g: unknown): string => genreOf(g).name ?? '';
export const genreId = (g: unknown): string => genreOf(g).id ?? '';

/**
 * ⚠️⚠️ ЖАНРЫН ӨНГӨ — жагсаалтад НЭГ ХАРЦААР ялгах.
 *
 * БОДИТ ГОМДОЛ: киноны жагсаалтад жанр нь энгийн саарал текстээр
 * таслалаар холбогдож гардаг тул «бүгд холилдоод байна» — админ
 * олон жанртай киног ялгаж чадахгүй байв.
 *
 * ⚠️ Жанр нь DB-д ӨНГӨГҮЙ (зөвхөн `isAdult` талбартай) тул нэрээр
 *    нь тогтмол өнгө оноодог. Шинэ жанр нэмэгдвэл `DEFAULT` өнгө
 *    авна — эвдрэхгүй, зүгээр л саарал болно.
 *
 * ⚠️ Тунгалаг дэвсгэр (`/15`) — dark/light хоёуланд уншигдана.
 *    Хатуу HEX бол нэг сэдэвт уусна.
 */
const GENRE_STYLE: { match: string; cls: string }[] = [
  /* 18+ — АНХААРУУЛГА өнгө (админ санамсаргүй нийтлэхээс сэргийлнэ) */
  { match: 'насанд', cls: 'bg-destructive/15 text-destructive' },
  { match: 'монгол', cls: 'bg-primary/15 text-primary' },
  { match: 'шилдэг', cls: 'bg-premium/15 text-premium' },
  { match: 'богино', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-300' },
  { match: 'c-drama', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-300' },
];

const DEFAULT_GENRE_STYLE = 'bg-foreground/8 text-muted-foreground';

/** Жанрын нэрээр өнгөний класс буцаана */
export function genreStyle(name: string): string {
  const n = name.toLowerCase();
  return GENRE_STYLE.find((g) => n.includes(g.match))?.cls ?? DEFAULT_GENRE_STYLE;
}
