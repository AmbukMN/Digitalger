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
