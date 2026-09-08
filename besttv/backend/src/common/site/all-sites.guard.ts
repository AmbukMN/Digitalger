import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import type { JwtPayload } from '../decorators/current-user.decorator';

/**
 * ⚠️⚠️ «БҮХ САЙТ» ГОРИМЫН ЭРХ ШАЛГАХ GUARD.
 *
 * `X-Site: all` нь өгөгдлийн тусгаарлалтыг УНТРААДАГ. Тиймээс
 * ЗӨВХӨН админд зөвшөөрөгдөнө.
 *
 * ⚠️⚠️ ЯАГААД ТОКЕНЫГ ӨӨРӨӨ ЗАДАЛДАГ ВЭ:
 *
 * БОДИТ АЛДАА (2026-09-08): энэ guard нь `req.user?.role`-ыг уншдаг
 * байв. Гэтэл NestJS-ийн дараалал нь **global guard → controller
 * guard → route guard**. `JwtAuthGuard` нь route түвшинд
 * (`@UseGuards(JwtAuthGuard)`) тавигдсан тул ЭНЭ guard-аас ХОЙШ
 * ажиллана → `req.user` нь ҮРГЭЛЖ `undefined` →
 * `undefined !== Role.ADMIN` → ЖИНХЭНЭ АДМИН ч 403 авдаг байв.
 *
 * Үр дүнд «Бүх сайт» сонгоход админы дашбоард 403 буцааж, дэлгэц
 * skeleton дээр МӨНХӨД гацдаг байв (хэрэглэгч мэдээлсэн).
 *
 * ⚠️ Тэр үед файлын толгойн тайлбар нь `@UseGuards(JwtAuthGuard,
 * AllSitesGuard)` гэж route түвшинд хэрэглэхийг зөвлөсөн атал
 * `app.module.ts` нь global болгосон — хоёр нь зөрчилдөж байв.
 *
 * ШИЙДЭЛ: global хэвээр үлдээнэ (33 endpoint-д гараар нэмбэл заавал
 * нэгийг мартана), гэхдээ токеныг ЭНД өөрөө задална.
 *
 * ⚠️ Энэ нь ГАДАРГУУГИЙН шалгалт — жинхэнэ эрхийг `JwtAuthGuard` +
 * `RolesGuard` дараа нь бүрэн шалгана. Энд зөвхөн «all» горимыг
 * нээх эсэхийг шийднэ.
 */
@Injectable()
export class AllSitesGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload; allSites?: boolean }>();

    /* ⚠️ Энгийн горим — огт нөлөөлөхгүй */
    if (!req.allSites) return true;

    /**
     * ⚠️ `req.user` байвал түүнийг ашиглана (route guard эрт ажилласан
     * тохиолдол), эс бөгөөс токеныг өөрөө задална.
     */
    const role = req.user?.role ?? this.roleFromHeader(req);

    if (role !== Role.ADMIN) {
      /**
       * ⚠️ Алдаа ШИДНЭ, чимээгүй буулт хийхгүй. Учир нь клиент
       * «бүх сайтын дүн» хүлээж байгаа бол нэг сайтын дүн буцаах нь
       * ТӨӨРӨГДҮҮЛНЭ — админ буруу тоо хараад шийдвэр гаргана.
       */
      throw new ForbiddenException('Бүх сайтын өгөгдөл харах эрх байхгүй');
    }
    return true;
  }

  /**
   * `Authorization: Bearer <token>`-оос role-ыг гаргана.
   *
   * ⚠️ Алдаа гарвал `undefined` — тэр үед 403 шидэгдэнэ (fail-closed).
   * Токен хүчингүй бол `JwtAuthGuard` дараа нь 401 өгнө; энд түүнийг
   * давхардуулан оношлохгүй.
   */
  private roleFromHeader(req: Request): string | undefined {
    const raw = req.headers.authorization;
    if (!raw?.startsWith('Bearer ')) return undefined;
    try {
      const payload = this.jwt.verify<JwtPayload>(raw.slice(7), {
        secret: this.config.get<string>('jwt.secret'),
      });
      return payload?.role;
    } catch {
      return undefined;
    }
  }
}

/**
 * ⚠️ Сервер талын кодод (cron, worker, дотоод дуудлага) хоёр сайтын
 * өгөгдлийг зориуд нийлүүлэх туслах.
 *
 * ЗӨВХӨН дараах үед:
 *   · Админы нэгдсэн дашбоард («нийт борлуулалт»)
 *   · Хоёр сайтад хамаарах cleanup cron
 *   · Migration шалгах скрипт
 */
export { runAcrossSites } from './site-context';
