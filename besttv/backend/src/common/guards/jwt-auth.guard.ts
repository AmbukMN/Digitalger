import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /** ⚠️ ТҮР ОНОШЛОГОО — асуудал ШИЙДЭГДСЭНИЙ ДАРАА л устгана */
  handleRequest<T>(
    err: Error | null,
    user: T,
    info?: { name?: string; message?: string },
    ctx?: ExecutionContext,
  ): T {
    if (err || !user) {
      let d = '';
      try {
        const req = ctx?.switchToHttp().getRequest<{ headers: Record<string, string> }>();
        const raw = req?.headers?.authorization?.replace(/^Bearer /, '');
        if (raw) {
          const p = JSON.parse(Buffer.from(raw.split('.')[1], 'base64').toString('utf8')) as {
            exp?: number;
            iat?: number;
            sub?: string;
          };
          const now = Math.floor(Date.now() / 1000);
          d = ` sub=${p.sub} iat=${p.iat} exp=${p.exp} серверийн_now=${now} үлдсэн=${(p.exp ?? 0) - now}с сүүл=${raw.slice(-10)}`;
        } else d = ' Authorization-АЛГА';
      } catch {
        d = ' задарсангүй';
      }
      // eslint-disable-next-line no-console
      console.warn(`[DIAG-ME] ${info?.name}: ${info?.message} |${d}`);
      throw err ?? new UnauthorizedException('Authentication required');
    }
    return user;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
