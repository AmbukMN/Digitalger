'use client';

import type { AuthUser } from './auth-store';

/** Badge/товч тооцоолоход хэрэгтэй хамгийн бага мэдээлэл */
export interface AccessTarget {
  isPremium?: boolean;
  genres?: { id: string; name?: string }[] | null;
}

export type AccessState =
  /** Үнэгүй контент — хэн ч үзнэ */
  | 'free'
  /** Хэрэглэгчийн багц энэ жанрыг нээсэн (эсвэл VIP) */
  | 'owned'
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
 * ⚠️ Түрээс энд ОРОХГҮЙ — түрээс нь контент тус бүрийн зүйл тул зөвхөн
 * дэлгэрэнгүй хуудасны `hasAccess`-аар мэдэгдэнэ (жагсаалтад ирдэггүй).
 */
export function accessState(user: AuthUser | null, t: AccessTarget): AccessState {
  if (!t.isPremium) return 'free';
  if (!user) return 'locked';

  const acc = user.accessGenreIds;
  if (acc === 'ALL') return 'owned';
  if (!Array.isArray(acc) || acc.length === 0) return 'locked';

  const ids = (t.genres ?? []).map((g) => g.id);
  return ids.some((id) => acc.includes(id)) ? 'owned' : 'locked';
}

/** Хэрэглэгч VIP эрхтэй эсэх */
export const hasVipAccess = (user: AuthUser | null): boolean => user?.accessGenreIds === 'ALL';
