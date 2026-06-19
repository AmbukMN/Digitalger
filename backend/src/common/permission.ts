import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './decorators/current-user.decorator';

/**
 * Granular permission — ADMIN role-той admin бүрд resource тус бүрээр эрх.
 *
 * Зарчим:
 *  - SUPERADMIN → бүх resource, бүх action автомат (AdminPermission table-гүй).
 *  - ADMIN → AdminPermission хүснэгтээс resource бүрд canView/Create/Edit/Delete.
 *    Бичлэг байхгүй resource = тэр resource-д хандах эрхгүй (default-deny).
 *  - Ownership хэвээр (assertOwner) — permission нь "ямар resource", ownership нь
 *    "өөрийн л дата". Хоёулаа давхар хамгаалалт.
 */

export type Resource =
  | 'products'
  | 'categories'
  | 'product-types'
  | 'blog'
  | 'banners'
  | 'testimonials'
  | 'partners'
  | 'faqs'
  | 'coupons'
  | 'pages'
  | 'menu'
  | 'orders'
  | 'reviews';

export type PermAction = 'view' | 'create' | 'edit' | 'delete';

const ACTION_FIELD: Record<PermAction, 'canView' | 'canCreate' | 'canEdit' | 'canDelete'> = {
  view: 'canView',
  create: 'canCreate',
  edit: 'canEdit',
  delete: 'canDelete',
};

/**
 * Permission шалгана. SUPERADMIN үргэлж зөвшөөрнө. ADMIN-д AdminPermission
 * хүснэгтээс resource+action шалгана, эрхгүй бол Forbidden.
 * @throws ForbiddenException эрхгүй бол
 */
export async function assertPermission(
  prisma: PrismaService,
  me: JwtPayload,
  resource: Resource,
  action: PermAction,
): Promise<void> {
  if (me.role === 'SUPERADMIN') return; // бүх эрх
  const perm = await prisma.adminPermission.findUnique({
    where: { userId_resource: { userId: me.sub, resource } },
    select: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  });
  if (!perm || !perm[ACTION_FIELD[action]]) {
    throw new ForbiddenException(
      `Танд "${resource}" хэсэгт "${action}" хийх эрх олгогдоогүй байна`,
    );
  }
}

/**
 * Permission байгаа эсэхийг буцаана (throw хийхгүй) — UI/нөхцөлд.
 */
export async function hasPermission(
  prisma: PrismaService,
  me: JwtPayload,
  resource: Resource,
  action: PermAction,
): Promise<boolean> {
  if (me.role === 'SUPERADMIN') return true;
  const perm = await prisma.adminPermission.findUnique({
    where: { userId_resource: { userId: me.sub, resource } },
    select: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  });
  return !!perm && perm[ACTION_FIELD[action]];
}

/**
 * Admin-ийн БҮХ resource permission-ийг буцаана (frontend sidebar/UI-д).
 * SUPERADMIN-д бүх resource бүрэн эрхтэй гэж буцаана.
 */
export async function getMyPermissions(
  prisma: PrismaService,
  me: JwtPayload,
): Promise<Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>> {
  const ALL: Resource[] = [
    'products', 'categories', 'product-types', 'blog', 'banners',
    'testimonials', 'partners', 'faqs', 'coupons', 'pages', 'menu', 'orders', 'reviews',
  ];
  if (me.role === 'SUPERADMIN') {
    return Object.fromEntries(
      ALL.map((r) => [r, { view: true, create: true, edit: true, delete: true }]),
    );
  }
  const rows = await prisma.adminPermission.findMany({
    where: { userId: me.sub },
    select: { resource: true, canView: true, canCreate: true, canEdit: true, canDelete: true },
  });
  const map = new Map(rows.map((r) => [r.resource, r]));
  return Object.fromEntries(
    ALL.map((r) => {
      const p = map.get(r);
      return [r, {
        view: !!p?.canView,
        create: !!p?.canCreate,
        edit: !!p?.canEdit,
        delete: !!p?.canDelete,
      }];
    }),
  );
}
