import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    /**
     * ⚠️ `handleRequest`-д ExecutionContext хэрэгтэй тул энд хадгална.
     * Passport нь түүнийг 4 дэх аргумент болгож дамжуулдаг ч, тэр нь
     * хувилбараас хамаарч ӨӨРЧЛӨГДДӨГ тул найдвартай зам биш.
     */
    try {
      await super.canActivate(context);
    } catch {
      /* Хүчингүй токен — зочноор үргэлжилнэ (`handleRequest` дохио тавина) */
    }
    return true;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any --
     ⚠️ Passport-ийн `IAuthGuard.handleRequest` нь generic `TUser`-тэй тул
     `unknown` болговол base type-тай зөрчилдөнө (TS2416). Энэ бол
     framework-ийн шаардлага — өөрчилж болохгүй. */
  handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
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
     * ⚠️ ДОХИОГ ЭНД тавина, `canActivate`-ийн `catch`-д БИШ.
     * Passport нь баталгаажуулалт унасан үед `handleRequest`-ыг
     * `err`/`info`-той дуудаад, ЭНЭ метод юу буцаахаас хамаарч
     * шийддэг. Бид `null` буцаадаг тул `super.canActivate()` нь
     * алдаа ОГТ ШИДЭХГҮЙ — тиймээс тэр `catch` хэзээ ч ажиллахгүй
     * байв (production дээр тестээр батлагдсан).
     *
     * `X-Auth-Stale: 1` нь client-д «токеноо шинэчлээд дахин тат»
     * гэж хэлнэ. Хариу 200 хэвээр тул ЗОЧИНД нөлөөгүй.
     */
    if (!user && context) {
      const http = context.switchToHttp();
      const req = http.getRequest<{ headers?: Record<string, unknown> }>();
      /* ⚠️ Зөвхөн токен ИЛГЭЭСЭН үед — зочинд дохио утгагүй */
      if (typeof req?.headers?.authorization === 'string') {
        const res = http.getResponse<{ setHeader?: (k: string, v: string) => void }>();
        res?.setHeader?.('X-Auth-Stale', '1');
      }
    }
    return user || null;
  }
}
