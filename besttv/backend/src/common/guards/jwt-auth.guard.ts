import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * ⚠️ ТҮР ОНОШИЛГОО — 401-ийн шалтгааныг логт бичнэ.
   * `info` нь passport-jwt-ийн үнэн шалтгаан (TokenExpiredError /
   * JsonWebTokenError / "No auth token"). Асуудал шийдэгдмэгц хасна.
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
        `[jwt] 401 ${url} — ${info?.name ?? '—'}: ${info?.message ?? err?.message ?? '?'}`,
      );
      throw err ?? new UnauthorizedException('Authentication required');
    }
    return user;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
