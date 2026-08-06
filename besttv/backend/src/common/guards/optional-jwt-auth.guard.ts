import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // No valid token — proceed without user
    }
    return true;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any --
     ⚠️ Passport-ийн `IAuthGuard.handleRequest` нь generic `TUser`-тэй тул
     `unknown` болговол base type-тай зөрчилдөнө (TS2416). Энэ бол
     framework-ийн шаардлага — өөрчилж болохгүй. */
  handleRequest(err: any, user: any) {
    return user || null;
  }
}
