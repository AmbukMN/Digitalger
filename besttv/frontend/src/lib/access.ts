'use client';

import type { AuthUser } from './auth-store';

/** Badge/товч тооцоолоход хэрэгтэй хамгийн бага мэдээлэл */
export interface AccessTarget {
  isPremium?: boolean;
  genres?: { id: string; name?: string }[] | null;
  /** Түрээс шалгахад — контентын ID */
  id?: string;
}

export type AccessState =
  /** Үнэгүй контент — хэн ч үзнэ */
  | 'free'
  /** Хэрэглэгчийн багц энэ жанрыг нээсэн (эсвэл VIP) */
  | 'owned'
  /** Ширхэгээр түрээслэсэн — хугацаатай эрх */
  | 'rented'
  /** Төлбөртэй + эрхгүй (эсвэл нэвтрээгүй) */
  | 'locked';

/**
 * Тухайн контентыг ҮЗЭХ ЭРХТЭЙ эсэхийг тооцоолно.
 *
 * ⚠️ Логик нь backend-ийн `canAccessTitle`-тэй ЯГ ИЖИЛ байх ёстой:
 *   - VIP (`accessGenreIds === 'ALL'`) → БҮХ контент нээгдэнэ
 *   - Жанрын багц → ЗӨВХӨН тухайн жанрын контент (контентын аль нэг
 *     жанр нээлттэй байхад хангалттай)
 *
 * ⚠️⚠️ ТҮРЭЭС ЧУ ОРНО — өмнө нь ороогүй тул хэрэглэгч киног
 * ширхэгээр түрээслэсэн атлаа жагсаалтад "🔒 Төлбөртэй" гэж
 * харагдсаар байв (эрх нь ажилладаг ч хэрэглэгч эргэлздэг).
 * `auth/me` одоо `rentedTitleIds` буцаадаг болсон.
 */
export function accessState(user: AuthUser | null, t: AccessTarget): AccessState {
  if (!t.isPremium) return 'free';
  if (!user) return 'locked';

  /* ⚠️ Түрээс ЭХЛЭЭД — багцгүй ч тухайн киног үзэх эрхтэй */
  if (t.id && user.rentedTitleIds?.includes(t.id)) return 'rented';

  const acc = user.accessGenreIds;
  if (acc === 'ALL') return 'owned';
  if (!Array.isArray(acc) || acc.length === 0) return 'locked';

  const ids = (t.genres ?? []).map((g) => g.id);
  return ids.some((id) => acc.includes(id)) ? 'owned' : 'locked';
}

/** Хэрэглэгч VIP эрхтэй эсэх */
export const hasVipAccess = (user: AuthUser | null): boolean => user?.accessGenreIds === 'ALL';
