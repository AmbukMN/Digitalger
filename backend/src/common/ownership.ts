import { ForbiddenException } from '@nestjs/common';
import { JwtPayload } from './decorators/current-user.decorator';

/**
 * Multi-tenant ownership туслахууд.
 *
 * Зарчим:
 *  - SUPERADMIN — бүх контентыг харах/засах/устгах (scope = бүгд).
 *  - ADMIN / EDITOR — ЗӨВХӨН өөрийн (createdByUserId === me.sub) контент.
 *  - EDITOR нь ADMIN-тэй ижил scope ч delete хийж ЧАДАХГҮЙ (canDelete=false).
 *
 * ⚠️ Аюулгүй байдал: list/get-д buildOwnerWhere, mutation-д assertOwner ЗААВАЛ.
 * Аль нэгийг мартвал "бүгд харагдах" биш "юу ч харагдахгүй" тийш fail хийнэ
 * (buildOwnerWhere үргэлж scope буцаана).
 */

export function isSuperadmin(me: JwtPayload | null | undefined): boolean {
  return me?.role === 'SUPERADMIN';
}

export function isEditor(me: JwtPayload | null | undefined): boolean {
  return me?.role === 'EDITOR';
}

/**
 * Prisma `where`-д нэмэх ownership scope.
 *  - SUPERADMIN → {} (бүгд)
 *  - бусад → { createdByUserId: me.sub }
 * Жишээ: findMany({ where: { ...existing, ...buildOwnerWhere(me) } })
 */
export function buildOwnerWhere(
  me: JwtPayload,
): { createdByUserId?: string } {
  if (isSuperadmin(me)) return {};
  return { createdByUserId: me.sub };
}

/**
 * Тухайн мөрийг засах/устгах эрх шалгана.
 *  - SUPERADMIN → үргэлж зөвшөөрнө.
 *  - бусад → createdByUserId === me.sub байх ёстой, эс бол Forbidden.
 * @param row.createdByUserId эзэмшигчийн id (null = эзэнгүй/систем → зөвхөн SUPERADMIN)
 */
export function assertOwner(
  me: JwtPayload,
  row: { createdByUserId: string | null } | null | undefined,
  action = 'энэ үйлдлийг',
): void {
  if (!row) throw new ForbiddenException('Бичлэг олдсонгүй');
  if (isSuperadmin(me)) return;
  if (row.createdByUserId && row.createdByUserId === me.sub) return;
  throw new ForbiddenException(
    `Та ${action} хийх эрхгүй — энэ контентыг өөр админ үүсгэсэн байна`,
  );
}

/**
 * EDITOR delete хийж чадахгүй — устгах эрх шалгана.
 * SUPERADMIN/ADMIN зөвшөөрнө (ADMIN нь ownership-аар нэмж шалгагдана).
 */
export function assertCanDelete(me: JwtPayload): void {
  if (isEditor(me)) {
    throw new ForbiddenException('Editor эрхтэй админ устгах боломжгүй (зөвхөн засах)');
  }
}
