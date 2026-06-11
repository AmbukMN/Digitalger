import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    if (!user?.role) return false;

    // ⚠️ Admin panel-ийн ROLE ШАТЛАЛ (superset): SUPERADMIN ⊃ ADMIN ⊃ EDITOR.
    // @Roles(Role.ADMIN) тавьсан endpoint-д ADMIN, SUPERADMIN, EDITOR бүгд НЭВТЭРНЭ
    // (admin panel-д хандах эрх). Гэхдээ ХЭН ЮУ ХАРАХ/ЗАСАХ нь service дотор ownership
    // scoping-аар шийдэгдэнэ (createdByUserId). Энэ guard зөвхөн "panel-д хандах" эрх.
    const ADMIN_PANEL_ROLES: string[] = ['EDITOR', 'ADMIN', 'SUPERADMIN'];
    const needsAdminPanel = requiredRoles.some((r) => r === Role.ADMIN);
    if (needsAdminPanel && ADMIN_PANEL_ROLES.includes(user.role)) {
      return true;
    }
    // Бусад тохиолдол (ж: @Roles(Role.SUPERADMIN)) — яг таарах эсвэл дээд role.
    return requiredRoles.some((role) => {
      if (user.role === role) return true;
      // SUPERADMIN нь бусад бүх admin role-ийн superset.
      if (user.role === 'SUPERADMIN') return true;
      return false;
    });
  }
}
