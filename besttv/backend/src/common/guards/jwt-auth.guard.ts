import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * ⚠️ ТҮР ОНОШИЛГОО — 401 болох ЯГ шалтгааныг production логт бичнэ.
   *
   * `info` нь passport-jwt-ийн үнэн шалтгааныг агуулдаг:
   *   TokenExpiredError    — хугацаа дууссан
   *   JsonWebTokenError    — ГАРЫН ҮСЭГ БУРУУ (өөр JWT_SECRET!)
   *   "No auth token"      — header/cookie огт ирээгүй
   * Өмнө нь энэ мэдээлэл ХАЯГДАЖ, зөвхөн "Authentication required"
   * гэсэн ерөнхий алдаа үлддэг тул шалтгааныг олох боломжгүй байв.
   * Асуудал шийдэгдмэгц ЭНЭ БЛОКЫГ ХАСНА.
   */
  handleRequest<T>(
    err: Error | null,
    user: T,
    info?: { name?: string; message?: string },
    context?: { switchToHttp?: () => { getRequest: () => { url?: string } } },
  ): T {
    if (err || !user) {
      const url = context?.switchToHttp?.().getRequest?.()?.url;
      // eslint-disable-next-line no-console
      console.warn(
        `[jwt-guard] 401 url=${url} шалтгаан=${info?.name ?? '—'}: ${info?.message ?? err?.message ?? 'тодорхойгүй'}`,
      );
      throw err ?? new UnauthorizedException('Authentication required');
    }
    return user;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
