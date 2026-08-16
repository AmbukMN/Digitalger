import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    /**
     * ⚠️⚠️ ТОКЕН ИЛГЭЭСЭН АТЛАА ХҮЧИНГҮЙ БОЛ ХАРИУНД ДОХИО ӨГНӨ.
     *
     * БОДИТ ГОМДОЛ: «эрх заримдаа түгжигдээд, дараа нь нээгдээд байна».
     *
     * Шалтгаан: энэ guard нь хүчингүй/хугацаа дууссан токеныг ЧИМЭЭГҮЙ
     * зочин болгодог. `/titles/:slug` нь 200 + `hasAccess: false`
     * буцаана — 401 БИШ. Тиймээс client-ийн «401 → refresh → дахин
     * оролдох» механизм ХЭЗЭЭ Ч ажиллахгүй: хэрэглэгч түгжээтэй
     * хуудас хараад, дараа нь өөр хүсэлт 401 авч refresh хийсний
     * дараа л нээгддэг байв.
     *
     * `X-Auth-Stale: 1` header нь client-д «токеноо шинэчлээд дахин
     * тат» гэж хэлнэ. Хариу нь 200 хэвээр тул ЗОЧИНД нөлөөгүй
     * (тэдэнд токен огт байхгүй → header ч гарахгүй).
     */
    const req = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
    const sentToken = typeof req.headers?.authorization === 'string';

    try {
      await super.canActivate(context);
    } catch {
      if (sentToken) {
        const res = context.switchToHttp().getResponse<{
          setHeader?: (k: string, v: string) => void;
        }>();
        res.setHeader?.('X-Auth-Stale', '1');
      }
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
